import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type FamilyActionRow = {
  id: string;
  family_reference: string;
  program_code: string;
  action_type: string;
  effective_date: string;
  due_date: string | null;
  workflow_status: string;
  verification_complete: boolean;
  eiv_review_complete: boolean;
  calculation_complete: boolean;
  notice_complete: boolean;
};

type CalculationRow = {
  family_action_id: string;
  annual_income: number;
  adjusted_income: number | null;
  total_tenant_payment: number | null;
  housing_assistance_payment: number | null;
  family_share: number | null;
  tenant_rent: number | null;
  calculation_status: string;
  reason_code: string | null;
  reason: string | null;
};

type WorkflowRow = FamilyActionRow & { calculation: CalculationRow | null };

function progressLabel(row: FamilyActionRow) {
  if (row.workflow_status === "blocked") return "Blocked";
  if (row.workflow_status === "routed") return "HUD-50058 queued";
  if (!row.verification_complete || !row.eiv_review_complete) return "Verification / EIV";
  if (!row.calculation_complete) return "Calculation";
  if (!row.notice_complete) return "Notice";
  return "Ready to route";
}

function dollars(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function PhaFamilyWorkflow() {
  const query = useQuery<WorkflowRow[]>({
    queryKey: ["pha-family-actions-with-calculations"],
    queryFn: async () => {
      // Generated Supabase types lag new PHA workflow tables until the next schema type refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [actionsResult, calculationsResult] = await Promise.all([
        client
          .from("pha_family_actions")
          .select("id, family_reference, program_code, action_type, effective_date, due_date, workflow_status, verification_complete, eiv_review_complete, calculation_complete, notice_complete")
          .order("due_date", { ascending: true, nullsFirst: false }),
        client
          .from("pha_family_calculations")
          .select("family_action_id, annual_income, adjusted_income, total_tenant_payment, housing_assistance_payment, family_share, tenant_rent, calculation_status, reason_code, reason"),
      ]);
      if (actionsResult.error) throw actionsResult.error;
      if (calculationsResult.error) throw calculationsResult.error;
      const calculations = new Map<string, CalculationRow>(
        (calculationsResult.data ?? []).map((row: CalculationRow) => [row.family_action_id, row]),
      );
      return (actionsResult.data ?? []).map((row: FamilyActionRow) => ({
        ...row,
        calculation: calculations.get(row.id) ?? null,
      }));
    },
  });

  const rows = query.data ?? [];
  const annuals = rows.filter((row) => row.action_type === "annual_reexamination" && row.workflow_status !== "routed").length;
  const interims = rows.filter((row) => row.action_type === "interim_reexamination" && row.workflow_status !== "routed").length;
  const open = rows.filter((row) => !["routed", "blocked"].includes(row.workflow_status)).length;
  const blocked = rows.filter((row) => row.workflow_status === "blocked" || row.calculation?.calculation_status === "blocked").length;

  return (
    <AppShell title="Families & Reexaminations" subtitle="Admissions, annuals, interims, verification/EIV, substantive calculations, notices, and HUD-50058 handoff">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Families requiring action" value={open} hint="Open family workflow items" />
        <Stat label="Annual reexaminations" value={annuals} hint="Annual actions not yet routed" />
        <Stat label="Interim actions" value={interims} hint="Interim actions not yet routed" />
        <Stat label="Blocked determinations" value={blocked} hint="Evidence or calculation controls require correction" />
      </div>

      <Panel className="mt-4" title="Family workflow queue" description="Verified evidence feeds the substantive household calculation. A validated determination and required notice are prerequisites to automatic HUD-50058 handoff.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective</th><th className="pb-3">Stage</th><th className="pb-3">Annual / adjusted income</th><th className="pb-3">TTP</th><th className="pb-3">Rent / share</th><th className="pb-3">Determination</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? <tr className="border-t border-border"><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading family workflow…</td></tr> : null}
              {!query.isLoading && rows.length === 0 ? <tr className="border-t border-border"><td colSpan={9} className="py-8 text-center text-muted-foreground">No family actions have been loaded yet.</td></tr> : null}
              {rows.map((row) => {
                const calc = row.calculation;
                const rentOrShare = calc?.tenant_rent ?? calc?.family_share ?? null;
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-3 pr-3 font-medium">{row.family_reference}</td>
                    <td className="py-3 pr-3">{row.program_code.replaceAll("_", " ").toUpperCase()}</td>
                    <td className="py-3 pr-3">{row.action_type.replaceAll("_", " ")}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{row.effective_date}</td>
                    <td className="py-3 pr-3"><Pill tone={row.workflow_status === "routed" ? "seal" : undefined}>{progressLabel(row)}</Pill></td>
                    <td className="py-3 pr-3 text-xs">{dollars(calc?.annual_income)} / {dollars(calc?.adjusted_income)}</td>
                    <td className="py-3 pr-3 font-medium">{dollars(calc?.total_tenant_payment)}</td>
                    <td className="py-3 pr-3">{dollars(rentOrShare)}</td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {calc ? <><span className="font-medium text-foreground">{calc.calculation_status.toUpperCase()}</span>{calc.reason ? <div className="mt-1 max-w-[320px]">{calc.reason}</div> : null}</> : "Calculation not yet created"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Federal calculation controls"><p className="text-sm leading-6 text-muted-foreground">The determination calculates annual and adjusted income, monthly income, Total Tenant Payment, and the applicable program rent or voucher assistance result. HCV/PBV require payment standard and gross rent. Public Housing preserves the documented flat-rent versus income-based-rent choice.</p></Panel>
        <Panel title="Fail-closed evidence handling"><p className="text-sm leading-6 text-muted-foreground">A conflicting verification/EIV item or controlled-source conflict blocks the substantive determination. The family action cannot mark calculation complete or generate its HUD-50058 record until the calculation status is validated.</p></Panel>
      </div>
    </AppShell>
  );
}
