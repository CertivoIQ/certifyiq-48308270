import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Stat, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export function PhaModRehabOperations() {
  const query = useQuery({
    queryKey: ["pha-mod-rehab-operations"],
    queryFn: async () => {
      // Generated Supabase types lag PHA migrations until the next schema refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [contracts,hap] = await Promise.all([
        client.from("pha_mod_rehab_contracts").select("id,status,contract_reference,current_contract_rent,source_status"),
        client.from("pha_mod_rehab_hap_actions").select("id,status,action_type,effective_date,block_reason"),
      ]);
      if (contracts.error) throw contracts.error;
      if (hap.error) throw hap.error;
      return { contracts: contracts.data ?? [], hap: hap.data ?? [] };
    },
  });
  const contracts=query.data?.contracts ?? [];
  const hap=query.data?.hap ?? [];
  const blocked=hap.filter((x:{status:string})=>x.status==="blocked");
  return <AppShell title="Mod Rehab Operations" subtitle="Part 882 contract administration, Section 13 HAP, rent adjustments, and abatement controls">
    <div className="grid gap-3 md:grid-cols-3">
      <Stat label="Active contracts" value={contracts.filter((x:{status:string})=>x.status==="active").length} hint="Current Section 8 Moderate Rehabilitation HAP contracts" />
      <Stat label="HAP actions" value={hap.length} hint="Monthly HAP, adjustment, abatement, resume and correction actions" />
      <Stat label="Blocked actions" value={blocked.length} hint="Source, inspection, financial-support or HUD approval controls unresolved" />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Panel title="Contract rent authority" description="24 CFR part 882 / HUD-50058 Section 13.">
        <p className="text-sm text-muted-foreground">Contract rent is preserved as base rent plus monthly rehabilitation debt service. The operational record is source-gated and stays separate from PBV rent-to-owner and HCV payment-standard logic.</p>
      </Panel>
      <Panel title="Rent adjustment control" description="Part 882 contract administration.">
        <p className="text-sm text-muted-foreground">A rent-adjustment request cannot clear unless the inspection, audited financial support, and required HUD Field Office approval controls are documented.</p>
      </Panel>
    </div>
    <Panel className="mt-4" title="Contract register">
      <div className="space-y-2 text-sm">{contracts.length===0?<p className="text-muted-foreground">No Mod Rehab contracts have been loaded yet.</p>:contracts.map((row:{id:string;contract_reference:string;current_contract_rent:number;source_status:string})=><div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span>{row.contract_reference} · ${Number(row.current_contract_rent).toFixed(2)}</span><Pill tone={row.source_status==="current"?"seal":undefined}>{row.source_status.replaceAll("_"," ")}</Pill></div>)}</div>
    </Panel>
  </AppShell>;
}
