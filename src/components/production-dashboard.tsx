import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Building2, CalendarDays, FileUp, ListChecks, Paperclip, PlayCircle, Rocket, Search, ShieldCheck } from "lucide-react";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { listCertificationDocuments } from "@/utils/certification-extraction-preview.functions";

const PROGRAM_LABELS: Record<string, string> = {
  lihtc: "LIHTC",
  home: "HOME",
  htf: "HTF",
  section8_pbra: "Section 8 PBRA",
  section202_8: "Section 202/8",
  section202_811_prac: "Section 202/811 PRAC",
  section811_pra: "Section 811 PRA",
  section236_irp: "Section 236 / IRP",
  sprac: "SPRAC",
  tax_exempt_bonds: "Tax-Exempt Bonds",
  rural_development: "USDA Rural Development",
};

export function ProductionDashboard() {
  const { profile } = useWorkspaceProfile();
  const listCertifications = useServerFn(listCertificationDocuments);
  const certifications = useQuery({
    queryKey: ["certification-items"],
    queryFn: () => listCertifications(),
  });
  const pendingCertifications = (certifications.data ?? []).filter((item) =>
    item.review_queue_status === "not_queued" || item.review_queue_status === "queued",
  );
  const hotmaApplicable = profile.derived_overlays.some((item) => item.startsWith("hotma_"));

  return (
    <AppShell
      title="Portfolio Operations"
      subtitle="Real-time certifications, findings, deadlines, and audit readiness across your affordable housing portfolio"
      actions={
        <Button size="sm" asChild>
          <Link to="/launchpad"><Rocket className="size-3.5" /> Portfolio setup</Link>
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Search className="size-4" />
            <span>Search property, household, unit, certification, or finding...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/properties"><Building2 className="size-4" /> Add property</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/upload-certification"><FileUp className="size-4" /> Upload certification</Link></Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(profile.selected_programs.length ? profile.selected_programs : ["lihtc", "home", "section8_pbra"]).map((program) => (
          <Pill key={program}>{PROGRAM_LABELS[program] ?? program}</Pill>
        ))}
        {hotmaApplicable ? <Pill tone="seal">HOTMA derived</Pill> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Link to="/audit-readiness" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Stat label="Audit readiness" value="Open" hint="Prepare evidence, findings, and corrections" tone="flag" />
        </Link>
        <Link to="/files" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Stat label="Certifications awaiting review" value={pendingCertifications.length} hint="Open pending certification work" />
        </Link>
        <Stat label="Open compliance findings" value={0} hint="Unresolved findings requiring action" />
        <Stat label="Recertifications due" value={0} hint="Next 30 days" />
        <Stat label="Properties requiring attention" value={0} hint="Risk and deadline driven" />
      </div>

      <div className="mt-4">
        <Panel title="Certifications Awaiting Review" description="Saved certifications that have not yet completed compliance review. Open a tenant certification, attach one supporting document, or begin its review directly from the Command Center.">
          {certifications.isLoading ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Loading pending certifications…</div>
          ) : certifications.error ? (
            <div className="rounded-lg border border-destructive/30 p-6 text-center text-sm text-destructive">Pending certifications could not be loaded.</div>
          ) : pendingCertifications.length ? (
            <div className="space-y-2">
              {pendingCertifications.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 lg:flex-row lg:items-center lg:justify-between">
                  <Link to="/files" search={{ item: item.id }} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="truncate text-sm font-medium">{item.household_name || item.original_file_name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {item.property_name ? `${item.property_name}${item.unit_number ? ` · Unit ${item.unit_number}` : ""}` : item.original_file_name}
                      {item.certification_type ? ` · ${item.certification_type.toLowerCase()}` : ""}
                      {` · ${item.review_queue_status === "queued" ? "queued for review" : "saved / pending review"}`}
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/files" search={{ item: item.id, action: "support" }}>
                        <Paperclip className="size-3.5" /> Attach Supporting Document
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to="/files" search={{ item: item.id, action: "review" }}>
                        <PlayCircle className="size-3.5" /> Review Certification
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {pendingCertifications.length > 8 ? (
                <div className="pt-2 text-right">
                  <Button size="sm" variant="outline" asChild><Link to="/files">Open all {pendingCertifications.length} pending certifications</Link></Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <ListChecks className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-display text-[15px]">No certifications awaiting review</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Saved certifications that are not yet reviewed will appear here.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Panel title="Needs Your Attention" description="Priority work queue ordered by urgency, due date, and compliance consequence.">
          <div className="rounded-lg border border-dashed border-border p-7 text-center">
            <ListChecks className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-display text-[15px]">No outstanding work yet</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Upload certifications and register properties to populate the operational queue.</p>
            <Button className="mt-4" size="sm" asChild><Link to="/files">Open review queue</Link></Button>
          </div>
        </Panel>

        <Panel title="Upcoming Compliance" description="The next 30 days of certifications, notices, audits, and regulatory deadlines.">
          <div className="space-y-2">
            {[
              ["Annual recertifications", "0"],
              ["Interim certifications", "0"],
              ["Tenant notices", "0"],
              ["Audits / file reviews", "0"],
              ["Regulatory deadlines", "0"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm">
                <span>{label}</span><span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Portfolio Status" description="Property-level operating view with layered program designations and next actions.">
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No properties have been registered yet. Program applicability can be assigned at the property, building, or unit level.
          </div>
          <Button variant="outline" className="mt-4" asChild><Link to="/properties"><Building2 className="size-4" /> Register properties</Link></Button>
        </Panel>

        {hotmaApplicable ? (
          <Panel title="HOTMA Readiness" description="Shown only when a selected HUD program makes HOTMA applicable.">
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <ShieldCheck className="size-6 text-primary" />
              <div><p className="font-display text-[15px]">Derived regulatory overlay active</p><p className="mt-1 text-[12.5px] text-muted-foreground">CertivoIQ applies HOTMA requirements because of your program stack; HOTMA is not a user-selected program.</p></div>
            </div>
            <Button variant="outline" className="mt-4" asChild><Link to="/hotma-readiness">Open HOTMA Readiness</Link></Button>
          </Panel>
        ) : (
          <Panel title="Program Configuration" description="CertivoIQ derives regulatory overlays from the programs and coverage you configure.">
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <CalendarDays className="size-6 text-primary" />
              <p className="text-[12.5px] text-muted-foreground">Complete portfolio setup to activate program-specific deadlines, state requirements, and compliance workflows.</p>
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
