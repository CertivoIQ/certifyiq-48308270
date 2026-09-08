import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { getAccountState, type AccountState } from "@/utils/entitlements.functions";

/**
 * Authoritative account view: plan, limits and current-period usage, read from
 * a server function so the same values the server enforces drive the UI.
 */
export function useAccount() {
  const { user, ready } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery<AccountState | null>({
    queryKey: ["account-state", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const result = await getAccountState({ data: { environment: await getStripeEnvironment() } });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
  });

  useEffect(() => {
    if (!user) return;

    // Realtime channels can briefly remain registered while React is cleaning
    // up an effect (notably during StrictMode/dev remounts). A unique topic
    // prevents a second .on() from being attached to an already-subscribed
    // channel, which can otherwise throw and blank the application.
    const channel = supabase
      .channel(`account-access-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_access", filter: `user_id=eq.${user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["account-state", user.id] }),
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [user?.id, queryClient]);

  const account = query.data ?? null;

  return {
    account,
    loading: !ready || (!!user && query.isLoading),
    refetch: query.refetch,
    // FREE review access has no calendar countdown. These legacy fields remain
    // for compatibility with existing consumers but are intentionally inert.
    trialEndsAt: null,
    trialDaysLeft: null,
    trialExpired: false,
  };
}
