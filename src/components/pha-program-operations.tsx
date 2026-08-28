import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export function PhaProgramOperations({ kind }: { kind: "pbv" | "public_housing" }) {
  const query = useQuery({
    queryKey: ["pha-program-operations", kind],
    queryFn: async () => {
      // Generated types lag these PHA migrations until the next schema refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      if (kind === "pbv") {
        const [contracts, rents, moves] = await Promise.all([
          client.from("pha_pbv_hap_contracts").select("id,status,contract_reference,project_reference,annual_anniversary"),
          client.from("pha_pbv_rent_actions").select("id,determination_status,action_type,effective_date"),
          client.from("pha_pbv_move_requests").select("id,offer_status,one_year_requirement_satisfied,vawa_emergency_transfer"),
        ]);
        for (const result of [contracts, rents, moves]) if (result.error) throw result.error;
        return { contracts: contracts.data ?? [], rents: rents.data ?? [], moves: moves.data ?? [] };
      }
      const [elections, overIncome, notices, leases] = await Promise.all([
        client.from("pha_public_housing_rent_elections").select("id,rent_option,election_year,notice_issued"),
        client.from("pha_public_housing_over_income_cases").select("id,status,consecutive_months,notice_stage,pha_post_24_policy"),
        client.from("pha_public_housing_over_income_notices").select("id,notice_stage,notice_due_date,notice_issued_at,hearing_right_included,post_24_action"),
        client.from("pha_public_housing_non_public_leases").select("id,status,execution_due_date,executed_at,tenancy_termination_deadline"),
      ]);
      for (const result of [elections, overIncome, notices, leases]) if (result.error) throw result.error;
      return { elections: elections.data ?? [], overIncome: overIncome.data ?? [], notices: notices.data ?? [], leases: leases.data ?? [] };
    },
  });

  if (kind === "pbv") {
    const contracts = query.data?.contracts ?? [];
    const rents = query.data?.rents ?? [];
    const moves = query.data?.moves ?? [];
    return <AppShell title="PBV Operations" subtitle="HAP contracts, rent-to-owner actions, and family right-to-move controls">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Active HAP contracts" value={contracts.filter((x: { status: string }) => x.status === "active").length} hint="Project-based voucher contracts currently active" />
        <Stat label="Rent actions blocked" value={rents.filter((x: { determination_status: string }) => x.determination_status === "blocked").length} hint="HQS, rent-limit, or notice controls unresolved" />
        <Stat label="Move requests pending" value={moves.filter((x: { offer_status: string }) => ["pending","eligible"].includes(x.offer_status)).length} hint="Family right-to-move cases awaiting assistance offer" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="PBV HAP & rent controls" description="24 CFR 983.301-.305 and agency Administrative Plan controls.">
          <p className="text-sm text-muted-foreground">Rent increases cannot clear while HAP/HQS compliance or the controlled rent cap is unresolved. Approved changes require owner notice.</p>
        </Panel>
        <Panel title="Family right to move" description="24 CFR 983.261.">
          <p className="text-sm text-muted-foreground">The standard one-year assisted-lease threshold is derived from dates. VAWA emergency-transfer cases remain separately identified instead of being blocked by the ordinary one-year rule.</p>
        </Panel>
      </div>
      <Panel className="mt-4" title="Current PBV work">
        <div className="space-y-2 text-sm">{contracts.length + rents.length + moves.length === 0 ? <p className="text-muted-foreground">No PBV operational records have been loaded yet.</p> : <><p>{contracts.length} HAP contract record(s)</p><p>{rents.length} rent action(s)</p><p>{moves.length} family move request(s)</p></>}</div>
      </Panel>
    </AppShell>;
  }

  const elections = query.data?.elections ?? [];
  const overIncome = query.data?.overIncome ?? [];
  const notices = query.data?.notices ?? [];
  const leases = query.data?.leases ?? [];
  const pendingNotices = notices.filter((x: { notice_issued_at: string | null }) => !x.notice_issued_at).length;
  const leaseActions = leases.filter((x: { status: string }) => ["presented", "late_execution_pending", "termination_required"].includes(x.status)).length;

  return <AppShell title="Public Housing Operations" subtitle="Rent elections and HOTMA Section 103 over-income controls">
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="Rent elections" value={elections.length} hint="Annual income-based vs flat-rent choices" />
      <Stat label="Over-income monitoring" value={overIncome.filter((x: { status: string }) => x.status === "monitoring").length} hint="Families inside the consecutive-month monitoring period" />
      <Stat label="Notices pending" value={pendingNotices} hint="Initial, 12-month, or 24-month written notices not yet issued" />
      <Stat label="Lease / termination actions" value={leaseActions} hint="Post-24-month actions requiring completion" />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Panel title="Choice of rent" description="24 CFR 960.253.">
        <p className="text-sm text-muted-foreground">CertivoIQ records the annual rent election separately from the underlying validated family calculation, including notice and hardship-review status.</p>
      </Panel>
      <Panel title="Over-income notices" description="24 CFR 960.507 / HOTMA Section 103.">
        <p className="text-sm text-muted-foreground">Initial, 12-month, and 24-month written notices are tied to the income examination and controlled to the federal 30-day notice window. Issued notices must preserve the Part 966 hearing right.</p>
      </Panel>
      <Panel title="Alternative-rent lease" description="24 CFR 960.509.">
        <p className="text-sm text-muted-foreground">When the validated ACOP uses the alternative non-public housing rent route, the new lease is due within 60 days of the 24-month notice or at the next lease renewal, whichever comes first.</p>
      </Panel>
      <Panel title="Termination route" description="24 CFR 960.507(d)(2).">
        <p className="text-sm text-muted-foreground">The tenancy-termination route cannot extend beyond six months after the 24-month notice and retains a separate State/local notice-to-vacate authority reference.</p>
      </Panel>
    </div>
    <Panel className="mt-4" title="Over-income cases">
      <div className="space-y-2 text-sm">{overIncome.length === 0 ? <p className="text-muted-foreground">No Public Housing over-income cases are active.</p> : overIncome.map((row: { id: string; status: string; consecutive_months: number; notice_stage: string }) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span>{row.consecutive_months} consecutive month(s) · {row.notice_stage.replaceAll("_"," ")}</span><Pill>{row.status.replaceAll("_"," ")}</Pill></div>)}</div>
    </Panel>
  </AppShell>;
}
