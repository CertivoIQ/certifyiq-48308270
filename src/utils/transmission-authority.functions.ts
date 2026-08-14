import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateSubmissionAuthority } from "@/lib/certification-authority.mjs";
import { evaluateTransmissionAuthority } from "@/lib/transmission-authority.mjs";

export const getTransmissionAuthority = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId || data.submissionId.length > 100) {
      throw new Error("An HFA submission id is required.");
    }

    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: submission, error: submissionError } = await supabase
      .from("hfa_submissions")
      .select(
        "id, agency_id, certification_id, evidence_manifest_id, status, owner_user_id",
      )
      .eq("id", data.submissionId)
      .maybeSingle();

    if (submissionError) throw submissionError;

    if (!submission) {
      return {
        transmissionAuthority: "BLOCKED",
        transmissionStatus: "INCOMPLETE_TRANSMISSION_PACKAGE",
        reason: "The HFA submission does not exist or is not available.",
      } as const;
    }

    if (!submission.certification_id || !submission.evidence_manifest_id) {
      return {
        transmissionAuthority: "BLOCKED",
        transmissionStatus: "INCOMPLETE_TRANSMISSION_PACKAGE",
        reason:
          "The HFA submission must reference both a certification and an evidence manifest.",
      } as const;
    }

    const [
      itemResult,
      findingsResult,
      manifestResult,
      grantResult,
      priorSubmissionsResult,
    ] = await Promise.all([
      supabase
        .from("certification_import_items")
        .select("id, status")
        .eq("id", submission.certification_id)
        .maybeSingle(),

      supabase
        .from("compliance_findings")
        .select("id, status")
        .eq("item_id", submission.certification_id),

      supabase
        .from("evidence_manifests")
        .select("id, manifest_sha256, review_id, created_at")
        .eq("id", submission.evidence_manifest_id)
        .maybeSingle(),

      supabase
        .from("hfa_submission_grants")
        .select("agency_id, submission_id, granted_at, revoked_at")
        .eq("submission_id", submission.id)
        .eq("agency_id", submission.agency_id)
        .maybeSingle(),

      supabase
        .from("hfa_submissions")
        .select("id, agency_id, evidence_manifest_id, status")
        .eq("agency_id", submission.agency_id)
        .eq("evidence_manifest_id", submission.evidence_manifest_id)
        .neq("id", submission.id),
    ]);

    if (itemResult.error) throw itemResult.error;
    if (findingsResult.error) throw findingsResult.error;
    if (manifestResult.error) throw manifestResult.error;
    if (grantResult.error) throw grantResult.error;
    if (priorSubmissionsResult.error) throw priorSubmissionsResult.error;

    const manifest = manifestResult.data;

    if (
      !manifest ||
      manifest.review_id !== submission.certification_id
    ) {
      return {
        transmissionAuthority: "BLOCKED",
        transmissionStatus: "PACKAGE_MANIFEST_MISMATCH",
        reason:
          "The evidence manifest is not bound to the certification in this HFA submission.",
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

    const submissionAuthority = evaluateSubmissionAuthority({
      item: itemResult.data,
      findings,
      reviews: reviewsResult.data ?? [],
      manifest,
    });

    const result = evaluateTransmissionAuthority({
      submissionAuthority,
      manifest,
      packageManifestSha256: manifest.manifest_sha256,
      destination: {
        agencyId: submission.agency_id,
      },
      grant: grantResult.data,
      priorSubmissions: priorSubmissionsResult.data ?? [],
    });

    return {
      submissionId: submission.id,
      certificationId: submission.certification_id,
      ...result,
    } as const;
  });