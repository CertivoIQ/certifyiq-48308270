import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";
import { routePha50058Transaction } from "@/lib/pha-50058-transaction-router.mjs";

export type PhaModuleKind = "families" | "50058" | "inspections" | "hotma";

type TransactionRow = {
  id: string;
  family_reference: string;
  program_code: string;
  transaction_type: string;
  effective_date: string;
  program_applicability_validated: boolean;
  controlled_source_release_approved: boolean;
  current_rule_version_validated: boolean;
  source_status_conflict: boolean;
  full_hotma_policy_set_validated: boolean;
  reporting_path_validated: boolean;
  software_compatibility_validated: boolean;
};

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

function statusTone(status: string) {
  if (status === "READY") return "seal" as const;
  return undefined;
}

function Pha50058Queue() {
  const { profile } = useWorkspaceProfile();
  const query = useQuery<TransactionRow[]>({
    queryKey: ["pha-50058-transactions"],
    queryFn: async () => {
      // Generated Supabase types lag the new migration until the next schema type refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("pha_50058_transactions")
        .select("id, family_reference, program_code, transaction_type, effective_date, program_applicability_validated, controlled_source_release_approved, current_rule_version_validated, source_status_conflict, full_hotma_policy_set_validated, reporting_path_validated, software_compatibility_validated")
        .order("effective_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const routed = (query.data ?? []).map((row) => ({
    row,
    result: routePha50058Transaction({
      program: row.program_code,
      transaction_type: row.transaction_type,
      effective_date: row.effective_date,
      pha_hotma_cohort: profile.pha_hotma_cohort,
      hud_50058_reporting_path: profile.hud_50058_reporting_path,
      program_applicability_validated: row.program_applicability_validated,
      controlled_source_release_approved: row.controlled_source_release_approved,
      current_rule_version_validated: row.current_rule_version_validated,
      source_status_conflict: row.source_status_conflict,
      full_hotma_policy_set_validated: row.full_hotma_policy_set_validated,
      reporting_path_validated: row.reporting_path_validated,
      software_compatibility_validated: row.software_compatibility_validated,
    }),
  }));

  const ready = routed.filter(({ result }) => result.status === "READY").length;
  const blocked = routed.filter(({ result }) => result.status === "BLOCKED").length;
  const review = routed.length - ready - blocked;

  return (
    <AppShell title="HUD-50058 Queue" subtitle="Transaction-level HOTMA routing, readiness, exceptions, and reporting-path validation">
      <div className="flex flex-wrap gap-2">
        <Pill>{profile.pha_hotma_cohort ?? "PHA cohort not configured"}</Pill>
        <Pill>{profile.hud_50058_reporting_path ?? "Reporting path not configured"}</Pill>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Stat label="Ready" value={ready} hint="Eligible for downstream rule evaluation and submission review" />
        <Stat label="Needs review" value={review} hint="Pre-implementation, not applicable, or awaiting HUD guidance" />
        <Stat label="Blocked" value={blocked} hint="Missing or conflicting controls prevent routing" />
      </div>
      <Panel className="mt-4" title="Transaction routing" description="Each row is routed using program, transaction type, effective date, PHA cohort, reporting path, and validated controls.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective</th><th className="pb-3">Status</th><th className="pb-3">Reason</th></tr>
            </thead>
            <tbody>
              {query.isLoading ? <tr className="border-t border-border"><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading transaction queue…</td></tr> : null}
              {!query.isLoading && routed.length === 0 ? <tr className="border-t border-border"><td colSpan={6} className="py-8 text-center text-muted-foreground">No HUD-50058 transactions have been loaded yet.</td></tr> : null}
              {routed.map(({ row, result }) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3 font-medium">{row.family_reference}</td>
                  <td className="py-3 pr-3">{row.program_code.replaceAll("_", " ").toUpperCase()}</td>
                  <td className="py-3 pr-3">{row.transaction_type.replaceAll("_", " ")}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{row.effective_date}</td>
                  <td className="py-3 pr-3"><Pill tone={statusTone(result.status)}>{result.status.replaceAll("_", " ")}</Pill></td>
                  <td className="py-3 text-xs text-muted-foreground">{result.reason ?? "Routing controls satisfied."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}

export function PhaModulePage({ kind }: { kind: PhaModuleKind }) {
  const { profile } = useWorkspaceProfile();
  if (kind === "50058") return <Pha50058Queue />;
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
