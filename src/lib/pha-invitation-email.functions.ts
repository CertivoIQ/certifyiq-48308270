import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  invitationId: z.string().uuid(),
  accessToken: z.string().min(20),
});

export const sendPhaWorkspaceInvitationEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    // Generated Supabase types lag the PHA invitation and membership migrations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabaseAdmin as any;

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    const requester = authData.user;
    if (authError || !requester) throw new Error("Authenticated PHA administrator is required.");

    const { data: invitation, error: invitationError } = await client
      .from("pha_workspace_invitations")
      .select("id, workspace_user_id, invite_email, agency_role, status, expires_at, delivery_status, delivery_attempt_count")
      .eq("id", data.invitationId)
      .single();
    if (invitationError || !invitation) throw new Error("PHA invitation was not found.");
    if (invitation.status !== "pending") throw new Error("Only pending PHA invitations can be delivered.");
    if (new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error("PHA invitation has expired.");

    const [{ data: ownerProfile }, { data: staffRole }, { data: membership }] = await Promise.all([
      client.from("customer_workspace_profiles").select("user_id, organization_type").eq("user_id", invitation.workspace_user_id).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", requester.id).eq("role", "staff").maybeSingle(),
      client.from("pha_workspace_memberships").select("agency_role, active").eq("workspace_user_id", invitation.workspace_user_id).eq("member_user_id", requester.id).eq("active", true).maybeSingle(),
    ]);

    const requesterIsOwner = ownerProfile?.organization_type === "pha" && ownerProfile.user_id === requester.id;
    const requesterIsStaff = staffRole?.role === "staff";
    const requesterIsAgencyAdmin = membership?.agency_role === "agency_admin";
    if (!requesterIsOwner && !requesterIsStaff && !requesterIsAgencyAdmin) {
      throw new Error("You are not authorized to deliver this PHA invitation.");
    }

    const attemptedAt = new Date().toISOString();
    await client.from("pha_workspace_invitations").update({
      delivery_attempted_at: attemptedAt,
      delivery_attempt_count: Number(invitation.delivery_attempt_count ?? 0) + 1,
      delivery_error: null,
    }).eq("id", invitation.id);

    try {
      const result = await sendTemplateEmail("pha-workspace-invitation", invitation.invite_email, {
        templateData: {
          role: invitation.agency_role,
          expiresOn: new Date(invitation.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          dashboardUrl: "https://certivoiq.com/dashboard",
        },
        idempotencyKey: `pha-workspace-invitation-${invitation.id}`,
      });

      if (!result.sent) {
        await client.from("pha_workspace_invitations").update({
          delivery_status: "suppressed",
          delivery_error: result.reason,
        }).eq("id", invitation.id);
        return { sent: false as const, status: "suppressed" as const };
      }

      await client.from("pha_workspace_invitations").update({
        delivery_status: "sent",
        delivered_at: new Date().toISOString(),
        delivery_error: null,
      }).eq("id", invitation.id);
      return { sent: true as const, status: "sent" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Invitation email delivery failed";
      await client.from("pha_workspace_invitations").update({
        delivery_status: "failed",
        delivery_error: message,
      }).eq("id", invitation.id);
      throw error;
    }
  });
