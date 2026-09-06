import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  deductions: number;
  minimum_rent: number;
  utility_allowance: number;
  adjusted_income: number | null;
  total_tenant_payment: number | null;
  payment_standard: number | null;
  gross_rent: number | null;
  rent_to_owner: number | null;
  public_housing_rent_choice: string | null;
  flat_rent_amount: number | null;
  alternative_non_public_housing_rent_applicable: boolean;
  alternative_non_public_housing_rent: number | null;
  mod_rehab_source_validated: boolean;
  current_base_rent: number | null;
  rehab_debt_service: number | null;
  contract_rent_to_owner: number | null;
  normal_total_hap: number | null;
  mixed_family_proration_applicable: boolean;
  eligible_family_members: number | null;
  total_family_members: number | null;
  proration_percentage: number | null;
  prorated_total_hap: number | null;
  mixed_family_total_tenant_payment: number | null;
  housing_assistance_payment: number | null;
  family_share: number | null;
  tenant_rent: number | null;
  utility_reimbursement: number | null;
  calculation_status: string;
  reason_code: string | null;
  reason: string | null;
};

type WorkflowRow = FamilyActionRow & { calculation: CalculationRow | null };

type Draft = {
  annual_income: string;
  deductions: string;
  minimum_rent: string;
  utility_allowance: string;
  payment_standard: string;
  gross_rent: string;
  rent_to_owner: string;
  public_housing_rent_choice: string;
  flat_rent_amount: string;
  alternative_non_public_housing_rent_applicable: boolean;
  alternative_non_public_housing_rent: string;
  mod_rehab_source_validated: boolean;
  current_base_rent: string;
  rehab_debt_service: string;
  mixed_family_proration_applicable: boolean;
  eligible_family_members: string;
  total_family_members: string;
};

const emptyDraft: Draft = {
  annual_income: "",
  deductions: "0",
  minimum_rent: "0",
  utility_allowance: "0",
  payment_standard: "",
  gross_rent: "",
  rent_to_owner: "",
  public_housing_rent_choice: "income_based",
  flat_rent_amount: "",
  alternative_non_public_housing_rent_applicable: false,
  alternative_non_public_housing_rent: "",
  mod_rehab_source_validated: false,
  current_base_rent: "",
  rehab_debt_service: "",
  mixed_family_proration_applicable: false,
  eligible_family_members: "",
  total_family_members: "",
};

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

function numeric(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function draftFromCalculation(calculation: CalculationRow | null): Draft {
  if (!calculation) return { ...emptyDraft };
  return {
    annual_income: String(calculation.annual_income ?? ""),
    deductions: String(calculation.deductions ?? 0),
    minimum_rent: String(calculation.minimum_rent ?? 0),
    utility_allowance: String(calculation.utility_allowance ?? 0),
    payment_standard: calculation.payment_standard == null ? "" : String(calculation.payment_standard),
    gross_rent: calculation.gross_rent == null ? "" : String(calculation.gross_rent),
    rent_to_owner: calculation.rent_to_owner == null ? "" : String(calculation.rent_to_owner),
    public_housing_rent_choice: calculation.public_housing_rent_choice ?? "income_based",
    flat_rent_amount: calculation.flat_rent_amount == null ? "" : String(calculation.flat_rent_amount),
    alternative_non_public_housing_rent_applicable: calculation.alternative_non_public_housing_rent_applicable,
    alternative_non_public_housing_rent: calculation.alternative_non_public_housing_rent == null ? "" : String(calculation.alternative_non_public_housing_rent),
    mod_rehab_source_validated: calculation.mod_rehab_source_validated,
    current_base_rent: calculation.current_base_rent == null ? "" : String(calculation.current_base_rent),
    rehab_debt_service: calculation.rehab_debt_service == null ? "" : String(calculation.rehab_debt_service),
    mixed_family_proration_applicable: calculation.mixed_family_proration_applicable,
    eligible_family_members: calculation.eligible_family_members == null ? "" : String(calculation.eligible_family_members),
    total_family_members: calculation.total_family_members == null ? "" : String(calculation.total_family_members),
  };
}

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function PhaFamilyWorkflow() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

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
          .select("family_action_id, annual_income, deductions, minimum_rent, utility_allowance, adjusted_income, total_tenant_payment, payment_standard, gross_rent, rent_to_owner, public_housing_rent_choice, flat_rent_amount, alternative_non_public_housing_rent_applicable, alternative_non_public_housing_rent, mod_rehab_source_validated, current_base_rent, rehab_debt_service, contract_rent_to_owner, normal_total_hap, mixed_family_proration_applicable, eligible_family_members, total_family_members, proration_percentage, prorated_total_hap, mixed_family_total_tenant_payment, housing_assistance_payment, family_share, tenant_rent, utility_reimbursement, calculation_status, reason_code, reason"),
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
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    const first = rows[0];
    if (!selectedId && first) setSelectedId(first.id);
  }, [rows, selectedId]);

  useEffect(() => {
    setDraft(draftFromCalculation(selected?.calculation ?? null));
  }, [selectedId, selected?.calculation]);

  const saveCalculation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a family action before saving a determination.");
      const annualIncome = numeric(draft.annual_income);
      const deductions = numeric(draft.deductions);
      const minimumRent = numeric(draft.minimum_rent);
      const utilityAllowance = numeric(draft.utility_allowance);
      if ([annualIncome, deductions, minimumRent, utilityAllowance].some((value) => value == null || !Number.isFinite(value))) {
        throw new Error("Annual income, deductions, minimum rent, and utility allowance are required numeric values.");
      }

      const payload = {
        family_action_id: selected.id,
        program_code: selected.program_code,
        annual_income: annualIncome,
        deductions,
        minimum_rent: minimumRent,
        utility_allowance: utilityAllowance,
        payment_standard: selected.program_code === "hcv" ? numeric(draft.payment_standard) : null,
        gross_rent: selected.program_code === "hcv" ? numeric(draft.gross_rent) : null,
        rent_to_owner: selected.program_code === "pbv" ? numeric(draft.rent_to_owner) : null,
        public_housing_rent_choice: selected.program_code === "public_housing" ? draft.public_housing_rent_choice : null,
        flat_rent_amount: selected.program_code === "public_housing" && draft.public_housing_rent_choice === "flat_rent" ? numeric(draft.flat_rent_amount) : null,
        alternative_non_public_housing_rent_applicable: selected.program_code === "public_housing" && draft.alternative_non_public_housing_rent_applicable,
        alternative_non_public_housing_rent: selected.program_code === "public_housing" && draft.alternative_non_public_housing_rent_applicable ? numeric(draft.alternative_non_public_housing_rent) : null,
        mod_rehab_source_validated: selected.program_code === "mod_rehab" && draft.mod_rehab_source_validated,
        current_base_rent: selected.program_code === "mod_rehab" ? numeric(draft.current_base_rent) : null,
        rehab_debt_service: selected.program_code === "mod_rehab" ? numeric(draft.rehab_debt_service) : null,
        mixed_family_proration_applicable: selected.program_code === "mod_rehab" && draft.mixed_family_proration_applicable,
        eligible_family_members: selected.program_code === "mod_rehab" && draft.mixed_family_proration_applicable ? numeric(draft.eligible_family_members) : null,
        total_family_members: selected.program_code === "mod_rehab" && draft.mixed_family_proration_applicable ? numeric(draft.total_family_members) : null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_family_calculations").upsert(payload, { onConflict: "family_action_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pha-family-actions-with-calculations"] });
    },
  });

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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.7fr)]">
        <Panel title="Family workflow queue" description="Select a family to review or update its substantive determination. A validated calculation and required notice are prerequisites to HUD-50058 handoff.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective</th><th className="pb-3">Stage</th><th className="pb-3">Annual / adjusted</th><th className="pb-3">TTP</th><th className="pb-3">Rent / share</th><th className="pb-3">Determination</th></tr>
              </thead>
              <tbody>
                {query.isLoading ? <tr className="border-t border-border"><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading family workflow…</td></tr> : null}
                {!query.isLoading && rows.length === 0 ? <tr className="border-t border-border"><td colSpan={9} className="py-8 text-center text-muted-foreground">No family actions have been loaded yet.</td></tr> : null}
                {rows.map((row) => {
                  const calc = row.calculation;
                  const rentOrShare = calc?.tenant_rent ?? calc?.family_share ?? null;
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-t border-border align-top ${selectedId === row.id ? "bg-muted/40" : ""}`}>
                      <td className="py-3 pr-3 font-medium">{row.family_reference}</td>
                      <td className="py-3 pr-3">{row.program_code.replaceAll("_", " ").toUpperCase()}</td>
                      <td className="py-3 pr-3">{row.action_type.replaceAll("_", " ")}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{row.effective_date}</td>
                      <td className="py-3 pr-3"><Pill tone={row.workflow_status === "routed" ? "seal" : undefined}>{progressLabel(row)}</Pill></td>
                      <td className="py-3 pr-3 text-xs">{dollars(calc?.annual_income)} / {dollars(calc?.adjusted_income)}</td>
                      <td className="py-3 pr-3 font-medium">{dollars(calc?.total_tenant_payment)}</td>
                      <td className="py-3 pr-3">{dollars(rentOrShare)}</td>
                      <td className="py-3 text-xs text-muted-foreground">{calc ? <><span className="font-medium text-foreground">{calc.calculation_status.toUpperCase()}</span>{calc.reason ? <div className="mt-1 max-w-[300px]">{calc.reason}</div> : null}</> : "Not calculated"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Determination workbench" description={selected ? `${selected.family_reference} · ${selected.program_code.replaceAll("_", " ").toUpperCase()}` : "Select a family action from the queue."}>
          {!selected ? <p className="text-sm text-muted-foreground">No family action is selected.</p> : (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveCalculation.mutate(); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">Annual income<input className={inputClass} inputMode="decimal" value={draft.annual_income} onChange={(event) => setDraft((value) => ({ ...value, annual_income: event.target.value }))} /></label>
                <label className="text-xs font-medium">Deductions<input className={inputClass} inputMode="decimal" value={draft.deductions} onChange={(event) => setDraft((value) => ({ ...value, deductions: event.target.value }))} /></label>
                <label className="text-xs font-medium">Minimum rent<input className={inputClass} inputMode="decimal" value={draft.minimum_rent} onChange={(event) => setDraft((value) => ({ ...value, minimum_rent: event.target.value }))} /></label>
                <label className="text-xs font-medium">Utility allowance<input className={inputClass} inputMode="decimal" value={draft.utility_allowance} onChange={(event) => setDraft((value) => ({ ...value, utility_allowance: event.target.value }))} /></label>
              </div>

              {selected.program_code === "hcv" ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Payment standard<input className={inputClass} inputMode="decimal" value={draft.payment_standard} onChange={(event) => setDraft((value) => ({ ...value, payment_standard: event.target.value }))} /></label><label className="text-xs font-medium">Gross rent<input className={inputClass} inputMode="decimal" value={draft.gross_rent} onChange={(event) => setDraft((value) => ({ ...value, gross_rent: event.target.value }))} /></label></div> : null}

              {selected.program_code === "pbv" ? <label className="block text-xs font-medium">Controlled rent to owner<input className={inputClass} inputMode="decimal" value={draft.rent_to_owner} onChange={(event) => setDraft((value) => ({ ...value, rent_to_owner: event.target.value }))} /></label> : null}

              {selected.program_code === "public_housing" ? <div className="space-y-3"><label className="block text-xs font-medium">Rent choice<select className={inputClass} value={draft.public_housing_rent_choice} onChange={(event) => setDraft((value) => ({ ...value, public_housing_rent_choice: event.target.value }))}><option value="income_based">Income-based rent</option><option value="flat_rent">Flat rent</option></select></label>{draft.public_housing_rent_choice === "flat_rent" ? <label className="block text-xs font-medium">Flat rent amount<input className={inputClass} inputMode="decimal" value={draft.flat_rent_amount} onChange={(event) => setDraft((value) => ({ ...value, flat_rent_amount: event.target.value }))} /></label> : null}<label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={draft.alternative_non_public_housing_rent_applicable} onChange={(event) => setDraft((value) => ({ ...value, alternative_non_public_housing_rent_applicable: event.target.checked }))} />Over-income alternative rent applies</label>{draft.alternative_non_public_housing_rent_applicable ? <label className="block text-xs font-medium">Alternative non-public housing rent<input className={inputClass} inputMode="decimal" value={draft.alternative_non_public_housing_rent} onChange={(event) => setDraft((value) => ({ ...value, alternative_non_public_housing_rent: event.target.value }))} /></label> : null}</div> : null}

              {selected.program_code === "mod_rehab" ? <div className="space-y-3"><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={draft.mod_rehab_source_validated} onChange={(event) => setDraft((value) => ({ ...value, mod_rehab_source_validated: event.target.checked }))} />Controlled Mod Rehab HAP/rent source validated</label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Current base rent<input className={inputClass} inputMode="decimal" value={draft.current_base_rent} onChange={(event) => setDraft((value) => ({ ...value, current_base_rent: event.target.value }))} /></label><label className="text-xs font-medium">Rehab debt service<input className={inputClass} inputMode="decimal" value={draft.rehab_debt_service} onChange={(event) => setDraft((value) => ({ ...value, rehab_debt_service: event.target.value }))} /></label></div><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={draft.mixed_family_proration_applicable} onChange={(event) => setDraft((value) => ({ ...value, mixed_family_proration_applicable: event.target.checked }))} />Mixed-family proration applies</label>{draft.mixed_family_proration_applicable ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Eligible family members<input className={inputClass} inputMode="numeric" value={draft.eligible_family_members} onChange={(event) => setDraft((value) => ({ ...value, eligible_family_members: event.target.value }))} /></label><label className="text-xs font-medium">Total family members<input className={inputClass} inputMode="numeric" value={draft.total_family_members} onChange={(event) => setDraft((value) => ({ ...value, total_family_members: event.target.value }))} /></label></div> : null}</div> : null}

              {selected.calculation ? <div className="rounded-md border border-border bg-muted/30 p-3 text-xs"><div className="font-medium">Current result: {selected.calculation.calculation_status.toUpperCase()}</div><div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground"><span>TTP {dollars(selected.calculation.total_tenant_payment)}</span><span>Tenant rent/share {dollars(selected.calculation.tenant_rent ?? selected.calculation.family_share)}</span><span>HAP {dollars(selected.calculation.housing_assistance_payment)}</span>{selected.program_code === "mod_rehab" ? <span>Contract rent {dollars(selected.calculation.contract_rent_to_owner)}</span> : null}</div>{selected.calculation.reason ? <p className="mt-2">{selected.calculation.reason}</p> : null}</div> : null}

              <button type="submit" disabled={saveCalculation.isPending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saveCalculation.isPending ? "Calculating…" : "Calculate & validate"}</button>
              {saveCalculation.isError ? <p className="text-xs text-destructive">{saveCalculation.error instanceof Error ? saveCalculation.error.message : "Unable to save determination."}</p> : null}
              {saveCalculation.isSuccess ? <p className="text-xs text-muted-foreground">Determination saved. Workflow status recalculated automatically.</p> : null}
            </form>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Program-specific controls"><p className="text-sm leading-6 text-muted-foreground">Tenant-based HCV requires payment standard and gross rent. PBV requires controlled rent to owner. Public Housing preserves the rent-choice and over-income paths. Mod Rehab requires validated contract-rent evidence, base rent, rehabilitation debt service, and mixed-family counts when proration applies.</p></Panel>
        <Panel title="Fail-closed evidence handling"><p className="text-sm leading-6 text-muted-foreground">A conflicting verification/EIV item or controlled-source conflict blocks the substantive determination. Calculation completion is derived from a validated database result; it cannot be manually checked off to bypass HUD-50058 routing controls.</p></Panel>
      </div>
    </AppShell>
  );
}
