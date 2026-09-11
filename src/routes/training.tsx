import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { TrainingCenter } from "@/components/training-center";
import { usePlatformDashboardAccess, resolvePlatformDashboardMode } from "@/hooks/use-platform-dashboard-access";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training — CertivoIQ" },
      { name: "description", content: "Role-scoped CertivoIQ training for the active workspace." },
    ],
  }),
  component: TrainingPage,
});

function TrainingPage() {
  const { isStaff } = useIsStaff();
  const { user, ready } = useSession();
  const { profile } = useWorkspaceProfile();
  const { selectedMode } = usePlatformDashboardAccess();
  const dashboardMode = resolvePlatformDashboardMode(selectedMode, profile.organization_type);
  const scope = dashboardMode === "pha" ? "pha" : "customer";

  return (
    <AppShell
      title={scope === "pha" ? "PHA Training" : "Training"}
      subtitle={scope === "pha" ? "Training for your PHA workspace" : "Learn CertivoIQ, one customer workflow at a time"}
    >
      <TrainingCenter
        key={`${scope}:${ready ? user?.id ?? "visitor" : "loading"}`}
        accountId={user?.id ?? null}
        isStaff={isStaff}
        scope={scope}
      />
    </AppShell>
  );
}
