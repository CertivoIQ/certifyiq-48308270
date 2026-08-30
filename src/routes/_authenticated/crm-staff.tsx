import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MailPlus, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";

import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useCrmStaffAuthority, type CrmStaffAccessLevel } from "@/hooks/use-crm-staff-authority";
import { type PhaAgencyRole } from "@/hooks/use-workspace-profile";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { listCrmStaffAccess, manageCrmStaffAccess } from "@/lib/crm-staff-access.functions";
import { sendPhaWorkspaceInvitationEmail } from "@/lib/pha-invitation-email.functions";

export const Route = createFileRoute("/_authenticated/crm-staff")({
  head: () => ({
    meta: [
      { title: "CRM Staff Access — CertivoIQ" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmStaffAccessPage,
});

type Member = {
  user_id: string;
  access_level: CrmStaffAccessLevel;
  status: "active" | "disabled";
  granted_at: string;
  disabled_at: string | null;
  email: string | null;
  fullName: string | null;
};
type Invitation = {
  id: string;
  invite_email: string;
  access_level: CrmStaffAccessLevel;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at: string | null;
  delivery_status: "pending" | "sent" | "failed" | "suppressed";
  delivery_attempt_count: number;
  delivery_error: string | null;
  created_at: string;
};
type StaffAccessData = {
  requesterLevel: "manager" | "admin";
  members: Member[];
  invitations: Invitation[];
};
type PhaAssignableRole = Exclude<PhaAgencyRole, "workspace_owner">;
type AssignableRole = CrmStaffAccessLevel | PhaAssignableRole;
type PhaWorkspace = { user_id: string; pha_programs: string[] };

const phaRoles: { value: PhaAssignableRole; label: string }[] = [
  { value: "executive", label: "PHA Executive — read-only oversight" },
  { value: "agency_admin", label: "PHA Agency Administrator — full agency administration" },
  { value: "compliance_admin", label: "PHA Compliance Administrator — compliance operations" },
  { value: "hcv_pbv_specialist", label: "PHA HCV/PBV Specialist — HCV, PBV & Mod Rehab" },
  { value: "public_housing_specialist", label: "PHA Public Housing Specialist — Public Housing" },
  { value: "inspection_staff", label: "PHA Inspection Staff — NSPIRE/inspections" },
];

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

async function accessToken() {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Refresh your CertivoIQ session before managing staff access.");
  return token;
}

function accessLabel(level: CrmStaffAccessLevel) {
  if (level === "admin") return "Administrator";
  if (level === "manager") return "Manager";
  return "Employee";
}

function isPhaRole(role: AssignableRole): role is PhaAssignableRole {
  return phaRoles.some((option) => option.value === role);
}

function CrmStaffAccessPage() {
  const { isStaff, loading, email } = useIsStaff();
  const { canManageStaff, isCrmAdmin, loading: authorityLoading } = useCrmStaffAuthority();
  const queryClient = useQueryClient();
  const [invite, setInvite] = useState<{ email: string; role: AssignableRole; workspaceUserId: string }>({
    email: "",
    role: "employee",
    workspaceUserId: "",
  });

  const query = useQuery<StaffAccessData>({
    queryKey: ["crm", "staff-access"],
    enabled: isStaff && canManageStaff,
    queryFn: async () => listCrmStaffAccess({ data: { accessToken: await accessToken() } }),
    refetchInterval: 30_000,
  });

  const phaWorkspaces = useQuery<PhaWorkspace[]>({
    queryKey: ["crm", "pha-workspaces"],
    enabled: isStaff && isCrmAdmin,
    queryFn: async () => {
      // Generated Supabase types lag the PHA workspace migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("customer_workspace_profiles")
        .select("user_id,pha_programs")
        .eq("organization_type", "pha")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const action = useMutation({
    mutationFn: async (
      input:
        | { action: "invite"; email: string; role: AssignableRole; workspaceUserId: string }
        | { action: "resend" | "revoke"; invitationId: string }
        | { action: "disable" | "reactivate"; targetUserId: string },
    ) => {
      const token = await accessToken();
      if (input.action !== "invite") {
        return manageCrmStaffAccess({ data: { ...input, accessToken: token } });
      }
      if (!isPhaRole(input.role)) {
        return manageCrmStaffAccess({
          data: { action: "invite", email: input.email, accessLevel: input.role, accessToken: token },
        });
      }
      if (!isCrmAdmin) throw new Error("Administrator access is required to assign a PHA role.");
      if (!input.workspaceUserId) throw new Error("Select the PHA workspace this user will access.");

      // The existing PHA invitation lifecycle supplies the authoritative membership,
      // email binding, expiration, audit trail, and acceptance controls.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("pha_workspace_invitations")
        .insert({
          workspace_user_id: input.workspaceUserId,
          invite_email: input.email,
          agency_role: input.role,
        })
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("PHA invitation record was not created.");
      await sendPhaWorkspaceInvitationEmail({ data: { invitationId: data.id, accessToken: token } });
      return { status: "sent" as const, invitationId: data.id as string };
    },
    onSuccess: async (result) => {
      toast.success(
        result.status === "sent"
          ? "Invitation email sent"
          : result.status === "activated"
            ? "Existing account activated"
            : result.status === "revoked"
              ? "Invitation revoked"
              : result.status === "disabled"
                ? "CRM access deactivated"
                : "CRM access activated",
      );
      setInvite({ email: "", role: "employee", workspaceUserId: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "staff-access"] }),
        queryClient.invalidateQueries({ queryKey: ["crm", "pha-workspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-staff-authority"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Staff access action failed"),
  });

  const members = query.data?.members ?? [];
  const invitations = query.data?.invitations ?? [];
  const pending = useMemo(
    () =>
      invitations.filter(
        (row) => row.status === "pending" && new Date(row.expires_at).getTime() > Date.now(),
      ),
    [invitations],
  );

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading}>
      {authorityLoading ? (
        <Panel title="Staff Access" description="Checking administrator or manager authority…">
          <p className="text-sm text-muted-foreground">Loading access controls…</p>
        </Panel>
      ) : !canManageStaff ? (
        <Panel
          title="Administrator or manager access required"
          description="Employee accounts cannot invite, activate, or deactivate CRM users."
        >
          <p className="text-sm text-muted-foreground">
            Ask a CertivoIQ administrator to manage staff access.
          </p>
        </Panel>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-200">
              Internal access control
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-sans text-3xl font-semibold tracking-tight">
                  Staff Access
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-emerald-100/80">
                  Invite CertivoIQ employees, assign CRM authority, track acceptance, and deactivate access without removing historical evidence.
                </p>
              </div>
              <Pill tone="seal">{isCrmAdmin ? "Administrator" : "Manager"}</Pill>
            </div>
          </section>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat label="Active staff" value={members.filter((row) => row.status === "active").length} hint="Current CRM access" />
            <Stat label="Managers & administrators" value={members.filter((row) => row.status === "active" && row.access_level !== "employee").length} hint="Invitation authority" />
            <Stat label="Pending invitations" value={pending.length} hint="Expire after seven days" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(340px,0.7fr)_minmax(0,1.3fr)]">
            <Panel
              title="Invite a CertivoIQ employee or beta tester"
              description="Beta email policy: verified @certivoiq.com, Gmail, Outlook, Hotmail, and Live addresses may be invited. External domains will be removed before launch."
            >
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  action.mutate({
                    action: "invite",
                    email: invite.email.trim().toLowerCase(),
                    role: invite.role,
                    workspaceUserId: invite.workspaceUserId,
                  });
                }}
              >
                <label className="block text-xs font-medium">
                  Employee email
                  <input
                    type="email"
                    required
                    className={inputClass}
                    value={invite.email}
                    onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))}
                    placeholder="name@gmail.com or name@outlook.com"
                  />
                </label>
                <label className="block text-xs font-medium">
                  Account role
                  <select
                    className={inputClass}
                    value={invite.role}
                    onChange={(event) => {
                      const role = event.target.value as AssignableRole;
                      setInvite((value) => ({
                        ...value,
                        role,
                        workspaceUserId: isPhaRole(role) ? value.workspaceUserId : "",
                      }));
                    }}
                  >
                    <optgroup label="CertivoIQ internal CRM">
                      <option value="employee">Employee — CRM access only</option>
                      {isCrmAdmin ? <option value="manager">Manager — may invite employees</option> : null}
                      {isCrmAdmin ? <option value="admin">Administrator — full staff-access authority</option> : null}
                    </optgroup>
                    {isCrmAdmin ? (
                      <optgroup label="Public Housing Agency">
                        {phaRoles.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                {isPhaRole(invite.role) ? (
                  <label className="block text-xs font-medium">
                    PHA workspace
                    <select
                      required
                      className={inputClass}
                      value={invite.workspaceUserId}
                      onChange={(event) =>
                        setInvite((value) => ({ ...value, workspaceUserId: event.target.value }))
                      }
                    >
                      <option value="">Select PHA workspace</option>
                      {(phaWorkspaces.data ?? []).map((workspace) => (
                        <option key={workspace.user_id} value={workspace.user_id}>
                          {workspace.user_id.slice(0, 8)}… · {workspace.pha_programs.join(", ") || "no programs configured"}
                        </option>
                      ))}
                    </select>
                    {!phaWorkspaces.isLoading && !(phaWorkspaces.data ?? []).length ? (
                      <span className="mt-1 block text-xs text-destructive">
                        No configured PHA workspace is available. Configure a PHA owner workspace first.
                      </span>
                    ) : null}
                  </label>
                ) : null}
                <Button
                  className="w-full"
                  type="submit"
                  disabled={action.isPending || (isPhaRole(invite.role) && !invite.workspaceUserId)}
                >
                  <MailPlus className="size-4" />
                  {action.isPending ? "Sending invitation…" : "Send invitation"}
                </Button>
              </form>
            </Panel>

            <Panel
              title="Current staff"
              description="Deactivation removes CRM authorization while preserving the access history."
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const protectedRole = member.access_level !== "employee" && !isCrmAdmin;
                      const isSelf = member.email?.toLowerCase() === email?.toLowerCase();
                      return (
                        <tr key={member.user_id} className="border-b border-border last:border-0">
                          <td className="px-5 py-3">
                            <p className="font-medium">{member.fullName || member.email || "CertivoIQ employee"}</p>
                            {member.fullName && member.email ? <p className="text-xs text-muted-foreground">{member.email}</p> : null}
                          </td>
                          <td className="px-5 py-3">{accessLabel(member.access_level)}</td>
                          <td className="px-5 py-3"><Pill tone={member.status === "active" ? "seal" : "reject"}>{member.status}</Pill></td>
                          <td className="px-5 py-3">
                            {isSelf || protectedRole ? (
                              <span className="text-xs text-muted-foreground">{isSelf ? "Current account" : "Administrator required"}</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={action.isPending}
                                onClick={() =>
                                  action.mutate({
                                    action: member.status === "active" ? "disable" : "reactivate",
                                    targetUserId: member.user_id,
                                  })
                                }
                              >
                                {member.status === "active" ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                                {member.status === "active" ? "Deactivate" : "Reactivate"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel
            className="mt-4"
            title="CRM invitation history"
            description="Internal CRM delivery, acceptance, expiration, and revocation remain visible here. PHA invitations remain in the selected agency's Users & Permissions audit history."
            bodyClassName="p-0"
            actions={
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                <RefreshCw className="size-4" /> Refresh
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Invite</th>
                    <th className="px-5 py-3">Delivery</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => {
                    const managerBlocked = invitation.access_level !== "employee" && !isCrmAdmin;
                    return (
                      <tr key={invitation.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">{invitation.invite_email}</td>
                        <td className="px-5 py-3">{accessLabel(invitation.access_level)}</td>
                        <td className="px-5 py-3"><Pill tone={invitation.status === "accepted" ? "seal" : invitation.status === "revoked" ? "reject" : undefined}>{invitation.status}</Pill></td>
                        <td className="px-5 py-3">
                          <Pill tone={invitation.delivery_status === "sent" ? "seal" : invitation.delivery_status === "failed" ? "reject" : undefined}>{invitation.delivery_status}</Pill>
                          {invitation.delivery_error ? <p className="mt-1 max-w-64 truncate text-xs text-reject" title={invitation.delivery_error}>{invitation.delivery_error}</p> : null}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs">{new Date(invitation.expires_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          {invitation.status === "pending" && !managerBlocked ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ action: "resend", invitationId: invitation.id })}>Resend</Button>
                              <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ action: "revoke", invitationId: invitation.id })}>Revoke</Button>
                            </div>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!invitations.length ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 size-7 text-seal" />
                  No CRM staff invitations have been created.
                </div>
              ) : null}
            </div>
          </Panel>
        </>
      )}
    </CrmShell>
  );
}
