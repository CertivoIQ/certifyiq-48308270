import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type FamilyAction = {
  id: string;
  family_reference: string;
  program_code: string;
  action_type: string;
  effective_date: string;
  workflow_status: string;
  calculation_complete: boolean;
  notice_complete: boolean;
  controlled_source_release_approved: boolean;
  current_rule_version_validated: boolean;
  source_status_conflict: boolean;
};

type Calculation = {
  family_action_id: string;
  calculation_status: string;
  total_tenant_payment: number | null;
  tenant_rent: number | null;
  family_share: number | null;
  housing_assistance_payment: number | null;
};

type Notice = {
  id: string;
  family_action_id: string;
  notice_type: string;
  template_key: string | null;
  status: string;
  delivery_method: string | null;
  notice_summary: string | null;
  source_validated: boolean;
  determination_outcome: string | null;
  legal_requirements_validated: boolean;
  local_policy_overlay_status: string;
  legal_notice_snapshot: Record<string, unknown> | null;
  issued_at: string | null;
};

type Row = FamilyAction & { calculation: Calculation | null; notice: Notice | null };

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const outcomes = [
  ["approval", "Approval / eligible"],
  ["denial", "Denial / ineligible"],
  ["change", "Rent, income, utility, or subsidy change"],
  ["termination", "Termination of assistance / tenancy determination"],
] as const;

function dollars(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function legalAuthority(snapshot: Record<string, unknown> | null | undefined) {
  const authority = snapshot?.['authority_code'];
  return typeof authority === "string" ? authority : null;
}

export function PhaNoticeCenter() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState("mail");
  const [determinationOutcome, setDeterminationOutcome] = useState("change");

  const query = useQuery<Row[]>({
    queryKey: ["pha-notice-center"],
    queryFn: async () => {
      // Generated Supabase types lag new PHA workflow tables until schema types are refreshed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [actionsResult, calculationsResult, noticesResult] = await Promise.all([
        client.from("pha_family_actions").select("id, family_reference, program_code, action_type, effective_date, workflow_status, calculation_complete, notice_complete, controlled_source_release_approved, current_rule_version_validated, source_status_conflict").order("updated_at", { ascending: false }),
        client.from("pha_family_calculations").select("family_action_id, calculation_status, total_tenant_payment, tenant_rent, family_share, housing_assistance_payment"),
        client.from("pha_family_notices").select("id, family_action_id, notice_type, template_key, status, delivery_method, notice_summary, source_validated, determination_outcome, legal_requirements_validated, local_policy_overlay_status, legal_notice_snapshot, issued_at").eq("notice_type", "determination"),
      ]);
      if (actionsResult.error) throw actionsResult.error;
      if (calculationsResult.error) throw calculationsResult.error;
      if (noticesResult.error) throw noticesResult.error;
      const calculations = new Map<string, Calculation>((calculationsResult.data ?? []).map((row: Calculation) => [row.family_action_id, row]));
      const notices = new Map<string, Notice>((noticesResult.data ?? []).map((row: Notice) => [row.family_action_id, row]));
      return (actionsResult.data ?? []).map((action: FamilyAction) => ({ ...action, calculation: calculations.get(action.id) ?? null, notice: notices.get(action.id) ?? null }));
    },
  });

  const rows = query.data ?? [];
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  useEffect(() => {
    if (selected?.notice?.determination_outcome) setDeterminationOutcome(selected.notice.determination_outcome);
    else if (selected?.action_type === "admission") setDeterminationOutcome("denial");
    else setDeterminationOutcome("change");
  }, [selected?.id, selected?.notice?.determination_outcome, selected?.action_type]);

  const awaitingNotice = rows.filter((row) => row.calculation?.calculation_status === "validated" && !row.notice_complete).length;
  const issued = rows.filter((row) => row.notice?.status === "issued").length;
  const legalBlocked = rows.filter((row) => row.notice && !row.notice.legal_requirements_validated).length;

  const generateDraft = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a family action first.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_family_notices").upsert({
        family_action_id: selected.id,
        notice_type: "determination",
        determination_outcome: determinationOutcome,
        status: selected.notice?.status === "issued" ? "issued" : "draft",
        delivery_method: selected.notice?.delivery_method ?? null,
      }, { onConflict: "family_action_id,notice_type" });
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-notice-center"] }),
  });

  const issueNotice = useMutation({
    mutationFn: async () => {
      if (!selected?.notice) throw new Error("Generate the notice draft before issuing it.");
      if (selected.notice.status === "issued") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_family_notices").update({ status: "issued", delivery_method: deliveryMethod, determination_outcome: determinationOutcome }).eq("id", selected.notice.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pha-notice-center"] }),
        queryClient.invalidateQueries({ queryKey: ["pha-family-actions-with-calculations"] }),
      ]);
    },
  });

  const sourceReady = selected ? selected.controlled_source_release_approved && selected.current_rule_version_validated && !selected.source_status_conflict : false;
  const calculationReady = selected?.calculation?.calculation_status === "validated";
  const legalReady = selected?.notice?.legal_requirements_validated === true && selected.notice.determination_outcome === determinationOutcome;

  return (
    <AppShell title="Family Notices" subtitle="Generate controlled determination notices, validate hearing/grievance authority, record issuance, and release eligible cases to HUD-50058 routing">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Awaiting notice" value={awaitingNotice} hint="Validated determinations without an issued notice" />
        <Stat label="Issued notices" value={issued} hint="Issued controlled determination notices" />
        <Stat label="Legal-policy blocked" value={legalBlocked} hint="Federal authority or agency policy overlay unresolved" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <Panel title="Notice queue" description="Notice completion is derived only from an issued notice with current source and legal-policy validation.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Calculation</th><th className="pb-3">Notice</th><th className="pb-3">Routing</th></tr>
              </thead>
              <tbody>
                {query.isLoading ? <tr className="border-t border-border"><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading notice queue…</td></tr> : null}
                {!query.isLoading && rows.length === 0 ? <tr className="border-t border-border"><td colSpan={6} className="py-8 text-center text-muted-foreground">No family actions are available yet.</td></tr> : null}
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-t border-border ${selected?.id === row.id ? "bg-muted/40" : ""}`}>
                    <td className="py-3 pr-3 font-medium">{row.family_reference}</td>
                    <td className="py-3 pr-3">{row.program_code.replaceAll("_", " ").toUpperCase()}</td>
                    <td className="py-3 pr-3">{row.action_type.replaceAll("_", " ")}</td>
                    <td className="py-3 pr-3"><Pill tone={row.calculation?.calculation_status === "validated" ? "seal" : undefined}>{row.calculation?.calculation_status ?? "missing"}</Pill></td>
                    <td className="py-3 pr-3"><Pill tone={row.notice?.status === "issued" ? "seal" : undefined}>{row.notice?.status ?? "not generated"}</Pill></td>
                    <td className="py-3 text-xs text-muted-foreground">{row.workflow_status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Notice issuance" description={selected ? `${selected.family_reference} · ${selected.program_code.replaceAll("_", " ").toUpperCase()}` : "Select a family action."}>
          {!selected ? <p className="text-sm text-muted-foreground">No family action is selected.</p> : (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Effective {selected.effective_date}</span><span>TTP {dollars(selected.calculation?.total_tenant_payment)}</span>
                  <span>Tenant rent/share {dollars(selected.calculation?.tenant_rent ?? selected.calculation?.family_share)}</span><span>HAP {dollars(selected.calculation?.housing_assistance_payment)}</span>
                </div>
              </div>

              <label className="block text-xs font-medium">Determination outcome
                <select className={inputClass} value={determinationOutcome} onChange={(event) => setDeterminationOutcome(event.target.value)} disabled={selected.notice?.status === "issued"}>
                  {outcomes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between"><span>Validated calculation</span><Pill tone={calculationReady ? "seal" : undefined}>{calculationReady ? "Ready" : "Required"}</Pill></div>
                <div className="flex items-center justify-between"><span>Approved/current controlled source</span><Pill tone={sourceReady ? "seal" : undefined}>{sourceReady ? "Ready" : "Required"}</Pill></div>
                <div className="flex items-center justify-between"><span>Federal + agency legal notice authority</span><Pill tone={legalReady ? "seal" : undefined}>{legalReady ? "Ready" : "Required"}</Pill></div>
              </div>

              <button type="button" onClick={() => generateDraft.mutate()} disabled={generateDraft.isPending || selected.notice?.status === "issued"} className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {selected.notice ? "Refresh controlled notice draft" : "Generate notice draft"}
              </button>

              {selected.notice ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-5">
                  <div className="font-medium">{selected.notice.template_key ?? "Determination notice"}</div>
                  <p className="mt-2 text-muted-foreground">{selected.notice.notice_summary ?? "The server will derive the determination summary from the validated calculation."}</p>
                  <div>Outcome: {selected.notice.determination_outcome ?? "not selected"}</div>
                  <div>Federal authority: {legalAuthority(selected.notice.legal_notice_snapshot) ?? "unresolved"}</div>
                  <div>Agency policy overlay: {selected.notice.local_policy_overlay_status.replaceAll("_", " ")}</div>
                  <div>Source validation: {selected.notice.source_validated ? "validated" : "not validated"}</div>
                  {selected.notice.issued_at ? <div>Issued: {new Date(selected.notice.issued_at).toLocaleString()}</div> : null}
                </div>
              ) : null}

              {selected.notice?.status !== "issued" ? (
                <>
                  <label className="block text-xs font-medium">Delivery method
                    <select className={inputClass} value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value)}>
                      <option value="mail">Mail</option><option value="hand_delivery">Hand delivery</option><option value="electronic">Electronic</option><option value="other">Other documented method</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => issueNotice.mutate()} disabled={!selected.notice || !calculationReady || !sourceReady || !legalReady || issueNotice.isPending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {issueNotice.isPending ? "Issuing…" : "Issue notice & continue workflow"}
                  </button>
                </>
              ) : <p className="text-xs text-muted-foreground">This notice is issued and immutable. Its federal authority, agency-policy version, rights, and determination snapshot are retained with the issuance record.</p>}

              {(generateDraft.isError || issueNotice.isError) ? <p className="text-xs text-destructive">{(generateDraft.error ?? issueNotice.error) instanceof Error ? (generateDraft.error ?? issueNotice.error as Error).message : "Unable to process notice."}</p> : null}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Notice authority safeguard" description="CertivoIQ separates the federal notice baseline from the agency Administrative Plan, ACOP, or Mod Rehab policy. Issuance fails closed until the applicable federal profile is current and every required agency-policy overlay is validated, including hearing/review procedures, language-access, and accessibility requirements." />
    </AppShell>
  );
}
