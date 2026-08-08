import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Building2, FileUp, Rocket } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Clean production dashboard for active subscribers. The demo/mock portfolio is
 * gated to visitors and trial users, so a paying account starts empty and fills
 * with its own real properties and certifications.
 */
export function ProductionDashboard() {
  const t = useT();

  return (
    <AppShell
      title={t("dash.title")}
      subtitle={t("dash.subtitle")}
      actions={
        <Button size="sm" asChild>
          <Link to="/launchpad">
            <Rocket className="size-3.5" /> LaunchPad
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("dash.stat.properties")} value={0} hint="No properties added yet" />
        <Stat label={t("dash.stat.openFindings")} value={0} hint="Findings appear after your first AI review" />
        <Stat label={t("dash.stat.exposure")} value="$0" hint="Exposure is calculated from real findings" />
        <Stat label={t("dash.stat.autoApproval")} value="—" hint="Available once reviews are completed" />
      </div>

      <Panel
        className="mt-4"
        title="Your workspace is ready"
        description="Sample data has been removed now that your subscription is active. Add your portfolio to begin real compliance reviews."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/properties"
            className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <Building2 className="mt-0.5 size-5 text-primary" />
            <span>
              <span className="block font-display text-[15px]">Register your properties</span>
              <span className="mt-1 block text-[13px] text-muted-foreground">
                Assign each property its program rule pack (LIHTC, Section 8, HOME, HOTMA, Bond, RD).
              </span>
            </span>
          </Link>
          <Link
            to="/files"
            className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <FileUp className="mt-0.5 size-5 text-primary" />
            <span>
              <span className="block font-display text-[15px]">Upload certifications</span>
              <span className="mt-1 block text-[13px] text-muted-foreground">
                Every file gets a Pass/Fail verdict with cited rules and correction steps before human sign-off.
              </span>
            </span>
          </Link>
        </div>
      </Panel>
    </AppShell>
  );
}
