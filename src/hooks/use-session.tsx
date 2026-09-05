import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  FOUNDER_DEFAULT_DASHBOARD,
  founderDashboardSessionKey,
  isFounderUser,
  legacyPlatformDashboardStorageKey,
} from "@/lib/founder-access";

export const STAFF_DOMAIN = "certivoiq.com";

/** Live Supabase session for the browser. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (
        event === "SIGNED_IN" &&
        isFounderUser(next?.user) &&
        next?.user.id &&
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/auth")
      ) {
        // Permanently retire the old persistent dashboard choice for founder.
        // The current login receives a clean, session-only operational default.
        window.localStorage.removeItem(legacyPlatformDashboardStorageKey(next.user.id));
        window.sessionStorage.setItem(
          founderDashboardSessionKey(next.user.id),
          FOUNDER_DEFAULT_DASHBOARD,
        );
      }
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, ready };
}

/**
 * CertivoIQ staff check. The `staff` role is granted server-side only after an
 * active administrator- or manager-issued invitation is accepted. Client code
 * cannot grant the role, and RLS enforces staff authorization on CRM tables.
 * The designated founder account is a platform-level exception for navigation
 * and staff tooling; server-side authorization remains authoritative for data.
 */
export function useIsStaff() {
  const { user, ready } = useSession();
  const isFounder = isFounderUser(user);

  const query = useQuery({
    queryKey: ["staff-role", user?.id],
    enabled: !!user && !isFounder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "staff")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  return {
    user,
    email: user?.email ?? null,
    isStaff: isFounder || query.data === true,
    loading: !ready || (!!user && !isFounder && query.isLoading),
  };
}
