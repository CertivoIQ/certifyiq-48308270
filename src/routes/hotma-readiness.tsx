import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PhaHotmaReadinessWorkspace } from "@/components/pha-hotma-readiness-workspace";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { resolvePlatformDashboardMode, usePlatformDashboardAccess } from "@/hooks/use-platform-dashboard-access";
import { FileUp, Scale, ShieldCheck, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/hotma-readiness")({
  head: () => ({
    meta: [
      { title: "HOTMA Readiness — CertivoIQ" },
      { name: "description", content: "Dedicated HOTMA readiness workspace for the selected CertivoIQ dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HotmaReadinessPage,
});

function HotmaReadinessPage() {
  const { profile } = useWorkspaceProfile();
  const { selectedMode } = usePlatformDashboardAccess();
  const dashboardMode = resolvePlatformDashboardMode(selectedMode, profile.organization_type);

  if (dashboardMode === "pha") return <PhaHotmaReadinessWorkspace />;

  const hotmaOverlays = profile.derived_overlays.filter((item) => item.startsWith("hotma_"));
  const applicable = hotmaOverlays.length > 0;

  return (
    <AppShell
      title="HOTMA Readiness"
      subtitle="Dedicated readiness view for HUD Multifamily HOTMA applicability, evidence, and controlled rule review"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="HOTMA applicability" description="CertivoIQ derives HOTMA from the configured HUD program stack; HOTMA is not a manually selected program.">
          <div className="flex items-start gap-3 rounded-lg border border-border p-4">
            <ShieldCheck className="mt-0.5 size-6 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[16px]">{applicable ? "HOTMA overlay active" : "HOTMA overlay not yet derived"}</p>
                <Pill tone={applicable ? "seal" : "flag"}>{applicable ? "Applicable" : "Configuration required"}</Pill>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {applicable
                  ? "Certification review will use the applicable HOTMA controls together with the property’s program authority and validated evidence."
                  : "Complete organization and program setup so CertivoIQ can determine whether HOTMA applies to this portfolio."}
              </p>
              {hotmaOverlays.length ? <p className="mt-3 font-mono text-xs text-muted-foreground">{hotmaOverlays.join(" · ")}</p> : null}
            </div>
          </div>
        </Panel>

        <Panel title="Readiness actions" description="Keep the operational path visible from one place.">
          <div className="grid gap-2">
            <Button asChild><Link to="/upload-certification"><FileUp className="size-4" /> Upload Certification & OCR</Link></Button>
            <Button variant="outline" asChild><Link to="/rules"><Scale className="size-4" /> Review applicable rules</Link></Button>
            <Button variant="outline" asChild><Link to="/workspace-setup"><SlidersHorizontal className="size-4" /> Organization & Programs</Link></Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
