import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTransmissionAuthority } from "@/utils/transmission-authority.functions";

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
      .select("id, agency_id, owner_user_id, status")
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

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: grantError } = await supabaseAdmin
      .from("hfa_submission_grants")
      .upsert(
        {
          submission_id: submission.id,
          agency_id: submission.agency_id,
          granted_by: userId,
          granted_at: new Date().toISOString(),
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
      return {
        status: "BLOCKED",
        authority,
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