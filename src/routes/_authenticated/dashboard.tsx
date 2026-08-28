import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/executive-dashboard";
import { ProductionDashboard } from "@/components/production-dashboard";
import { PhaDashboard } from "@/components/pha-dashboard";
import { PhaInvitationGate } from "@/components/pha-invitation-gate";
import { useViewerState } from "@/hooks/use-viewer-state";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";

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
 * Dashboard routing is account-aware. Demo users retain the sample executive
 * portfolio; production PHA accounts receive the PHA command center; all other
 * production accounts receive the multifamily operations workspace. Pending
 * email-bound PHA invitations are surfaced before the user's current workspace.
 */
function DashboardPage() {
  const { showDemoData, loading: viewerLoading } = useViewerState();
  const { profile, loading: profileLoading } = useWorkspaceProfile();

  let dashboard;
  if (viewerLoading || profileLoading) dashboard = <ExecutiveDashboard demo />;
  else if (showDemoData) dashboard = <ExecutiveDashboard demo />;
  else if (profile.organization_type === "pha") dashboard = <PhaDashboard />;
  else dashboard = <ProductionDashboard />;

  return <PhaInvitationGate>{dashboard}</PhaInvitationGate>;
}
