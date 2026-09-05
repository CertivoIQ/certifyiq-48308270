import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExecutiveDashboard } from "@/components/executive-dashboard";
import { ProductionDashboard } from "@/components/production-dashboard";
import { PhaDashboard } from "@/components/pha-dashboard";
import { PhaInvitationGate } from "@/components/pha-invitation-gate";
import { useViewerState } from "@/hooks/use-viewer-state";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { usePlatformDashboardAccess } from "@/hooks/use-platform-dashboard-access";
import { supabase } from "@/integrations/supabase/client";
import { isFounderUser } from "@/lib/founder-access";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "CertivoIQ Dashboard - Compliance Operations" },
      {
        name: "description",
        content:
          "Role-appropriate CertivoIQ workspace for multifamily compliance operations or public housing agency program administration.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DashboardPage,
});

/**
 * Dashboard routing remains account-aware for normal users. Accounts with an
 * explicit platform_dashboard_access entitlement may temporarily select one of
 * the existing dashboard experiences without mutating their workspace profile.
 *
 * Customers who have started LaunchPad must complete that setup before the
 * operational dashboard opens. Legacy users without an onboarding record and
 * the founder account remain accessible so this gate cannot strand existing
 * production access.
 */
function DashboardPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const isFounder = isFounderUser(user);
  const [onboardingChecked, setOnboardingChecked] = useState(isFounder);
  const { showDemoData, loading: viewerLoading } = useViewerState();
  const { profile, loading: profileLoading } = useWorkspaceProfile();
  const { selectedMode, loading: dashboardAccessLoading } = usePlatformDashboardAccess();

  useEffect(() => {
    if (isFounder) {
      setOnboardingChecked(true);
      return;
    }

    let cancelled = false;
    async function verifyOnboarding() {
      const { data, error } = await supabase
        .from("customer_onboarding_progress")
        .select("completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || (data && !data.completed_at)) {
        await navigate({ to: "/launchpad", replace: true });
        return;
      }

      setOnboardingChecked(true);
    }

    void verifyOnboarding();
    return () => {
      cancelled = true;
    };
  }, [isFounder, navigate, user.id]);

  if (!onboardingChecked || viewerLoading || profileLoading || dashboardAccessLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-sm text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  let dashboard;
  if (selectedMode === "executive_demo") dashboard = <ExecutiveDashboard demo />;
  else if (selectedMode === "pha") dashboard = <PhaDashboard />;
  else if (selectedMode === "multifamily") dashboard = <ProductionDashboard />;
  else if (isFounder) dashboard = <ProductionDashboard />;
  else if (showDemoData) dashboard = <ExecutiveDashboard demo />;
  else if (profile.organization_type === "pha") dashboard = <PhaDashboard />;
  else dashboard = <ProductionDashboard />;

  return <PhaInvitationGate>{dashboard}</PhaInvitationGate>;
}
