import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProfileConfigurator } from "@/components/workspace-profile-configurator";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/workspace-setup")({
  head: () => ({ meta: [{ title: "Organization & Programs - CertivoIQ" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: WorkspaceSetupPage,
});

function WorkspaceSetupPage() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <AppShell title="Organization & Programs" subtitle="Configure your organization type and every affordable housing program you operate">
      <WorkspaceProfileConfigurator userId={user.id} />
    </AppShell>
  );
}
