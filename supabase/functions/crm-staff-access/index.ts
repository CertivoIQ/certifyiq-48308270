import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type AccessLevel = "employee" | "manager" | "admin";

const APP_ORIGIN = "https://certivoiq.com";
const allowedOrigins = new Set([APP_ORIGIN, "https://www.certivoiq.com"]);

function headers(origin: string | null) {
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : APP_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validLevel(value: unknown): value is AccessLevel {
  return value === "employee" || value === "manager" || value === "admin";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return json(origin, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is unavailable.");

    const authorization = req.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json(origin, { error: "Authenticated CertivoIQ staff access is required." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const requester = authData.user;
    if (authError || !requester || !requester.email_confirmed_at) {
      return json(origin, { error: "Authenticated CertivoIQ staff access is required." }, 401);
    }

    const { data: authority, error: authorityError } = await admin
      .from("crm_staff_access")
      .select("access_level,status")
      .eq("user_id", requester.id)
      .maybeSingle();
    if (authorityError) throw authorityError;
    const requesterLevel = authority?.status === "active" ? authority.access_level as AccessLevel : null;
    if (requesterLevel !== "manager" && requesterLevel !== "admin") {
      return json(origin, { error: "Only an active CertivoIQ administrator or manager can manage staff access." }, 403);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action;

    const assertCanAssign = (level: AccessLevel) => {
      if (requesterLevel === "manager" && level !== "employee") {
        throw new Error("Managers may invite employees. Administrator access is required to assign manager or administrator roles.");
      }
    };

    const writeEvent = async (input: {
      eventType: string;
      accessLevel?: AccessLevel | null;
      targetUserId?: string | null;
      invitationId?: string | null;
      detail?: Record<string, unknown>;
    }) => {
      const { error } = await admin.from("crm_staff_access_events").insert({
        actor_id: requester.id,
        target_user_id: input.targetUserId || null,
        invitation_id: input.invitationId || null,
        event_type: input.eventType,
        access_level: input.accessLevel || null,
        detail: input.detail || {},
      });
      if (error) throw error;
    };

    if (action === "list") {
      const [{ data: accessRows, error: accessError }, { data: invitations, error: invitationError }] = await Promise.all([
        admin.from("crm_staff_access").select("user_id,access_level,status,granted_at,disabled_at,updated_at").order("granted_at"),
        admin.from("crm_staff_invitations").select("id,invite_email,access_level,status,expires_at,accepted_at,delivery_status,delivery_attempt_count,delivery_attempted_at,delivered_at,delivery_error,created_at,auth_user_id").order("created_at", { ascending: false }).limit(200),
      ]);
      if (accessError) throw accessError;
      if (invitationError) throw invitationError;

      const userIds = (accessRows || []).map((row) => row.user_id);
      const { data: profiles, error: profileError } = userIds.length
        ? await admin.from("profiles").select("id,email,full_name").in("id", userIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

      return json(origin, {
        requesterLevel,
        members: (accessRows || []).map((row) => ({
          ...row,
          email: profileById.get(row.user_id)?.email || null,
          fullName: profileById.get(row.user_id)?.full_name || null,
        })),
        invitations: invitations || [],
      });
    }

    if (action === "invite") {
      const email = cleanEmail(body.email);
      const accessLevel = body.accessLevel;
      if (!email || email.split("@")[1] !== "certivoiq.com") {
        throw new Error("CRM invitations require a @certivoiq.com employee address.");
      }
      if (!validLevel(accessLevel)) throw new Error("Select a valid CRM role.");
      assertCanAssign(accessLevel);

      const { data: existingPending } = await admin.from("crm_staff_invitations")
        .select("id").eq("invite_email", email).eq("status", "pending").maybeSingle();
      if (existingPending) throw new Error("A pending invitation already exists for this address. Use Resend instead.");

      const attemptedAt = new Date().toISOString();
      const { data: invitation, error: invitationError } = await admin.from("crm_staff_invitations")
        .insert({ invite_email: email, access_level: accessLevel, invited_by: requester.id, delivery_attempt_count: 1, delivery_attempted_at: attemptedAt })
        .select("id,expires_at").single();
      if (invitationError || !invitation) throw invitationError || new Error("CRM staff invitation was not created.");

      await writeEvent({ eventType: "invited", invitationId: invitation.id, accessLevel, detail: { invite_email: email } });

      const { data: profile } = await admin.from("profiles").select("id,email").eq("email", email).maybeSingle();
      if (profile?.id) {
        const { data: existingAuth } = await admin.auth.admin.getUserById(profile.id);
        if (existingAuth.user?.email_confirmed_at) {
          const now = new Date().toISOString();
          const results = await Promise.all([
            admin.from("user_roles").upsert({ user_id: profile.id, role: "staff" }, { onConflict: "user_id,role" }),
            admin.from("crm_staff_access").upsert({ user_id: profile.id, access_level: accessLevel, status: "active", granted_by: requester.id, granted_at: now, disabled_by: null, disabled_at: null }, { onConflict: "user_id" }),
          ]);
          for (const result of results) if (result.error) throw result.error;
          const { error: updateError } = await admin.from("crm_staff_invitations").update({ status: "accepted", auth_user_id: profile.id, accepted_at: now, delivery_status: "suppressed", delivery_error: "Existing verified account activated; no invitation email required." }).eq("id", invitation.id);
          if (updateError) throw updateError;
          await writeEvent({ eventType: "activated", targetUserId: profile.id, invitationId: invitation.id, accessLevel, detail: { existing_verified_account: true } });
          return json(origin, { status: "activated", invitationId: invitation.id });
        }

        const { error: resendError } = await admin.auth.resend({ type: "signup", email, options: { emailRedirectTo: APP_ORIGIN + "/reset-password" } });
        const { error: updateError } = await admin.from("crm_staff_invitations").update({ auth_user_id: profile.id, delivery_status: resendError ? "failed" : "sent", delivered_at: resendError ? null : attemptedAt, delivery_error: resendError?.message || null }).eq("id", invitation.id);
        if (updateError) throw updateError;
        if (resendError) throw resendError;
        return json(origin, { status: "sent", invitationId: invitation.id });
      }

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: APP_ORIGIN + "/reset-password",
        data: { crm_staff_invitation_id: invitation.id },
      });
      const { error: deliveryUpdateError } = await admin.from("crm_staff_invitations").update({
        auth_user_id: invited.user?.id || null,
        delivery_status: inviteError ? "failed" : "sent",
        delivered_at: inviteError ? null : attemptedAt,
        delivery_error: inviteError?.message || null,
      }).eq("id", invitation.id);
      if (deliveryUpdateError) throw deliveryUpdateError;
      if (inviteError) throw inviteError;
      return json(origin, { status: "sent", invitationId: invitation.id });
    }

    if (action === "resend" || action === "revoke") {
      const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
      const { data: invitation, error } = await admin.from("crm_staff_invitations")
        .select("id,invite_email,access_level,status,expires_at,auth_user_id,delivery_attempt_count")
        .eq("id", invitationId).single();
      if (error || !invitation) throw error || new Error("CRM staff invitation was not found.");
      if (invitation.status !== "pending") throw new Error("Only pending CRM staff invitations can be changed.");
      const level = invitation.access_level as AccessLevel;
      assertCanAssign(level);

      if (action === "revoke") {
        const { error: revokeError } = await admin.from("crm_staff_invitations").update({ status: "revoked", revoked_by: requester.id, revoked_at: new Date().toISOString() }).eq("id", invitation.id);
        if (revokeError) throw revokeError;
        await writeEvent({ eventType: "revoked", targetUserId: invitation.auth_user_id, invitationId: invitation.id, accessLevel: level });
        return json(origin, { status: "revoked" });
      }

      if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        await admin.from("crm_staff_invitations").update({ status: "expired" }).eq("id", invitation.id);
        throw new Error("This invitation has expired. Create a new invitation.");
      }
      const attemptedAt = new Date().toISOString();
      const { error: resendError } = await admin.auth.resend({ type: "signup", email: invitation.invite_email, options: { emailRedirectTo: APP_ORIGIN + "/reset-password" } });
      const { error: updateError } = await admin.from("crm_staff_invitations").update({ delivery_attempt_count: Number(invitation.delivery_attempt_count || 0) + 1, delivery_attempted_at: attemptedAt, delivery_status: resendError ? "failed" : "sent", delivered_at: resendError ? null : attemptedAt, delivery_error: resendError?.message || null }).eq("id", invitation.id);
      if (updateError) throw updateError;
      if (resendError) throw resendError;
      await writeEvent({ eventType: "resent", targetUserId: invitation.auth_user_id, invitationId: invitation.id, accessLevel: level });
      return json(origin, { status: "sent" });
    }

    if (action === "disable" || action === "reactivate") {
      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
      const { data: target, error } = await admin.from("crm_staff_access").select("user_id,access_level,status").eq("user_id", targetUserId).single();
      if (error || !target) throw error || new Error("CRM staff member was not found.");
      if (target.user_id === requester.id) throw new Error("You cannot change your own CRM access.");
      const level = target.access_level as AccessLevel;
      assertCanAssign(level);

      if (action === "disable") {
        const now = new Date().toISOString();
        const results = await Promise.all([
          admin.from("crm_staff_access").update({ status: "disabled", disabled_by: requester.id, disabled_at: now }).eq("user_id", target.user_id),
          admin.from("user_roles").delete().eq("user_id", target.user_id).eq("role", "staff"),
        ]);
        for (const result of results) if (result.error) throw result.error;
        await writeEvent({ eventType: "deactivated", targetUserId: target.user_id, accessLevel: level });
        return json(origin, { status: "disabled" });
      }

      const results = await Promise.all([
        admin.from("crm_staff_access").update({ status: "active", disabled_by: null, disabled_at: null }).eq("user_id", target.user_id),
        admin.from("user_roles").upsert({ user_id: target.user_id, role: "staff" }, { onConflict: "user_id,role" }),
      ]);
      for (const result of results) if (result.error) throw result.error;
      await writeEvent({ eventType: "activated", targetUserId: target.user_id, accessLevel: level });
      return json(origin, { status: "active" });
    }

    return json(origin, { error: "Unsupported Staff Access action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Staff Access request failed.";
    return json(origin, { error: message }, 400);
  }
});
