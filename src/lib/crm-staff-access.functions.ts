import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ accessToken: z.string().min(20) });
const accessLevelSchema = z.enum(["employee", "manager", "admin"]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    accessToken: z.string().min(20),
    email: z.string().email(),
    accessLevel: accessLevelSchema,
  }),
  z.object({
    action: z.enum(["resend", "revoke"]),
    accessToken: z.string().min(20),
    invitationId: z.string().uuid(),
  }),
  z.object({
    action: z.enum(["disable", "reactivate"]),
    accessToken: z.string().min(20),
    targetUserId: z.string().uuid(),
  }),
]);

type AccessLevel = z.infer<typeof accessLevelSchema>;

async function requireCrmStaffManager(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Generated types lag the staff access migration until schema types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  const requester = authData.user;
  if (authError || !requester) throw new Error("Authenticated CertivoIQ staff access is required.");

  const { data: authority, error } = await client
    .from("crm_staff_access")
    .select("access_level,status")
    .eq("user_id", requester.id)
    .maybeSingle();
  if (error) throw error;
  if (
    authority?.status !== "active" ||
    !["manager", "admin"].includes(authority?.access_level)
  ) {
    throw new Error("Only an active CertivoIQ administrator or manager can manage staff access.");
  }

  return {
    client,
    supabaseAdmin,
    requester,
    requesterLevel: authority.access_level as "manager" | "admin",
  };
}

function assertCanAssign(requesterLevel: "manager" | "admin", accessLevel: AccessLevel) {
  if (requesterLevel === "manager" && accessLevel !== "employee") {
    throw new Error("Managers may invite employees. Administrator access is required to assign manager or administrator roles.");
  }
}

async function writeEvent(
  // Generated types lag the staff access migration until schema types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  input: {
    actorId: string;
    eventType: string;
    accessLevel?: AccessLevel;
    targetUserId?: string | null;
    invitationId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await client.from("crm_staff_access_events").insert({
    actor_id: input.actorId,
    target_user_id: input.targetUserId ?? null,
    invitation_id: input.invitationId ?? null,
    event_type: input.eventType,
    access_level: input.accessLevel ?? null,
    detail: input.detail ?? {},
  });
  if (error) throw error;
}

export const listCrmStaffAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { client, requesterLevel } = await requireCrmStaffManager(data.accessToken);
    const [{ data: accessRows, error: accessError }, { data: invitations, error: invitationError }] =
      await Promise.all([
        client
          .from("crm_staff_access")
          .select("user_id,access_level,status,granted_at,disabled_at,updated_at")
          .order("granted_at", { ascending: true }),
        client
          .from("crm_staff_invitations")
          .select("id,invite_email,access_level,status,expires_at,accepted_at,delivery_status,delivery_attempt_count,delivery_attempted_at,delivered_at,delivery_error,created_at,auth_user_id")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
    if (accessError) throw accessError;
    if (invitationError) throw invitationError;

    const userIds = (accessRows ?? []).map((row: { user_id: string }) => row.user_id);
    const { data: profiles, error: profileError } = userIds.length
      ? await client.from("profiles").select("id,email,full_name").in("id", userIds)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const profileById = new Map(
      (profiles ?? []).map((profile: { id: string; email: string | null; full_name: string | null }) => [
        profile.id,
        profile,
      ]),
    );

    return {
      requesterLevel,
      members: (accessRows ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        email: profileById.get(String(row["user_id"]))?.email ?? null,
        fullName: profileById.get(String(row["user_id"]))?.full_name ?? null,
      })),
      invitations: invitations ?? [],
    };
  });

export const manageCrmStaffAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => actionSchema.parse(data))
  .handler(async ({ data }) => {
    const { client, supabaseAdmin, requester, requesterLevel } =
      await requireCrmStaffManager(data.accessToken);

    if (data.action === "invite") {
      const email = data.email.trim().toLowerCase();
      if (email.split("@")[1] !== "certivoiq.com") {
        throw new Error("CRM invitations require a @certivoiq.com employee address.");
      }
      assertCanAssign(requesterLevel, data.accessLevel);

      const { data: existingPending } = await client
        .from("crm_staff_invitations")
        .select("id")
        .eq("invite_email", email)
        .eq("status", "pending")
        .maybeSingle();
      if (existingPending) {
        throw new Error("A pending invitation already exists for this address. Use Resend instead.");
      }

      const { data: invitation, error: invitationError } = await client
        .from("crm_staff_invitations")
        .insert({
          invite_email: email,
          access_level: data.accessLevel,
          invited_by: requester.id,
          delivery_attempt_count: 1,
          delivery_attempted_at: new Date().toISOString(),
        })
        .select("id,expires_at")
        .single();
      if (invitationError || !invitation) {
        throw invitationError ?? new Error("CRM staff invitation was not created.");
      }

      await writeEvent(client, {
        actorId: requester.id,
        invitationId: invitation.id,
        eventType: "invited",
        accessLevel: data.accessLevel,
        detail: { invite_email: email },
      });

      const { data: profile } = await client
        .from("profiles")
        .select("id,email")
        .eq("email", email)
        .maybeSingle();

      if (profile?.id) {
        const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        if (existingAuth.user?.email_confirmed_at) {
          await Promise.all([
            client.from("user_roles").upsert(
              { user_id: profile.id, role: "staff" },
              { onConflict: "user_id,role" },
            ),
            client.from("crm_staff_access").upsert(
              {
                user_id: profile.id,
                access_level: data.accessLevel,
                status: "active",
                granted_by: requester.id,
                granted_at: new Date().toISOString(),
                disabled_by: null,
                disabled_at: null,
              },
              { onConflict: "user_id" },
            ),
          ]);
          await client
            .from("crm_staff_invitations")
            .update({
              status: "accepted",
              auth_user_id: profile.id,
              accepted_at: new Date().toISOString(),
              delivery_status: "suppressed",
              delivery_error: "Existing verified account activated; no invitation email required.",
            })
            .eq("id", invitation.id);
          await writeEvent(client, {
            actorId: requester.id,
            targetUserId: profile.id,
            invitationId: invitation.id,
            eventType: "activated",
            accessLevel: data.accessLevel,
            detail: { existing_verified_account: true },
          });
          return { status: "activated" as const, invitationId: invitation.id };
        }

        const { error: resendError } = await supabaseAdmin.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: "https://certivoiq.com/reset-password" },
        });
        if (resendError) {
          await client
            .from("crm_staff_invitations")
            .update({ delivery_status: "failed", delivery_error: resendError.message })
            .eq("id", invitation.id);
          throw resendError;
        }
        await client
          .from("crm_staff_invitations")
          .update({
            auth_user_id: profile.id,
            delivery_status: "sent",
            delivered_at: new Date().toISOString(),
            delivery_error: null,
          })
          .eq("id", invitation.id);
        return { status: "sent" as const, invitationId: invitation.id };
      }

      const { data: invited, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: "https://certivoiq.com/reset-password",
          data: { crm_staff_invitation_id: invitation.id },
        });
      if (inviteError) {
        await client
          .from("crm_staff_invitations")
          .update({ delivery_status: "failed", delivery_error: inviteError.message })
          .eq("id", invitation.id);
        throw inviteError;
      }

      await client
        .from("crm_staff_invitations")
        .update({
          auth_user_id: invited.user?.id ?? null,
          delivery_status: "sent",
          delivered_at: new Date().toISOString(),
          delivery_error: null,
        })
        .eq("id", invitation.id);
      return { status: "sent" as const, invitationId: invitation.id };
    }

    if (data.action === "resend" || data.action === "revoke") {
      const { data: invitation, error } = await client
        .from("crm_staff_invitations")
        .select("id,invite_email,access_level,status,expires_at,auth_user_id,delivery_attempt_count")
        .eq("id", data.invitationId)
        .single();
      if (error || !invitation) throw error ?? new Error("CRM staff invitation was not found.");
      if (invitation.status !== "pending") {
        throw new Error("Only pending CRM staff invitations can be changed.");
      }
      assertCanAssign(requesterLevel, invitation.access_level as AccessLevel);

      if (data.action === "revoke") {
        await client
          .from("crm_staff_invitations")
          .update({
            status: "revoked",
            revoked_by: requester.id,
            revoked_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);
        await writeEvent(client, {
          actorId: requester.id,
          targetUserId: invitation.auth_user_id,
          invitationId: invitation.id,
          eventType: "revoked",
          accessLevel: invitation.access_level,
        });
        return { status: "revoked" as const };
      }

      if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        await client.from("crm_staff_invitations").update({ status: "expired" }).eq("id", invitation.id);
        throw new Error("This invitation has expired. Create a new invitation.");
      }

      const attemptedAt = new Date().toISOString();
      const { error: resendError } = await supabaseAdmin.auth.resend({
        type: "signup",
        email: invitation.invite_email,
        options: { emailRedirectTo: "https://certivoiq.com/reset-password" },
      });
      await client
        .from("crm_staff_invitations")
        .update({
          delivery_attempt_count: Number(invitation.delivery_attempt_count ?? 0) + 1,
          delivery_attempted_at: attemptedAt,
          delivery_status: resendError ? "failed" : "sent",
          delivered_at: resendError ? null : attemptedAt,
          delivery_error: resendError?.message ?? null,
        })
        .eq("id", invitation.id);
      if (resendError) throw resendError;

      await writeEvent(client, {
        actorId: requester.id,
        targetUserId: invitation.auth_user_id,
        invitationId: invitation.id,
        eventType: "resent",
        accessLevel: invitation.access_level,
      });
      return { status: "sent" as const };
    }

    const { data: target, error: targetError } = await client
      .from("crm_staff_access")
      .select("user_id,access_level,status")
      .eq("user_id", data.targetUserId)
      .single();
    if (targetError || !target) throw targetError ?? new Error("CRM staff member was not found.");
    if (target.user_id === requester.id) {
      throw new Error("You cannot change your own CRM access.");
    }
    assertCanAssign(requesterLevel, target.access_level as AccessLevel);

    if (data.action === "disable") {
      await Promise.all([
        client.from("crm_staff_access").update({
          status: "disabled",
          disabled_by: requester.id,
          disabled_at: new Date().toISOString(),
        }).eq("user_id", target.user_id),
        client.from("user_roles").delete().eq("user_id", target.user_id).eq("role", "staff"),
      ]);
      await writeEvent(client, {
        actorId: requester.id,
        targetUserId: target.user_id,
        eventType: "deactivated",
        accessLevel: target.access_level,
      });
      return { status: "disabled" as const };
    }

    await Promise.all([
      client.from("crm_staff_access").update({
        status: "active",
        disabled_by: null,
        disabled_at: null,
      }).eq("user_id", target.user_id),
      client.from("user_roles").upsert(
        { user_id: target.user_id, role: "staff" },
        { onConflict: "user_id,role" },
      ),
    ]);
    await writeEvent(client, {
      actorId: requester.id,
      targetUserId: target.user_id,
      eventType: "activated",
      accessLevel: target.access_level,
    });
    return { status: "active" as const };
  });
