/**
 * Correction evidence — server-managed uploads.
 *
 * The browser sends bytes only. The server computes SHA-256, size and MIME
 * type, stores the object in the private `correction-evidence` bucket with
 * overwrite disabled, records the uploader, timestamp and storage version, and
 * appends an audit event. Downloads are authorized per request and delivered
 * through a short-lived signed URL.
 *
 * LIMITATION: no malware scanner is wired up in this environment. Every upload
 * is recorded with `scan_status = 'quarantined'`. Nothing in the product claims
 * these files were scanned.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "correction-evidence";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function decodeBase64(base64: string) {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "evidence";
}

/** Owners attach corrective documentation. The hash is never client supplied. */
export const uploadCorrectionEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; fileName: string; contentType: string; contentBase64: string }) => {
    if (!data?.caseId) throw new Error("A correction case is required.");
    if (!data.fileName?.trim()) throw new Error("A file name is required.");
    if (!data.contentBase64) throw new Error("Attach a file.");
    if (!ALLOWED_MIME.has(data.contentType)) throw new Error("That file type is not accepted.");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Authorization: only the owner of the submission behind this case may
    // attach evidence, checked with the caller's own RLS-scoped client.
    const { data: caseRow, error: caseError } = await context.supabase
      .from("correction_cases")
      .select("id, submission_id, status, hfa_submissions!inner(owner_user_id, agency_id)")
      .eq("id", data.caseId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) throw new Response("Not found", { status: 404 });
    const submission = caseRow.hfa_submissions as unknown as { owner_user_id: string; agency_id: string };
    if (submission.owner_user_id !== context.userId) throw new Response("Forbidden", { status: 403 });
    if (caseRow.status === "accepted") {
      return { error: "This correction is closed. Reopen it before adding evidence." } as const;
    }

    const bytes = decodeBase64(data.contentBase64);
    if (bytes.byteLength === 0) return { error: "That file is empty." } as const;
    if (bytes.byteLength > MAX_BYTES) return { error: "Files must be 25 MB or smaller." } as const;

    const sha256 = await sha256Hex(bytes);
    const fileName = safeName(data.fileName.trim());
    const storagePath = `${caseRow.submission_id}/${data.caseId}/${sha256}-${fileName}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // upsert: false — an existing object is never overwritten.
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: data.contentType, upsert: false });
    if (uploadError && !/exists/i.test(uploadError.message)) throw uploadError;

    const { data: object } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(`${caseRow.submission_id}/${data.caseId}`, { search: `${sha256}-${fileName}` });
    const storageVersion = object?.[0]?.id ?? null;

    const { data: row, error } = await supabaseAdmin
      .from("correction_evidence")
      .insert({
        correction_case_id: data.caseId,
        document_ref: `${BUCKET}/${storagePath}`,
        document_label: fileName,
        sha256,
        submitted_by: context.userId,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        storage_version: storageVersion,
        byte_size: bytes.byteLength,
        mime_type: data.contentType,
        scan_status: "quarantined",
      })
      .select("id, sha256, byte_size, mime_type, scan_status, submitted_at")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return { error: "That exact file is already attached to this correction." } as const;
      }
      throw error;
    }

    await supabaseAdmin.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "owner",
      agency_id: submission.agency_id,
      submission_id: caseRow.submission_id,
      action: "correction_evidence.uploaded",
      detail: { caseId: data.caseId, evidenceId: row.id, sha256, byteSize: bytes.byteLength, mimeType: data.contentType, scanStatus: "quarantined" } as never,
    });

    return { ok: true, evidence: row, scanned: false } as const;
  });

/**
 * Authorized download. The caller must already be able to read the evidence row
 * under RLS (owner, or a member of an agency holding a live grant).
 */
export const getCorrectionEvidenceDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { evidenceId: string }) => {
    if (!data?.evidenceId) throw new Error("An evidence record is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("correction_evidence")
      .select("id, correction_case_id, storage_bucket, storage_path, document_label, sha256, scan_status, correction_cases!inner(submission_id)")
      .eq("id", data.evidenceId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Response("Not found", { status: 404 });
    if (!row.storage_path) {
      return { error: "This evidence record predates managed storage and has no downloadable file." } as const;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(row.storage_bucket ?? BUCKET)
      .createSignedUrl(row.storage_path, 120);
    if (signError) throw signError;

    const submissionId = (row.correction_cases as unknown as { submission_id: string } | null)?.submission_id ?? null;
    await supabaseAdmin.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "agency",
      submission_id: submissionId,
      action: "correction_evidence.downloaded",
      detail: { evidenceId: row.id, sha256: row.sha256 } as never,
    });

    return {
      url: signed.signedUrl,
      fileName: row.document_label ?? "evidence",
      sha256: row.sha256,
      scanStatus: row.scan_status,
      scanned: false,
    } as const;
  });
