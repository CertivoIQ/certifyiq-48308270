/**
 * Agency membership provisioning — invitation based, never domain based.
 *
 * Platform staff create production agencies and invite the first agency
 * administrator. Agency administrators may only invite people into their own
 * agency. Invitations are single-use, expire, and every provisioning action is
 * written to the append-only audit log. Email-domain matching NEVER grants
 * membership: a membership row is created only when an invited, signed-in user
 * redeems a valid token.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AgencyRole = "agency_admin" | "rule_reviewer" | "monitor" | "read_only";
const ROLES: AgencyRole[] = ["agency_admin", "rule_reviewer", "monitor", "read_only"];
const INVITE_TTL_HOURS = 72;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Random single-use token; only its SHA-256 hash is stored. */
async function mintToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return { token, tokenHash: await sha256Hex(token) };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function isPlatformStaff(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" });
  return data === true;
}

async function audit(entry: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("hfa_audit_events").insert(entry as never);
}

/* --------------------------------------------------------------- platform staff */

/** Platform staff create production agencies. Demo agencies stay flagged. */
export const createAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; stateCode: string; authorityScope?: string[] }) => {
    if (!data?.name?.trim()) throw new Error("An agency name is required.");
    if (!/^[A-Za-z]{2}$/.test(data.stateCode ?? "")) throw new Error("A two-letter state code is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    if (!(await isPlatformStaff(context))) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("hfa_agencies")
      .insert({
        name: data.name.trim(),
        state_code: data.stateCode.toUpperCase(),
        authority_scope: (data.authorityScope ?? []) as never,
        is_demo: false,
      })
      .select("id, name, state_code, is_demo")
      .single();
    if (error) throw error;
    await audit({
      actor_id: context.userId,
      actor_kind: "platform",
      agency_id: row.id,
      action: "agency.created",
      detail: { name: row.name, stateCode: row.state_code },
    });
    return row;
  });

/* ------------------------------------------------------------------ invitations */

/**
 * Platform staff may invite an agency administrator to any production agency.
 * An agency administrator may invite anyone into their own agency only.
 */
export const inviteAgencyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agencyId: string; email: string; role: AgencyRole }) => {
    if (!data?.agencyId) throw new Error("An agency is required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email ?? "")) throw new Error("A valid email address is required.");
    if (!ROLES.includes(data.role)) throw new Error("Choose a valid agency role.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const staff = await isPlatformStaff(context);
    let isAgencyAdmin = false;
    if (!staff) {
      const { data: allowed } = await context.supabase.rpc("has_agency_role", {
        _agency_id: data.agencyId,
        _user_id: context.userId,
        _roles: ["agency_admin"],
      });
      isAgencyAdmin = allowed === true;
    }
    if (!staff && !isAgencyAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("hfa_agencies")
      .select("id, name, is_demo")
      .eq("id", data.agencyId)
      .maybeSingle();
    if (agencyError) throw agencyError;
    if (!agency) throw new Response("Not found", { status: 404 });

    const email = normalizeEmail(data.email);
    const { token, tokenHash } = await mintToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000).toISOString();

    // Supersede any still-open invitation for the same address.
    await supabaseAdmin
      .from("hfa_agency_invitations")
      .update({ revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("agency_id", data.agencyId)
      .ilike("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const { data: invite, error } = await supabaseAdmin
      .from("hfa_agency_invitations")
      .insert({
        agency_id: data.agencyId,
        email,
        role: data.role,
        token_hash: tokenHash,
        invited_by: context.userId,
        expires_at: expiresAt,
        is_demo: agency.is_demo,
      })
      .select("id, agency_id, email, role, expires_at")
      .single();
    if (error) throw error;

    await audit({
      actor_id: context.userId,
      actor_kind: staff ? "platform" : "agency",
      agency_id: data.agencyId,
      action: "agency_membership.invited",
      detail: { invitationId: invite.id, email, role: data.role, expiresAt },
    });

    // The raw token is returned once so it can be delivered to the invitee.
    return { invitation: invite, token, expiresAt } as const;
  });

export const listAgencyInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agencyId: string }) => {
    if (!data?.agencyId) throw new Error("An agency is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    // RLS restricts this to agency administrators of that agency (or staff).
    const { data: rows, error } = await context.supabase
      .from("hfa_agency_invitations")
      .select("id, email, role, expires_at, accepted_at, revoked_at, created_at")
      .eq("agency_id", data.agencyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const revokeAgencyInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invitationId: string }) => {
    if (!data?.invitationId) throw new Error("An invitation is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase
      .from("hfa_agency_invitations")
      .select("id, agency_id")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (error) throw error;
    if (!invite) throw new Response("Not found", { status: 404 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("hfa_agency_invitations")
      .update({ revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("id", invite.id)
      .is("accepted_at", null);

    await audit({
      actor_id: context.userId,
      actor_kind: "agency",
      agency_id: invite.agency_id,
      action: "agency_membership.invitation_revoked",
      detail: { invitationId: invite.id },
    });
    return { ok: true } as const;
  });

/** Redeeming an invitation is the only way a membership row is created. */
export const acceptAgencyInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    if (!/^[a-f0-9]{64}$/i.test(data?.token ?? "")) throw new Error("That invitation link is not valid.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await sha256Hex(data.token.toLowerCase());

    const { data: invite, error } = await supabaseAdmin
      .from("hfa_agency_invitations")
      .select("id, agency_id, email, role, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return { error: "That invitation is not valid." } as const;
    if (invite.revoked_at) return { error: "That invitation was revoked." } as const;
    if (invite.accepted_at) return { error: "That invitation has already been used." } as const;
    if (Date.parse(invite.expires_at) < Date.now()) return { error: "That invitation has expired." } as const;

    const { data: viewer } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const viewerEmail = normalizeEmail(viewer?.user?.email ?? "");
    if (!viewerEmail || viewerEmail !== normalizeEmail(invite.email)) {
      return { error: "Sign in with the invited email address to accept this invitation." } as const;
    }

    const now = new Date().toISOString();
    // Single use: claim the invitation first, then create the membership.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("hfa_agency_invitations")
      .update({ accepted_at: now, accepted_by: context.userId })
      .eq("id", invite.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return { error: "That invitation has already been used." } as const;

    const { error: memberError } = await supabaseAdmin.from("hfa_agency_memberships").upsert(
      {
        agency_id: invite.agency_id,
        user_id: context.userId,
        role: invite.role,
        invited_by: null,
        invited_at: now,
        suspended_at: null,
        suspended_by: null,
      },
      { onConflict: "agency_id,user_id" },
    );
    if (memberError) throw memberError;

    await audit({
      actor_id: context.userId,
      actor_kind: "agency",
      agency_id: invite.agency_id,
      action: "agency_membership.accepted",
      detail: { invitationId: invite.id, role: invite.role },
    });
    return { ok: true, agencyId: invite.agency_id, role: invite.role } as const;
  });

/* ------------------------------------------------------------------ membership */

export const listAgencyMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agencyId: string }) => {
    if (!data?.agencyId) throw new Error("An agency is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const staff = await isPlatformStaff(context);
    if (!staff) {
      const { data: allowed } = await context.supabase.rpc("has_agency_role", {
        _agency_id: data.agencyId,
        _user_id: context.userId,
        _roles: ["agency_admin"],
      });
      if (allowed !== true) throw new Response("Forbidden", { status: 403 });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("hfa_agency_memberships")
      .select("user_id, role, suspended_at, invited_at, created_at, profiles:user_id(email, full_name)")
      .eq("agency_id", data.agencyId);
    if (error) throw error;
    return (rows ?? []).map((r) => {
      const p = r.profiles as unknown as { email: string | null; full_name: string | null } | null;
      return {
        userId: r.user_id,
        role: r.role as AgencyRole,
        email: p?.email ?? null,
        fullName: p?.full_name ?? null,
        suspendedAt: r.suspended_at,
        joinedAt: r.created_at,
      };
    });
  });

/** Role change, suspension, reinstatement and removal — all audited. */
export const updateAgencyMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agencyId: string; userId: string; action: "set_role" | "suspend" | "reinstate" | "remove"; role?: AgencyRole; reason?: string }) => {
    if (!data?.agencyId || !data.userId) throw new Error("An agency and member are required.");
    if (!["set_role", "suspend", "reinstate", "remove"].includes(data.action)) throw new Error("Unsupported action.");
    if (data.action === "set_role" && !ROLES.includes(data.role as AgencyRole)) throw new Error("Choose a valid agency role.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const staff = await isPlatformStaff(context);
    if (!staff) {
      const { data: allowed } = await context.supabase.rpc("has_agency_role", {
        _agency_id: data.agencyId,
        _user_id: context.userId,
        _roles: ["agency_admin"],
      });
      if (allowed !== true) throw new Response("Forbidden", { status: 403 });
    }
    if (data.userId === context.userId && data.action !== "set_role") {
      return { error: "Ask another administrator to change your own access." } as const;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    if (data.action === "remove") {
      const { error } = await supabaseAdmin
        .from("hfa_agency_memberships")
        .delete()
        .eq("agency_id", data.agencyId)
        .eq("user_id", data.userId);
      if (error) throw error;
    } else {
      const patch =
        data.action === "set_role"
          ? { role: data.role as string }
          : data.action === "suspend"
            ? { suspended_at: now, suspended_by: context.userId }
            : { suspended_at: null, suspended_by: null };
      const { error } = await supabaseAdmin
        .from("hfa_agency_memberships")
        .update(patch as never)
        .eq("agency_id", data.agencyId)
        .eq("user_id", data.userId);
      if (error) throw error;
    }

    await audit({
      actor_id: context.userId,
      actor_kind: staff ? "platform" : "agency",
      agency_id: data.agencyId,
      action: `agency_membership.${data.action}`,
      detail: { targetUserId: data.userId, role: data.role ?? null, reason: data.reason ?? null },
    });
    return { ok: true } as const;
  });
