import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";

export type PhaModuleKind = "families" | "50058" | "inspections" | "hotma";

const CONTENT: Record<PhaModuleKind, { title: string; subtitle: string; stats: [string, string, string][]; sections: [string, string][] }> = {
  families: {
    title: "Families & Reexaminations",
    subtitle: "Admissions, eligibility, annual and interim reexaminations, verification, and family-level action queues",
    stats: [["Families requiring action", "0", "Open eligibility or reexamination work"], ["Annual reexaminations due", "0", "Upcoming annual workload"], ["Interim actions", "0", "Reported changes requiring review"]],
    sections: [["Eligibility & admissions", "Income, assets, deductions, citizenship/eligible status, and program eligibility review."], ["Annual reexaminations", "Due-date driven work queue with verification and calculation controls."], ["Interim reexaminations", "Household change intake, effective dates, notices, and recalculation controls."], ["Verification / EIV", "Evidence collection and discrepancy handling with traceable source support."]],
  },
  "50058": {
    title: "HUD-50058 Queue",
    subtitle: "Transaction validation, submission readiness, exceptions, and reporting history",
    stats: [["Ready", "0", "Transactions ready for submission"], ["Needs review", "0", "Transactions requiring staff review"], ["Blocked", "0", "Validation failures preventing submission"]],
    sections: [["Transaction validation", "Validate household, income, assets, deductions, rent, effective date, and program-specific fields."], ["Submission exceptions", "Surface missing or contradictory data before transmission."], ["HOTMA transaction path", "Apply the correct HOTMA calculation and reporting path based on program and effective date."], ["Reporting history", "Maintain a traceable history of submission status and corrections."]],
  },
  inspections: {
    title: "Inspections / NSPIRE",
    subtitle: "Inspection scheduling, findings, corrective actions, and follow-up readiness",
    stats: [["Inspections due", "0", "Scheduled or upcoming inspections"], ["Open deficiencies", "0", "Items requiring corrective action"], ["Follow-ups due", "0", "Reinspection or evidence deadlines"]],
    sections: [["Inspection queue", "Agency inspection workload organized by due date and priority."], ["NSPIRE findings", "Deficiency classification, evidence, corrective action, and closeout status."], ["Unit / property history", "Trace recurring findings and completed remediation."], ["Readiness reporting", "Summarize inspection risk and outstanding actions for leadership."]],
  },
  hotma: {
    title: "PHA HOTMA Readiness",
    subtitle: "Program-specific implementation status for Sections 102, 103, and 104",
    stats: [["Readiness", "—", "Calculated after agency controls are configured"], ["Policy actions", "0", "Administrative Plan or ACOP updates"], ["System actions", "0", "Software, form, and reporting validations"]],
    sections: [["Sections 102 / 104", "Income, assets, deductions, reexaminations, and related implementation controls for covered programs."], ["Section 103", "Public Housing over-income requirements, shown only when Public Housing is administered."], ["Policy readiness", "Administrative Plan, ACOP, verification, notices, and local policy choices."], ["HUD-50058 readiness", "Validate transaction production before the full-compliance effective date."]],
  },
};

export function PhaModulePage({ kind }: { kind: PhaModuleKind }) {
  const { profile } = useWorkspaceProfile();
  const content = CONTENT[kind];
  const show103 = profile.derived_overlays.includes("hotma_103");
  return (
    <AppShell title={content.title} subtitle={content.subtitle}>
      <div className="flex flex-wrap gap-2">
        {profile.pha_programs.map((program) => <Pill key={program}>{program.replaceAll("_", " ").toUpperCase()}</Pill>)}
        {kind === "hotma" && show103 ? <Pill tone="seal">HOTMA 103 applicable</Pill> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {content.stats.map(([label, value, hint]) => <Stat key={label} label={label} value={value} hint={hint} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {content.sections.map(([title, detail]) => (
          <Panel key={title} title={title}><p className="text-sm leading-6 text-muted-foreground">{detail}</p><div className="mt-4 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">This module is ready for live agency data and workflow integration.</div></Panel>
        ))}
      </div>
    </AppShell>
  );
}
