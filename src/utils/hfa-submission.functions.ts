import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateSubmissionAuthority } from "@/lib/certification-authority.mjs";

function organizationIdFor(userId: string) {
  return `org-${userId}`;
}

export const createHfaSubmissionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      certificationId: string;
      agencyId: string;
      propertyId: string;
      propertyName?: string;
      program: string;
      reportingPeriod: string;
    }) => {
      if (!data?.certificationId || data.certificationId.length > 100) {
        throw new Error("A certification id is required.");
      }

      if (!data?.agencyId || data.agencyId.length > 100) {
        throw new Error("A destination agency is required.");
      }

      if (!data?.propertyId || data.propertyId.length > 150) {
        throw new Error("A property id is required.");
      }

      if (!data?.program || data.program.length > 100) {
        throw new Error("A compliance program is required.");
      }

      if (!data?.reportingPeriod || data.reportingPeriod.length > 100) {
        throw new Error("A reporting period is required.");
      }

      if (data.propertyName && data.propertyName.length > 200) {
        throw new Error("The property name is too long.");
      }

      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [itemResult, findingsResult, manifestResult] = await Promise.all([
      supabase
        .from("certification_import_items")
        .select("id, status")
        .eq("id", data.certificationId)
        .maybeSingle(),

      supabase
        .from("compliance_findings")
        .select("id, status")
        .eq("item_id", data.certificationId),

      supabase
        .from("evidence_manifests")
        .select("id, manifest_sha256, review_id, created_at")
        .eq("review_id", data.certificationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (itemResult.error) throw itemResult.error;
    if (findingsResult.error) throw findingsResult.error;
    if (manifestResult.error) throw manifestResult.error;

    const manifest = manifestResult.data;

    if (!manifest) {
      return {
        error:
          "A current evidence manifest is required before a submission draft can be prepared.",
      } as const;
    }

    const findings = findingsResult.data ?? [];
    const findingIds = findings.map((finding) => finding.id);

    const reviewsResult = findingIds.length
      ? await supabase
          .from("finding_reviews")
          .select(
            "finding_id, decision, reason, reviewer_id, created_at, manifest_sha256",
          )
          .in("finding_id", findingIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (reviewsResult.error) throw reviewsResult.error;

    const authority = evaluateSubmissionAuthority({
      item: itemResult.data,
      findings,
      reviews: reviewsResult.data ?? [],
      manifest,
    });

    if (
      authority.submissionAuthority !== "ALLOWED" ||
      authority.submissionStatus !== "SUBMISSION_AUTHORIZED"
    ) {
      return {
        error:
          "The certification does not currently have authority to prepare a submission package.",
        authority,
      } as const;
    }

    // Avoid creating multiple draft rows for the same exact
    // certification + manifest + destination agency.
    const { data: existingDraft, error: existingError } = await supabase
      .from("hfa_submissions")
      .select("id, status, evidence_manifest_id")
      .eq("owner_user_id", userId)
      .eq("agency_id", data.agencyId)
      .eq("certification_id", data.certificationId)
      .eq("evidence_manifest_id", manifest.id)
      .eq("status", "draft")
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingDraft) {
      return {
        submissionId: existingDraft.id,
        status: "draft",
        evidenceManifestId: manifest.id,
        manifestSha256: manifest.manifest_sha256,
        existing: true,
      } as const;
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const organizationId = organizationIdFor(userId);

    const { data: created, error: createError } = await supabaseAdmin
      .from("hfa_submissions")
      .insert({
        agency_id: data.agencyId,
        certification_id: data.certificationId,
        evidence_manifest_id: manifest.id,
        organization_id: organizationId,
        owner_user_id: userId,
        property_id: data.propertyId,
        property_name: data.propertyName ?? null,
        program: data.program,
        reporting_period: data.reportingPeriod,
        status: "draft",
        preflight: {
          submission_authority: authority.submissionAuthority,
          submission_status: authority.submissionStatus,
          manifest_sha256: manifest.manifest_sha256,
          prepared_at: new Date().toISOString(),
        },
      })
      .select("id, status, evidence_manifest_id")
      .single();

    if (createError) throw createError;

    return {
      submissionId: created.id,
      status: created.status,
      evidenceManifestId: created.evidence_manifest_id,
      manifestSha256: manifest.manifest_sha256,
      existing: false,
    } as const;
  });export const listHfaDestinationOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("hfa_agencies")
      .select("id, name, state_code")
      .eq("is_demo", false)
      .order("state_code")
      .order("name");

    if (error) throw error;

    return data ?? [];
  });