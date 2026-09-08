import { isInternalSegmentUser } from "@/lib/internal-segment-access";
import { useSession } from "@/hooks/use-session";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function PhaInvitationGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const isInternal = isInternalSegmentUser(user);
  const invitation = useQuery({
    queryKey: ["pending-pha-invitation", user?.id],
    enabled: isInternal,
    queryFn: async () => {
      // Generated Supabase types lag the invitation migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("pha_workspace_invitations")
        .select("id, agency_role, expires_at")
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; agency_role: string; expires_at: string } | null;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      if (!invitation.data?.id) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.rpc("accept_pha_workspace_invitation", { target_invitation_id: invitation.data.id });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending-pha-invitation"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-profile"] }),
      ]);
      window.location.assign("/dashboard");
    },
  });

  return (
    <>
      {isInternal && invitation.data ? (
        <div className="mx-auto mt-4 max-w-[1320px] px-4 sm:px-7">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">PHA workspace invitation</p>
                <p className="mt-1 text-xs text-muted-foreground">You were invited as {invitation.data.agency_role.replaceAll("_", " ")}. Acceptance is bound to your signed-in email and expires {new Date(invitation.data.expires_at).toLocaleDateString()}.</p>
              </div>
              <button type="button" onClick={() => accept.mutate()} disabled={accept.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{accept.isPending ? "Accepting…" : "Accept PHA invitation"}</button>
            </div>
            {accept.isError ? <p className="mt-2 text-xs text-destructive">{accept.error instanceof Error ? accept.error.message : "Unable to accept invitation."}</p> : null}
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
