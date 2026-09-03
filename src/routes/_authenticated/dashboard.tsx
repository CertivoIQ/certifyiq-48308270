import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/executive-dashboard";
import { ProductionDashboard } from "@/components/production-dashboard";
import { PhaDashboard } from "@/components/pha-dashboard";
import { PhaInvitationGate } from "@/components/pha-invitation-gate";
import { useViewerState } from "@/hooks/use-viewer-state";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { usePlatformDashboardAccess } from "@/hooks/use-platform-dashboard-access";

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
 */
function DashboardPage() {
  const { showDemoData, loading: viewerLoading } = useViewerState();
  const { profile, loading: profileLoading } = useWorkspaceProfile();
  const { selectedMode, loading: dashboardAccessLoading } = usePlatformDashboardAccess();

  let dashboard;
  if (viewerLoading || profileLoading || dashboardAccessLoading) dashboard = <ExecutiveDashboard demo />;
  else if (selectedMode === "executive_demo") dashboard = <ExecutiveDashboard demo />;
  else if (selectedMode === "pha") dashboard = <PhaDashboard />;
  else if (selectedMode === "multifamily") dashboard = <ProductionDashboard />;
  else if (showDemoData) dashboard = <ExecutiveDashboard demo />;
  else if (profile.organization_type === "pha") dashboard = <PhaDashboard />;
  else dashboard = <ProductionDashboard />;

  return <PhaInvitationGate>{dashboard}</PhaInvitationGate>;
}
