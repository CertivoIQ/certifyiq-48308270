import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, ClipboardCheck, FileCheck2, Users } from "lucide-react";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { classifyPhaHotmaImplementation } from "@/lib/pha-hotma-implementation-engine.mjs";

const PROGRAM_LABELS: Record<string, string> = {
  hcv: "HCV",
  pbv: "Project-Based Voucher",
  public_housing: "Public Housing",
  mod_rehab: "Moderate Rehabilitation",
};

const ENGINE_PROGRAMS: Record<string, string> = {
  hcv: "HCV_TENANT_BASED",
  pbv: "HUD_PBV",
  public_housing: "PUBLIC_HOUSING",
  mod_rehab: "MOD_REHAB",
};

const COHORT_LABELS: Record<string, string> = {
  NON_MTW_NON_FRS: "Non-MTW / Non-FRS",
  INITIAL_MTW: "Initial MTW",
  MTW_EXPANSION: "MTW Expansion",
  FRS_EXCLUSIVE: "FRS-Exclusive",
};

export function PhaDashboard() {
  const { profile } = useWorkspaceProfile();
  const hotma103 = profile.derived_overlays.includes("hotma_103");
  const selectedProgram = profile.pha_programs.find((program) => ENGINE_PROGRAMS[program]);
  const implementationRoute = selectedProgram && profile.pha_hotma_cohort
    ? classifyPhaHotmaImplementation({
        module_id: "PHA-HOTMA-FULL-SECTIONS-102-104",
        program: ENGINE_PROGRAMS[selectedProgram],
        program_applicability_validated: true,
        pha_cohort: profile.pha_hotma_cohort,
        transaction_effective_date: "2027-01-01",
        controlled_source_release_approved: true,
        current_rule_version_validated: true,
        source_status_conflict: false,
        hud_50058_reporting_path: profile.hud_50058_reporting_path ?? undefined,
      })
    : null;

  const futureGuidance = implementationRoute?.reason_code === "PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE";
  const cohortConfigured = Boolean(profile.pha_hotma_cohort && profile.hud_50058_reporting_path);
  const readinessHint = !cohortConfigured
    ? "Complete PHA cohort and HUD-50058 routing setup"
    : futureGuidance
      ? "HUD cohort-specific deadline guidance pending"
      : "Standard PIH implementation route configured";

  return (
    <AppShell
      title="PHA Command Center"
      subtitle="Eligibility, reexaminations, HUD-50058 readiness, inspections, and HOTMA implementation"
      actions={<Button size="sm" asChild><Link to="/launchpad">Review agency setup</Link></Button>}
    >
      <div className="flex flex-wrap gap-2">
        {(profile.pha_programs.length ? profile.pha_programs : ["hcv", "pbv", "public_housing"]).map((program) => (
          <Pill key={program} tone="seal">{PROGRAM_LABELS[program] ?? program}</Pill>
        ))}
        {profile.pha_hotma_cohort ? <Pill>{COHORT_LABELS[profile.pha_hotma_cohort] ?? profile.pha_hotma_cohort}</Pill> : <Pill>PHA cohort not configured</Pill>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Families requiring action" value={0} hint="Populates from agency workflow queues" />
        <Stat label="Annual reexaminations due" value={0} hint="Upcoming agency reexamination workload" />
        <Stat label="HUD-50058 exceptions" value={0} hint="Transactions blocked or needing correction" />
        <Stat label="HOTMA readiness" value={cohortConfigured ? (futureGuidance ? "Guidance pending" : "Configured") : "Setup required"} hint={readinessHint} />
        <Stat label="Inspections requiring action" value={0} hint="Inspection findings and follow-up queue" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Action Center" description="Work is prioritized by urgency, effective date, and regulatory consequence.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [Users, "Family & eligibility queue", "Admissions, annual and interim reexaminations"],
              [FileCheck2, "HUD-50058 queue", "Ready, needs review, blocked and submission-error transactions"],
              [ClipboardCheck, "Inspection queue", "NSPIRE inspections and corrective actions"],
              [CalendarDays, "Compliance calendar", "Reexaminations, notices and implementation milestones"],
            ].map(([Icon, title, detail]) => {
              const IconComponent = Icon as typeof Users;
              return (
                <div key={String(title)} className="rounded-lg border border-border p-4">
                  <IconComponent className="size-5 text-primary" />
                  <h3 className="mt-3 font-display text-[15px]">{String(title)}</h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{String(detail)}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="HOTMA implementation" description="Applicability and deadline routing are derived from agency programs, cohort, effective date, and reporting path.">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>Sections 102 / 104</span><Pill tone="seal">Applicable</Pill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>Section 103 over-income</span><Pill tone={hotma103 ? "seal" : undefined}>{hotma103 ? "Applicable" : "Not applicable"}</Pill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>Implementation cohort</span><Pill>{profile.pha_hotma_cohort ? COHORT_LABELS[profile.pha_hotma_cohort] : "Setup required"}</Pill>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-[12.5px] text-muted-foreground">
              {!cohortConfigured
                ? "Configure the PHA cohort and HUD-50058 reporting path before CertivoIQ applies an enforcement timeline."
                : futureGuidance
                  ? "This MTW/FRS cohort is blocked from a generic January 1, 2027 enforcement assumption. CertivoIQ will hold full Sections 102/104 deadline routing until applicable HUD guidance is controlled and validated."
                  : "For this non-MTW/non-FRS route, January 1, 2027 is the current full-compliance enforcement date for Sections 102 and 104. Transaction-level enforcement still depends on effective date and validated controls."}
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="HUD-50058 transaction queue" description="Transaction-level validation will expose calculations, rule application, source citations, and correction instructions.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective date</th><th className="pb-3">HOTMA</th><th className="pb-3">Status</th></tr></thead>
            <tbody><tr className="border-t border-border"><td colSpan={6} className="py-8 text-center text-muted-foreground">No agency transactions have been loaded yet.</td></tr></tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>PHA workspaces intentionally use agency-specific operational concepts instead of the multifamily property-management navigation.</span></div>
      </div>
    </AppShell>
  );
}
