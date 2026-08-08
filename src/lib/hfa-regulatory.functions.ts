/**
 * HFA Regulatory Console — Phase 1 server functions.
 *
 * Every call runs through `requireSupabaseAuth`, so the acting identity comes
 * from the validated bearer token. A client-supplied agency id is never treated
 * as authorization: agency reads and writes only succeed when row-level
 * security finds an active submission grant naming that agency, and agency
 * membership by itself exposes nothing about an owner's portfolio.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUBMISSION_SELECT =
  "id, agency_id, owner_user_id, organization_id, property_id, property_name, certification_id, program, reporting_period, status, evidence_manifest_id, readiness_score, preflight, previous_submission_id, submitted_at, accepted_at, created_at, hfa_agencies(name)";

/** Agencies the signed-in user belongs to. Empty for owners. */
export const listMyAgencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships, error } = await context.supabase
      .from("hfa_agency_memberships")
      .select("agency_id, role, hfa_agencies(id, name, state_code, authority_scope, is_demo)")
      .eq("user_id", context.userId);
    if (error) throw error;
    return (memberships ?? []).map((m) => {
      const a = m.hfa_agencies as unknown as {
        id: string;
        name: string;
        state_code: string;
        authority_scope: string[] | null;
        is_demo: boolean;
      };
      return {
        role: m.role as "agency_admin" | "rule_reviewer" | "monitor" | "read_only",
        agency: {
          id: a.id,
          name: a.name,
          stateCode: a.state_code,
          authorityScope: Array.isArray(a.authority_scope) ? a.authority_scope : [],
          isDemo: a.is_demo,
        },
      };
    });
  });

/** Agencies an owner may submit to. Public directory data only. */
export const listAgencyDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hfa_agencies")
      .select("id, name, state_code, authority_scope, is_demo")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

/* ----------------------------------------------------------------- owner side */

export const listOwnerSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mapSubmission } = await import("@/lib/hfa-regulatory-map");
    const { data, error } = await context.supabase
      .from("hfa_submissions")
      .select(SUBMISSION_SELECT)
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapSubmission(row as never));
  });

/**
 * Creates a draft package. Nothing is visible to an agency until it is granted.
 *
 * ORGANIZATION OWNERSHIP: CertivoIQ has no organization/membership model in the
 * production schema yet, so the tenant reference is derived server-side as
 * `owner:<userId>` — a stable, per-account placeholder. The literal "self" is
 * rejected, the client can no longer supply the value, and every row created
 * this way is safely backfillable once an approved organization model lands
 * (see `docs/organization-model-proposal.md`).
 */
export const createOwnerSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      agencyId: string;
      propertyId: string;
      propertyName?: string;
      certificationId?: string;
      program: string;
      reportingPeriod: string;
      preflight: unknown;
    }) => {
      if (!data?.agencyId) throw new Error("Select the agency this package is for.");
      if (!data.propertyId) throw new Error("A property is required.");
      if (!data.program) throw new Error("A program is required.");
      if (!data.reportingPeriod) throw new Error("A reporting period is required.");
      return data;
    },
  )

  .handler(async ({ data, context }) => {
    const { mapSubmission } = await import("@/lib/hfa-regulatory-map");
    const preflight = (data.preflight ?? {}) as { readinessScore?: number };

    const { data: row, error } = await context.supabase
      .from("hfa_submissions")
      .insert({
        agency_id: data.agencyId,
        owner_user_id: context.userId,
        organization_id: `owner:${context.userId}`,
        property_id: data.propertyId,
        property_name: data.propertyName ?? null,
        certification_id: data.certificationId ?? null,
        program: data.program,
        reporting_period: data.reportingPeriod,
        status: "draft",
        preflight: preflight as never,
        readiness_score: typeof preflight.readinessScore === "number" ? preflight.readinessScore : null,
      })
      .select(SUBMISSION_SELECT)
      .single();
    if (error) throw error;

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "owner",
      agency_id: data.agencyId,
      submission_id: row.id,
      action: "submission.drafted",
      detail: { program: data.program, reportingPeriod: data.reportingPeriod } as never,
    });

    return mapSubmission(row as never);
  });

/**
 * Explicit submission grant: the owner reviews the exact snapshot, then shares
 * it with one named agency. Blocked while preflight has required blockers.
 */
export const grantAgencyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string; evidenceManifestId?: string | null }) => {
    if (!data?.submissionId) throw new Error("A submission is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: submission, error: readError } = await context.supabase
      .from("hfa_submissions")
      .select("id, agency_id, owner_user_id, status, preflight")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (readError) throw readError;
    if (!submission || submission.owner_user_id !== context.userId) {
      throw new Response("Not found", { status: 404 });
    }
    if (submission.status === "accepted") {
      return { error: "An accepted submission cannot be re-shared. Create a revision instead." } as const;
    }

    const preflight = (submission.preflight ?? {}) as { blockers?: string[] };
    if (Array.isArray(preflight.blockers) && preflight.blockers.length > 0) {
      return { error: "Resolve the preflight blockers before submitting to the agency." } as const;
    }

    const now = new Date().toISOString();

    const { error: grantError } = await context.supabase.from("hfa_submission_grants").upsert(
      {
        submission_id: submission.id,
        agency_id: submission.agency_id,
        granted_by: context.userId,
        granted_at: now,
        revoked_at: null,
      },
      { onConflict: "submission_id,agency_id" },
    );
    if (grantError) throw grantError;

    const { error: statusError } = await context.supabase
      .from("hfa_submissions")
      .update({
        status: "submitted",
        submitted_at: now,
        evidence_manifest_id: data.evidenceManifestId ?? null,
      })
      .eq("id", submission.id);
    if (statusError) throw statusError;

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "owner",
      agency_id: submission.agency_id,
      submission_id: submission.id,
      action: "submission.granted",
      detail: { grantedAt: now } as never,
    });

    return { ok: true } as const;
  });

/** Revoking removes future agency access; audit history is preserved. */
export const revokeAgencyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId) throw new Error("A submission is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: submission, error: readError } = await context.supabase
      .from("hfa_submissions")
      .select("id, agency_id, owner_user_id, status")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (readError) throw readError;
    if (!submission || submission.owner_user_id !== context.userId) {
      throw new Response("Not found", { status: 404 });
    }

    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("hfa_submission_grants")
      .update({ revoked_at: now })
      .eq("submission_id", submission.id)
      .eq("agency_id", submission.agency_id)
      .is("revoked_at", null);
    if (error) throw error;

    if (submission.status !== "accepted") {
      await context.supabase
        .from("hfa_submissions")
        .update({ status: "withdrawn" })
        .eq("id", submission.id);
    }

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "owner",
      agency_id: submission.agency_id,
      submission_id: submission.id,
      action: "submission.revoked",
      detail: { revokedAt: now } as never,
    });

    return { ok: true } as const;
  });

/** Owner response to a correction request. */
export const respondToCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; response: string }) => {
    if (!data?.caseId) throw new Error("A correction case is required.");
    if (!data.response?.trim()) throw new Error("Describe the corrective action taken.");
    if (data.response.length > 8000) throw new Error("Response is too long.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("correction_cases")
      .update({
        owner_response: data.response.trim(),
        owner_responded_at: now,
        status: "owner_responded",
      })
      .eq("id", data.caseId)
      .select("id, submission_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) return { error: "This correction case is no longer open for a response." } as const;

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "owner",
      submission_id: row.submission_id,
      action: "correction.owner_responded",
      detail: { caseId: row.id } as never,
    });

    return { ok: true } as const;
  });

/**
 * Correction evidence is no longer accepted from the browser as a hash plus a
 * free-text reference. Uploads go through
 * `uploadCorrectionEvidence` in `@/lib/hfa-evidence.functions`, where the server
 * hashes the bytes itself and stores them in a private bucket.
 */


/* ---------------------------------------------------------------- agency side */

/** Agency inbox: only packages explicitly submitted to the viewer's agency. */
export const listAgencyInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mapSubmission } = await import("@/lib/hfa-regulatory-map");
    const { data, error } = await context.supabase
      .from("hfa_submissions")
      .select(SUBMISSION_SELECT)
      .neq("owner_user_id", context.userId)
      .neq("status", "draft")
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapSubmission(row as never));
  });

/** Submission detail. Reading it is itself an audited event. */
export const getAgencySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId) throw new Error("A submission is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { mapSubmission, mapCorrectionCase, mapCorrectionEvidence, mapAuditEvent } = await import(
      "@/lib/hfa-regulatory-map"
    );

    const { data: row, error } = await context.supabase
      .from("hfa_submissions")
      .select(SUBMISSION_SELECT)
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Response("Not found", { status: 404 });

    const submission = mapSubmission(row as never);
    const isOwner = submission.ownerUserId === context.userId;

    const [cases, events, grants] = await Promise.all([
      context.supabase
        .from("correction_cases")
        .select(
          "id, submission_id, finding_ref, title, detail, status, due_at, owner_response, owner_responded_at, disposition, closed_at, created_at",
        )
        .eq("submission_id", submission.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("hfa_audit_events")
        .select("id, actor_kind, action, detail, created_at")
        .eq("submission_id", submission.id)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("hfa_submission_grants")
        .select("submission_id, agency_id, granted_at, revoked_at")
        .eq("submission_id", submission.id),
    ]);
    if (cases.error) throw cases.error;
    if (events.error) throw events.error;

    const caseIds = (cases.data ?? []).map((c) => c.id);
    let evidence: ReturnType<typeof mapCorrectionEvidence>[] = [];
    if (caseIds.length) {
      const { data: ev, error: evError } = await context.supabase
        .from("correction_evidence")
        .select("id, correction_case_id, document_ref, document_label, sha256, submitted_at")
        .in("correction_case_id", caseIds);
      if (evError) throw evError;
      evidence = (ev ?? []).map((r) => mapCorrectionEvidence(r as never));
    }

    if (!isOwner) {
      await context.supabase.from("hfa_audit_events").insert({
        actor_id: context.userId,
        actor_kind: "agency",
        agency_id: submission.agencyId,
        submission_id: submission.id,
        action: "submission.viewed",
        detail: {} as never,
      });
    }

    return {
      submission,
      isOwner,
      cases: (cases.data ?? []).map((c) => mapCorrectionCase(c as never)),
      evidence,
      auditEvents: (events.data ?? []).map((e) => mapAuditEvent(e as never)),
      grants: (grants.data ?? []).map((g) => ({
        submissionId: g.submission_id,
        agencyId: g.agency_id,
        grantedBy: "",
        grantedAt: g.granted_at,
        revokedAt: g.revoked_at,
      })),
    };
  });

export const startAgencyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId) throw new Error("A submission is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("hfa_submissions")
      .update({ status: "in_review" })
      .eq("id", data.submissionId)
      .in("status", ["submitted", "correction_required"])
      .select("id, agency_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) return { error: "This submission cannot be moved into review." } as const;

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "agency",
      agency_id: row.agency_id,
      submission_id: row.id,
      action: "review.started",
      detail: {} as never,
    });
    return { ok: true } as const;
  });

export const requestCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { submissionId: string; findingRef: string; title: string; detail?: string; dueAt: string }) => {
      if (!data?.submissionId) throw new Error("A submission is required.");
      if (!data.findingRef?.trim()) throw new Error("Reference the specific finding.");
      if (!data.title?.trim()) throw new Error("A correction summary is required.");
      if (!data.dueAt || Number.isNaN(Date.parse(data.dueAt))) throw new Error("A due date is required.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: caseRow, error } = await context.supabase
      .from("correction_cases")
      .insert({
        submission_id: data.submissionId,
        finding_ref: data.findingRef.trim(),
        title: data.title.trim(),
        detail: data.detail?.trim() || null,
        due_at: new Date(data.dueAt).toISOString(),
        status: "open",
        created_by: context.userId,
      })
      .select("id, submission_id")
      .maybeSingle();
    if (error) throw error;
    if (!caseRow) return { error: "You are not authorized to request corrections on this submission." } as const;

    const { data: sub } = await context.supabase
      .from("hfa_submissions")
      .update({ status: "correction_required" })
      .eq("id", data.submissionId)
      .select("agency_id")
      .maybeSingle();

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "agency",
      agency_id: sub?.agency_id ?? null,
      submission_id: caseRow.submission_id,
      action: "correction.requested",
      detail: { caseId: caseRow.id, findingRef: data.findingRef, dueAt: data.dueAt } as never,
    });

    return { ok: true } as const;
  });

export const dispositionCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; disposition: string; accept: boolean }) => {
    if (!data?.caseId) throw new Error("A correction case is required.");
    if (!data.disposition?.trim()) throw new Error("Record the agency disposition.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("correction_cases")
      .update({
        disposition: data.disposition.trim(),
        status: data.accept ? "accepted" : "reopened",
        closed_by: data.accept ? context.userId : null,
        closed_at: data.accept ? now : null,
      })
      .eq("id", data.caseId)
      .select("id, submission_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) return { error: "You are not authorized to disposition this correction." } as const;

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "agency",
      submission_id: row.submission_id,
      action: data.accept ? "correction.accepted" : "correction.reopened",
      detail: { caseId: row.id } as never,
    });

    return { ok: true } as const;
  });

/** Acceptance is blocked while any correction case is still open. */
export const acceptSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId) throw new Error("A submission is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: open, error: openError } = await context.supabase
      .from("correction_cases")
      .select("id")
      .eq("submission_id", data.submissionId)
      .in("status", ["open", "owner_responded", "agency_review", "reopened"]);
    if (openError) throw openError;
    if ((open ?? []).length > 0) {
      return { error: "Close every correction case before accepting this submission." } as const;
    }

    const now = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("hfa_submissions")
      .update({ status: "accepted", accepted_at: now })
      .eq("id", data.submissionId)
      .select("id, agency_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) return { error: "You are not authorized to accept this submission." } as const;

    await context.supabase.from("hfa_audit_events").insert({
      actor_id: context.userId,
      actor_kind: "agency",
      agency_id: row.agency_id,
      submission_id: row.id,
      action: "submission.accepted",
      detail: { acceptedAt: now } as never,
    });

    return { ok: true } as const;
  });

/**
 * Evidence-manifest access. Authorization is server-side: the manifest is
 * returned only when the caller can already read the submission that links it.
 */
export const getSubmissionEvidenceManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId) throw new Error("A submission is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: submission, error } = await context.supabase
      .from("hfa_submissions")
      .select("id, agency_id, owner_user_id, evidence_manifest_id")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (error) throw error;
    if (!submission) throw new Response("Not found", { status: 404 });
    if (!submission.evidence_manifest_id) {
      return { error: "No evidence manifest is attached to this submission." } as const;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: manifest, error: manifestError } = await supabaseAdmin
      .from("evidence_manifests")
      .select("manifest, manifest_sha256, engine_build, outcome, created_at")
      .eq("id", submission.evidence_manifest_id)
      .maybeSingle();
    if (manifestError) throw manifestError;
    if (!manifest) return { error: "The linked evidence manifest is unavailable." } as const;

    if (submission.owner_user_id !== context.userId) {
      await context.supabase.from("hfa_audit_events").insert({
        actor_id: context.userId,
        actor_kind: "agency",
        agency_id: submission.agency_id,
        submission_id: submission.id,
        action: "evidence_manifest.exported",
        detail: { manifestSha256: manifest.manifest_sha256 } as never,
      });
    }

    return {
      manifest: manifest.manifest,
      manifestSha256: manifest.manifest_sha256,
      engineBuild: manifest.engine_build,
      outcome: manifest.outcome,
      generatedAt: manifest.created_at,
    } as const;
  });
