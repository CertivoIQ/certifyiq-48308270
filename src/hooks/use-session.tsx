import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const STAFF_DOMAIN = "certifyiq.app";

/** Live Supabase session for the browser. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
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
 * CertifyIQ staff check. The `staff` role is granted server-side by a database
 * trigger only for verified @certifyiq.app accounts, so this can never be
 * spoofed from the client — RLS enforces the same rule on every CRM table.
 */
export function useIsStaff() {
  const { user, ready } = useSession();

  const query = useQuery({
    queryKey: ["staff-role", user?.id],
    enabled: !!user,
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
    isStaff: query.data === true,
    loading: !ready || (!!user && query.isLoading),
  };
}
