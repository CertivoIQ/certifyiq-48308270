import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useSubscription } from "@/hooks/use-subscription";

export type ViewerState = "visitor" | "trial" | "subscriber";

/**
 * Who is looking at the page: an anonymous visitor, a signed-in trial user, or
 * a paying subscriber. Demo/mock content is for visitors and trial users only;
 * once the Stripe webhook marks the account active (`demo_data_cleared_at`),
 * the subscriber gets a clean production dashboard. UX only — all limits are
 * still enforced server-side.
 */
export function useViewerState() {
  const { user, ready } = useSession();
  const { isActive, loading: subLoading } = useSubscription();

  const access = useQuery({
    queryKey: ["account-access-demo-flag", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_access")
        .select("demo_data_cleared_at, subscribed_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const demoCleared = !!access.data?.demo_data_cleared_at;
  const state: ViewerState = isActive || demoCleared ? "subscriber" : user ? "trial" : "visitor";

  return {
    state,
    isSubscriber: state === "subscriber",
    /** Mock dataset is shown to visitors and trial users only. */
    showDemoData: state !== "subscriber",
    loading: !ready || subLoading || (!!user && access.isLoading),
  };
}
