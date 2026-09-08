import { isInternalSegmentPath, isInternalSegmentUser } from "@/lib/internal-segment-access";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

import { readSessionWindow, endExpiredSession } from "@/lib/session-window";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const [{ data, error }, { data: factors }, { data: aal }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (error || !data.user) throw redirect({ to: "/auth" });

    if (isInternalSegmentPath(location.pathname) && !isInternalSegmentUser(data.user)) throw redirect({ to: "/dashboard" });

    const sessionWindow = await readSessionWindow();
    if (!sessionWindow.valid) { await endExpiredSession(); throw redirect({ to: "/auth" }); }

    const hasVerifiedFactor = factors?.totp?.some((factor) => factor.status === "verified");
    if (hasVerifiedFactor && aal?.currentLevel !== "aal2") {
      throw redirect({ to: "/auth", search: { mode: "signin" } });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});

