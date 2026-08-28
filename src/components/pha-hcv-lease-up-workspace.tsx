import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Voucher={id:string;voucher_number:string;issued_at:string;expires_at:string;extension_expires_at:string|null;status:string};
type Rfta={id:string;unit_reference:string;submitted_at:string;inspection_clearance:string;rent_reasonable:boolean;family_share_40_percent_clear:boolean;decision_status:string;block_reason:string|null};
type Hap={id:string;lease_start:string;execution_deadline:string;executed_at:string|null;payment_authorized:boolean;status:string};

export function PhaHcvLeaseUpWorkspace(){
 const q=useQuery({queryKey:["pha-hcv-lease-up"],queryFn:async()=>{
  // Generated Supabase types lag newly deployed PHA lease-up tables until schema refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any;
  const [v,r,h]=await Promise.all([
   client.from("pha_hcv_vouchers").select("id,voucher_number,issued_at,expires_at,extension_expires_at,status").order("created_at",{ascending:false}).limit(100),
   client.from("pha_hcv_rfta_requests").select("id,unit_reference,submitted_at,inspection_clearance,rent_reasonable,family_share_40_percent_clear,decision_status,block_reason").order("created_at",{ascending:false}).limit(100),
   client.from("pha_hcv_hap_contracts").select("id,lease_start,execution_deadline,executed_at,payment_authorized,status").order("created_at",{ascending:false}).limit(100),
  ]);
  for(const result of [v,r,h])if(result.error)throw result.error;
  return{vouchers:(v.data??[]) as Voucher[],rftas:(r.data??[]) as Rfta[],haps:(h.data??[]) as Hap[]};
 }});
 const vouchers=q.data?.vouchers??[];const rftas=q.data?.rftas??[];const haps=q.data?.haps??[];
 return <AppShell title="HCV Lease-Up" subtitle="Voucher issuance, RFTA, tenancy approval, lease execution, and HAP contract controls">
  <div className="grid gap-3 md:grid-cols-4"><Stat label="Active vouchers" value={vouchers.filter(v=>["issued","searching","rfta_submitted"].includes(v.status)).length} hint="Families still in the search/approval process"/><Stat label="RFTAs blocked" value={rftas.filter(r=>r.decision_status==="blocked").length} hint="Inspection, rent, eligibility, or family-share controls unresolved"/><Stat label="Approved RFTAs" value={rftas.filter(r=>r.decision_status==="approved").length} hint="Tenancies eligible for HAP execution"/><Stat label="HAP payment authorized" value={haps.filter(h=>h.payment_authorized).length} hint="Executed HAP contracts cleared for payment"/></div>
  <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
   <Panel title="RFTA / tenancy approval" description="24 CFR 982.302 and 982.305."><div className="space-y-2">{rftas.map(r=><div key={r.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">Unit {r.unit_reference}</div><div className="text-xs text-muted-foreground">Inspection {r.inspection_clearance.replaceAll("_"," ")} · rent {r.rent_reasonable?"reasonable":"unresolved"} · 40% test {r.family_share_40_percent_clear?"clear":"unresolved"}</div>{r.block_reason?<p className="mt-1 text-xs text-muted-foreground">{r.block_reason}</p>:null}</div><Pill tone={r.decision_status==="approved"?"seal":undefined}>{r.decision_status}</Pill></div></div>)}{!q.isLoading&&rftas.length===0?<p className="text-sm text-muted-foreground">No HCV RFTA requests are active.</p>:null}</div></Panel>
   <Panel title="HAP contract execution" description="The HAP contract normally must be executed within 60 calendar days after lease start; payment remains blocked until execution."><div className="space-y-2">{haps.map(h=><div key={h.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">Lease start {h.lease_start}</div><div className="text-xs text-muted-foreground">Execution deadline {h.execution_deadline} · payment {h.payment_authorized?"authorized":"blocked"}</div></div><Pill tone={h.status==="executed"?"seal":undefined}>{h.status.replaceAll("_"," ")}</Pill></div></div>)}{!q.isLoading&&haps.length===0?<p className="text-sm text-muted-foreground">No HCV HAP contracts are active.</p>:null}</div></Panel>
  </div>
  <Panel className="mt-4" title="Lease-up safeguard" description="CertivoIQ will not approve assisted tenancy until unit eligibility, controlled initial inspection clearance, lease/tenancy addendum, rent reasonableness, and the applicable initial 40% family-share test clear. It will not authorize HAP payment before contract execution."/>
 </AppShell>;
}
