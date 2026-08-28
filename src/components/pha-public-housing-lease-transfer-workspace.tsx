import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Lease={id:string;unit_reference:string;lease_start:string;lease_term_months:number;month_to_month_over_income:boolean;status:string;block_reason:string|null};
type Transfer={id:string;transfer_type:string;current_unit_reference:string;target_unit_reference:string|null;status:string;policy_eligibility_confirmed:boolean;denial_reason:string|null};

export function PhaPublicHousingLeaseTransferWorkspace(){
 const q=useQuery({queryKey:["pha-public-housing-lease-transfer"],queryFn:async()=>{
  // Generated Supabase types lag newly deployed PHA occupancy tables until schema refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any;
  const [l,t]=await Promise.all([
   client.from("pha_public_housing_leases").select("id,unit_reference,lease_start,lease_term_months,month_to_month_over_income,status,block_reason").order("created_at",{ascending:false}).limit(100),
   client.from("pha_public_housing_transfer_requests").select("id,transfer_type,current_unit_reference,target_unit_reference,status,policy_eligibility_confirmed,denial_reason").order("created_at",{ascending:false}).limit(100),
  ]);
  if(l.error)throw l.error;if(t.error)throw t.error;return{leases:(l.data??[]) as Lease[],transfers:(t.data??[]) as Transfer[]};
 }});
 const leases=q.data?.leases??[];const transfers=q.data?.transfers??[];
 return <AppShell title="Public Housing Leases & Transfers" subtitle="Occupancy lease controls, ACOP transfer eligibility, accommodation links, and unit movement history">
  <div className="grid gap-3 md:grid-cols-4"><Stat label="Active leases" value={leases.filter(l=>l.status==="active").length} hint="Executed standard Public Housing leases"/><Stat label="Over-income month-to-month" value={leases.filter(l=>l.status==="month_to_month_over_income").length} hint="Section 103 termination-route lease state"/><Stat label="Transfers open" value={transfers.filter(t=>["pending","eligible","unit_search","offered"].includes(t.status)).length} hint="Transfer cases still in process"/><Stat label="Transfers completed" value={transfers.filter(t=>t.status==="completed").length} hint="Auditable unit movement history"/></div>
  <div className="mt-4 grid gap-4 xl:grid-cols-2">
   <Panel title="Occupancy leases" description="24 CFR 966.4 required lease provisions and execution state."><div className="space-y-2">{leases.map(l=><div key={l.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">Unit {l.unit_reference}</div><div className="text-xs text-muted-foreground">Start {l.lease_start} · {l.lease_term_months} month term</div>{l.block_reason?<p className="mt-1 text-xs text-muted-foreground">{l.block_reason}</p>:null}</div><Pill tone={l.status==="active"?"seal":undefined}>{l.status.replaceAll("_"," ")}</Pill></div></div>)}{!q.isLoading&&leases.length===0?<p className="text-sm text-muted-foreground">No Public Housing occupancy leases are recorded.</p>:null}</div></Panel>
   <Panel title="Transfer workflow" description="24 CFR 960.202 requires written PHA policies governing participant transfers between units, developments, and programs."><div className="space-y-2">{transfers.map(t=><div key={t.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{t.transfer_type.replaceAll("_"," ")}</div><div className="text-xs text-muted-foreground">{t.current_unit_reference} → {t.target_unit_reference??"unit not assigned"} · ACOP eligibility {t.policy_eligibility_confirmed?"confirmed":"pending"}</div>{t.denial_reason?<p className="mt-1 text-xs text-muted-foreground">{t.denial_reason}</p>:null}</div><Pill tone={t.status==="completed"?"seal":undefined}>{t.status.replaceAll("_"," ")}</Pill></div></div>)}{!q.isLoading&&transfers.length===0?<p className="text-sm text-muted-foreground">No Public Housing transfer requests are active.</p>:null}</div></Panel>
  </div>
  <Panel className="mt-4" title="Occupancy safeguard" description="A Public Housing lease cannot activate until required federal lease provisions and both signatures are confirmed. Transfer eligibility remains ACOP-controlled, and reasonable-accommodation transfers must link to an approved accommodation record."/>
 </AppShell>;
}
