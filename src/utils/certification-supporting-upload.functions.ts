/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SUPPORTING_DOCUMENT_TYPE_SET,
  supportingDocumentLabel,
  type SupportingDocumentType,
} from "@/lib/tic-supporting-document-registry";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = /^(application\/pdf|image\/(png|jpeg|webp))$/i;

function validateAttachmentInput(data: {
  itemId: string;
  documentType: string;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}) {
  if (!UUID_PATTERN.test(String(data?.itemId ?? ""))) throw new Error("A saved certification is required.");
  if (!SUPPORTING_DOCUMENT_TYPE_SET.has(data.documentType as SupportingDocumentType)) {
    throw new Error("Choose a supported supporting-document type.");
  }
  if (!data.storagePath || data.storagePath.length > 1200) throw new Error("The supporting-document storage path is invalid.");
  if (!data.originalFileName || data.originalFileName.length > 500) throw new Error("The supporting-document filename is invalid.");
  if (!ALLOWED_MIME.test(String(data.mimeType ?? ""))) throw new Error("Supporting documents must be PDF, PNG, JPEG, or WEBP files.");
  if (!Number.isSafeInteger(data.sizeBytes) || data.sizeBytes < 1 || data.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("The supporting document must be 50 MB or smaller.");
  }
  if (!SHA256_PATTERN.test(String(data.sha256 ?? ""))) throw new Error("The supporting-document source hash is invalid.");
  return {
    ...data,
    documentType: data.documentType as SupportingDocumentType,
  };
}

async function pendingCertification(db: any, userId: string, itemId: string) {
  const { data: item, error } = await db
    .from("certification_import_items")
    .select("id, tenant_profile_id, status, review_queue_status, review_started_at, review_finished_at, historical_changes")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!item) throw new Error("That saved certification is not available.");
  if (!item.tenant_profile_id) throw new Error("Assign this certification to a tenant before adding supporting documents.");

  const pending =
    item.status === "completed" &&
    (item.review_queue_status === "not_queued" || item.review_queue_status === "queued") &&
    !item.review_started_at &&
    !item.review_finished_at;

  return { item, pending };
}

export const getCertificationSupportingUploadEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!UUID_PATTERN.test(String(data?.itemId ?? ""))) throw new Error("A saved certification is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { item, pending } = await pendingCertification(db, context.userId, data.itemId);
    return {
      eligible: pending,
      reviewQueueStatus: item.review_queue_status,
      reason: pending
        ? null
        : item.review_started_at || item.review_finished_at || item.review_queue_status === "processing" || item.review_queue_status === "completed"
          ? "Supporting evidence cannot be added after compliance review has started. Reopen the certification through the controlled review workflow first."
          : "This certification is not currently eligible for supporting-document attachment.",
    } as const;
  });

export const attachStandaloneCertificationSupportingDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateAttachmentInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;
    const { item, pending } = await pendingCertification(db, userId, data.itemId);
    if (!pending) {
      throw new Error("Supporting documents may be attached only while the saved certification is still pending review.");
    }
    if (!data.storagePath.startsWith(`${userId}/supporting/${data.itemId}/`)) {
      throw new Error("The supporting-document upload does not belong to this certification.");
    }

    const download = await supabase.storage.from("certification-imports").download(data.storagePath);
    if (download.error || !download.data) throw new Error("The uploaded supporting document could not be verified.");
    const bytes = await download.data.arrayBuffer();
    const { sha256Hex } = await import("@/lib/complianceDecisionAndManifest");
    const actualSha256 = await sha256Hex(bytes);
    if (bytes.byteLength !== data.sizeBytes || actualSha256.toLowerCase() !== data.sha256.toLowerCase()) {
      throw new Error("The stored supporting document does not match the uploaded source bytes.");
    }

    const attachedAt = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: document, error: insertError } = await supabaseAdmin
      .from("portfolio_tenant_documents")
      .insert({
        user_id: userId,
        tenant_profile_id: item.tenant_profile_id,
        certification_import_item_id: item.id,
        storage_path: data.storagePath,
        original_file_name: data.originalFileName,
        document_category: "certification_support",
        document_type: data.documentType,
        display_name: supportingDocumentLabel(data.documentType),
        mime_type: data.mimeType,
        size_bytes: data.sizeBytes,
        sha256: actualSha256,
        source_kind: "standalone_upload",
        source_page_start: null,
        source_page_end: null,
        source_page_numbers: [],
        classification_confidence: 1,
        classification_basis: "Reviewer-selected standalone supporting document type.",
        immutable: true,
        printable: true,
        review_status: "pending_review",
        metadata: {
          attached_to_existing_certification: true,
          attached_at: attachedAt,
          attached_by: userId,
          parent_review_queue_status: item.review_queue_status,
        },
      })
      .select("id, certification_import_item_id, tenant_profile_id, document_type, display_name, review_status")
      .single();
    if (insertError) throw insertError;

    const history = Array.isArray(item.historical_changes) ? item.historical_changes : [];
    const { error: historyError } = await db
      .from("certification_import_items")
      .update({
        historical_changes: [
          ...history,
          {
            type: "standalone_supporting_document_attached",
            attached_at: attachedAt,
            reviewer_id: userId,
            tenant_profile_id: item.tenant_profile_id,
            document_id: document.id,
            document_type: data.documentType,
            original_file_name: data.originalFileName,
            sha256: actualSha256,
          },
        ],
      })
      .eq("id", item.id)
      .eq("user_id", userId)
      .is("review_started_at", null);
    if (historyError) {
      await supabaseAdmin.from("portfolio_tenant_documents").delete().eq("id", document.id);
      throw historyError;
    }

    return {
      ...document,
      attachedAt,
      reviewQueueStatus: item.review_queue_status,
    } as const;
  });
