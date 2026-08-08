import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inviteAgencyMember,
  listAgencyInvitations,
  listAgencyMembers,
  revokeAgencyInvitation,
  updateAgencyMembership,
  type AgencyRole,
} from "@/lib/hfa-agency-admin.functions";

const ROLE_LABELS: Record<AgencyRole, string> = {
  agency_admin: "Agency administrator",
  monitor: "Compliance monitor",
  rule_reviewer: "Rule reviewer",
  read_only: "Read only",
};

/**
 * Agency team management. Membership is invitation-only and single-use;
 * matching an email domain never grants access.
 */
export function AgencyTeamPanel({ agencyId }: { agencyId: string }) {
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteAgencyMember);
  const listInvites = useServerFn(listAgencyInvitations);
  const listMembers = useServerFn(listAgencyMembers);
  const revoke = useServerFn(revokeAgencyInvitation);
  const update = useServerFn(updateAgencyMembership);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AgencyRole>("monitor");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["hfa-agency-members", agencyId],
    queryFn: () => listMembers({ data: { agencyId } }),
  });
  const invitations = useQuery({
    queryKey: ["hfa-agency-invitations", agencyId],
    queryFn: () => listInvites({ data: { agencyId } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["hfa-agency-members", agencyId] });
    void queryClient.invalidateQueries({ queryKey: ["hfa-agency-invitations", agencyId] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { agencyId, email, role } }),
    onSuccess: (result) => {
      setIssuedToken(result.token);
      setEmail("");
      toast.success("Invitation created. Share the single-use link with the invitee.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const memberMutation = useMutation({
    mutationFn: (input: { userId: string; action: "suspend" | "reinstate" | "remove"; role?: AgencyRole }) =>
      update({ data: { agencyId, ...input } }),
    onSuccess: (result) => {
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Membership updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <header>
        <h2 className="text-lg font-semibold">Agency team</h2>
        <p className="text-sm text-muted-foreground">
          Reviewers join only by redeeming a single-use invitation that expires in 72 hours. Email
          domains never grant access automatically, and removals take effect immediately.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-email">
            Invite by email
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reviewer@agency.gov"
          />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as AgencyRole)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABELS) as AgencyRole[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => inviteMutation.mutate()}
          disabled={!email || inviteMutation.isPending}
        >
          Send invitation
        </Button>
      </div>

      {issuedToken ? (
        <p className="break-all rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs">
          Single-use invitation link:{" "}
          <code>{`${typeof window === "undefined" ? "" : window.location.origin}/agency/invitations/accept?token=${issuedToken}`}</code>
        </p>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Members</h3>
        {members.data?.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {members.data.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{m.fullName || m.email || m.userId}</span>{" "}
                  <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>{" "}
                  {m.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : null}
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      memberMutation.mutate({
                        userId: m.userId,
                        action: m.suspendedAt ? "reinstate" : "suspend",
                      })
                    }
                  >
                    {m.suspendedAt ? "Reinstate" : "Suspend"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => memberMutation.mutate({ userId: m.userId, action: "remove" })}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Invitations</h3>
        {invitations.data?.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {invitations.data.map((inv) => {
              const state = inv.accepted_at
                ? "Accepted"
                : inv.revoked_at
                  ? "Revoked"
                  : Date.parse(inv.expires_at) < Date.now()
                    ? "Expired"
                    : "Pending";
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {inv.email} <Badge variant="secondary">{ROLE_LABELS[inv.role as AgencyRole]}</Badge>{" "}
                    <Badge variant="outline">{state}</Badge>
                  </span>
                  {state === "Pending" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        revoke({ data: { invitationId: inv.id } }).then(() => {
                          toast.success("Invitation revoked.");
                          refresh();
                        })
                      }
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No invitations issued.</p>
        )}
      </div>
    </section>
  );
}
