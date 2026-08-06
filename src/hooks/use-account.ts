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
      const result = await getAccountState({ data: { environment: getStripeEnvironment() } });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`account-access-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_access", filter: `user_id=eq.${user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["account-state", user.id] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user?.id, queryClient]);

  const account = query.data ?? null;
  const trialEndsAt = account?.isTrial && account.accessUntil ? new Date(account.accessUntil) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null;

  return {
    account,
    loading: !ready || (!!user && query.isLoading),
    refetch: query.refetch,
    trialEndsAt,
    trialDaysLeft,
    trialExpired: !!trialEndsAt && trialEndsAt.getTime() < Date.now(),
  };
}
