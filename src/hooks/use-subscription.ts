import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getStripeEnvironment } from "@/lib/stripe";
import { PLAN_PRICE_ID_LIST, entitlementForPrice } from "@/lib/plan-catalog";

/**
 * Current subscription for the signed-in user. UX only — every gated action is
 * re-checked server-side against the same table.
 */
export function useSubscription() {
  const { user, ready } = useSession();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Only platform-plan rows define "your subscription" — Academy add-ons
      // are separate subscriptions and must not shadow the plan.
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("environment", getStripeEnvironment())
        .in("price_id", PLAN_PRICE_ID_LIST)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;

    // Realtime channels can briefly remain registered while React is cleaning
    // up an effect (notably during StrictMode/dev remounts). A unique topic
    // prevents a second .on() from being attached to an already-subscribed
    // channel, which can otherwise throw and blank the application.
    const channel = supabase
      .channel(`subscriptions-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => void query.refetch(),
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [user?.id]);

  const sub = query.data ?? null;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const future = !periodEnd || periodEnd.getTime() > Date.now();

  const isActive =
    !!sub &&
    ((["active", "trialing", "past_due"].includes(sub.status) && future) ||
      (sub.status === "canceled" && !!periodEnd && periodEnd.getTime() > Date.now()));

  return {
    subscription: sub,
    entitlement: entitlementForPrice(sub?.price_id),
    isActive,
    isPastDue: sub?.status === "past_due",
    endsAt: periodEnd,
    cancelAtPeriodEnd: sub?.cancel_at_period_end === true,
    loading: !ready || (!!user && query.isLoading),
  };
}
