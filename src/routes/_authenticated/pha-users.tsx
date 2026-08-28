import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pha-users")({
  head: () => ({ meta: [{ title: "PHA Users & Permissions — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PhaUsers,
});

type Membership = {
  id: string;
  workspace_user_id: string;
  member_user_id: string;
  agency_role: string;
  active: boolean;
  created_at: string;
};

type Invitation = {
  id: string;
  invite_email: string;
  agency_role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

const roles = [
  ["executive", "Executive — read-only family/compliance oversight"],
  ["agency_admin", "Agency Admin — full agency administration"],
  ["compliance_admin", "Compliance Admin — full compliance operations"],
  ["hcv_pbv_specialist", "HCV/PBV Specialist — HCV, PBV & Mod Rehab"],
  ["public_housing_specialist", "Public Housing Specialist — Public Housing"],
  ["inspection_staff", "Inspection Staff — NSPIRE/inspection workflow only"],
] as const;

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function PhaUsers() {
  const { workspaceUserId, phaRole } = useWorkspaceProfile();
  const queryClient = useQueryClient();
  const [invite, setInvite] = useState({ email: "", role: "hcv_pbv_specialist" });
  const canAdmin = phaRole === "workspace_owner" || phaRole === "agency_admin";

  const query = useQuery<{ memberships: Membership[]; invitations: Invitation[] }>({
    queryKey: ["pha-users", workspaceUserId],
    enabled: !!workspaceUserId && canAdmin,
    queryFn: async () => {
      // Generated Supabase types lag the PHA invitation migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [memberships, invitations] = await Promise.all([
        client.from("pha_workspace_memberships").select("id, workspace_user_id, member_user_id, agency_role, active, created_at").eq("workspace_user_id", workspaceUserId).order("created_at"),
        client.from("pha_workspace_invitations").select("id, invite_email, agency_role, status, expires_at, created_at").eq("workspace_user_id", workspaceUserId).order("created_at", { ascending: false }),
      ]);
      if (memberships.error) throw memberships.error;
      if (invitations.error) throw invitations.error;
      return { memberships: memberships.data ?? [], invitations: invitations.data ?? [] };
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!workspaceUserId) throw new Error("PHA workspace is not resolved.");
      const email = invite.email.trim().toLowerCase();
      if (!email.includes("@")) throw new Error("Enter a valid email address.");
      if (phaRole === "agency_admin" && invite.role === "agency_admin") throw new Error("Only the workspace owner can assign another Agency Admin.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_workspace_invitations").insert({ workspace_user_id: workspaceUserId, invite_email: email, agency_role: invite.role });
      if (error) throw error;
    },
    onSuccess: async () => {
      setInvite({ email: "", role: "hcv_pbv_specialist" });
      await queryClient.invalidateQueries({ queryKey: ["pha-users", workspaceUserId] });
    },
  });

  const setMembershipActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_workspace_memberships").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-users", workspaceUserId] }),
  });

  const revokeInvitation = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_workspace_invitations").update({ status: "revoked" }).eq("id", id).eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-users", workspaceUserId] }),
  });

  const memberships = query.data?.memberships ?? [];
  const invitations = query.data?.invitations ?? [];
  const pending = useMemo(() => invitations.filter((row) => row.status === "pending" && new Date(row.expires_at).getTime() > Date.now()), [invitations]);

  if (!canAdmin) {
    return <AppShell title="Users & Permissions" subtitle="PHA agency team administration"><Panel title="Restricted" description="Only the PHA workspace owner or Agency Admin can manage agency users and invitations." /></AppShell>;
  }

  return (
    <AppShell title="Users & Permissions" subtitle="Invite agency users, assign operational roles, and deactivate access without changing historical audit records">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Active members" value={memberships.filter((row) => row.active).length} hint="Agency users with current access" />
        <Stat label="Pending invitations" value={pending.length} hint="Email-bound invitations awaiting acceptance" />
        <Stat label="Inactive members" value={memberships.filter((row) => !row.active).length} hint="Access disabled; history retained" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
        <Panel title="Invite agency user" description="Invitations expire after seven days and can only be accepted by the matching authenticated email address.">
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); createInvite.mutate(); }}>
            <label className="block text-xs font-medium">Email address<input type="email" className={inputClass} value={invite.email} onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))} placeholder="name@housingauthority.gov" /></label>
            <label className="block text-xs font-medium">Agency role<select className={inputClass} value={invite.role} onChange={(event) => setInvite((value) => ({ ...value, role: event.target.value }))}>{roles.map(([value, label]) => <option key={value} value={value} disabled={phaRole === "agency_admin" && value === "agency_admin"}>{label}</option>)}</select></label>
            <button type="submit" disabled={createInvite.isPending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{createInvite.isPending ? "Creating invitation…" : "Create secure invitation"}</button>
            {createInvite.isError ? <p className="text-xs text-destructive">{createInvite.error instanceof Error ? createInvite.error.message : "Unable to create invitation."}</p> : null}
          </form>
        </Panel>

        <Panel title="Agency members" description="Role changes are governed by database RLS; deactivation preserves the member's prior audit trail.">
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Member</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr></thead><tbody>{memberships.map((member) => <tr key={member.id} className="border-t border-border"><td className="py-3 pr-3 font-mono text-xs">{member.member_user_id}</td><td className="py-3 pr-3">{member.agency_role.replaceAll("_", " ")}</td><td className="py-3 pr-3"><Pill tone={member.active ? "seal" : undefined}>{member.active ? "Active" : "Inactive"}</Pill></td><td className="py-3"><button type="button" className="text-xs font-semibold underline underline-offset-4" onClick={() => setMembershipActive.mutate({ id: member.id, active: !member.active })}>{member.active ? "Deactivate" : "Reactivate"}</button></td></tr>)}</tbody></table></div>
          {!memberships.length ? <p className="py-6 text-sm text-muted-foreground">No additional agency members yet.</p> : null}
        </Panel>
      </div>

      <Panel className="mt-4" title="Invitation history" description="Pending invitations may be revoked. Accepted, expired, and revoked records remain available for audit history.">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Email</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">Expires</th><th className="pb-3">Action</th></tr></thead><tbody>{invitations.map((row) => <tr key={row.id} className="border-t border-border"><td className="py-3 pr-3">{row.invite_email}</td><td className="py-3 pr-3">{row.agency_role.replaceAll("_", " ")}</td><td className="py-3 pr-3"><Pill tone={row.status === "accepted" ? "seal" : undefined}>{row.status}</Pill></td><td className="py-3 pr-3 font-mono text-xs">{new Date(row.expires_at).toLocaleDateString()}</td><td className="py-3">{row.status === "pending" ? <button type="button" onClick={() => revokeInvitation.mutate(row.id)} className="text-xs font-semibold underline underline-offset-4">Revoke</button> : "—"}</td></tr>)}</tbody></table></div>
      </Panel>
    </AppShell>
  );
}
