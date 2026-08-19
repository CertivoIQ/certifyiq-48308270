import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTransmissionAuthority } from "@/utils/transmission-authority.functions";

const TRANSMISSION_TOKEN_TTL_MS = 5 * 60 * 1000;

export const authorizeAndSubmitHfaDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string }) => {
    if (!data?.submissionId || data.submissionId.length > 100) {
      throw new Error("An HFA submission id is required.");
    }

    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: submission, error: submissionError } = await supabase
      .from("hfa_submissions")
      .select(
        "id, agency_id, owner_user_id, status, evidence_manifest_id",
      )
      .eq("id", data.submissionId)
      .maybeSingle();

    if (submissionError) throw submissionError;

    if (!submission) {
      return {
        status: "BLOCKED",
        reason: "The submission draft does not exist or is not available.",
      } as const;
    }

    if (submission.owner_user_id !== userId) {
      return {
        status: "BLOCKED",
        reason: "Only the submission owner may authorize this package.",
      } as const;
    }

    if (submission.status !== "draft") {
      return {
        status: "BLOCKED",
        reason: "Only a draft submission may enter the submission workflow.",
      } as const;
    }

    if (!submission.evidence_manifest_id) {
      return {
        status: "BLOCKED",
        reason: "The submission draft does not have an evidence manifest.",
      } as const;
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: manifest, error: manifestError } = await supabaseAdmin
      .from("evidence_manifests")
      .select("id, manifest_sha256")
      .eq("id", submission.evidence_manifest_id)
      .maybeSingle();

    if (manifestError) throw manifestError;

    if (!manifest?.manifest_sha256) {
      return {
        status: "BLOCKED",
        reason:
          "The submission evidence manifest is missing or cannot be verified.",
      } as const;
    }

    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + TRANSMISSION_TOKEN_TTL_MS,
    );

    const { error: revokeError } = await supabaseAdmin
      .from("hfa_transmission_tokens")
      .update({
        revoked_at: issuedAt.toISOString(),
      })
      .eq("submission_id", submission.id)
      .is("consumed_at", null)
      .is("revoked_at", null);

    if (revokeError) throw revokeError;

    const { data: token, error: tokenError } = await supabaseAdmin
      .from("hfa_transmission_tokens")
      .insert({
        submission_id: submission.id,
        agency_id: submission.agency_id,
        manifest_sha256: manifest.manifest_sha256,
        issued_by: userId,
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (tokenError) throw tokenError;

    const { error: grantError } = await supabaseAdmin
      .from("hfa_submission_grants")
      .upsert(
        {
          submission_id: submission.id,
          agency_id: submission.agency_id,
          granted_by: userId,
          granted_at: issuedAt.toISOString(),
          revoked_at: null,
        },
        {
          onConflict: "submission_id,agency_id",
        },
      );

    if (grantError) throw grantError;

    const authority = await getTransmissionAuthority({
      data: {
        submissionId: submission.id,
      },
    });

    if (
      authority.transmissionAuthority !== "ALLOWED" ||
      authority.transmissionStatus !== "TRANSMISSION_AUTHORIZED"
    ) {
      await supabaseAdmin
        .from("hfa_transmission_tokens")
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq("id", token.id)
        .is("consumed_at", null)
        .is("revoked_at", null);

      return {
        status: "BLOCKED",
        authority,
      } as const;
    }

    const consumedAt = new Date().toISOString();

    const { data: consumedToken, error: consumeError } = await supabaseAdmin
      .from("hfa_transmission_tokens")
      .update({
        consumed_at: consumedAt,
      })
      .eq("id", token.id)
      .is("consumed_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();

    if (consumeError) throw consumeError;

    if (!consumedToken) {
      return {
        status: "BLOCKED",
        reason:
          "The transmission authorization token was no longer available for one-time use.",
      } as const;
    }

    const submittedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("hfa_submissions")
      .update({
        status: "submitted",
        submitted_at: submittedAt,
      })
      .eq("id", submission.id)
      .eq("status", "draft")
      .select("id, status, submitted_at")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      return {
        status: "BLOCKED",
        reason:
          "The submission state changed before authorization could be completed.",
      } as const;
    }

    const { error: auditError } = await supabaseAdmin
      .from("hfa_audit_events")
      .insert({
        action: "submission_authorized",
        actor_id: userId,
        actor_kind: "owner",
        agency_id: submission.agency_id,
        submission_id: submission.id,
        detail: {
          transmission_authority: authority.transmissionAuthority,
          transmission_status: authority.transmissionStatus,
          transmission_token_id: token.id,
          transmission_token_consumed_at: consumedAt,
          external_delivery_executed: false,
          authorized_at: submittedAt,
        },
      });

    if (auditError) throw auditError;

    return {
      status: "SUBMITTED",
      submissionId: updated.id,
      submittedAt: updated.submitted_at,
      externalDeliveryExecuted: false,
      authority,
    } as const;
  });
