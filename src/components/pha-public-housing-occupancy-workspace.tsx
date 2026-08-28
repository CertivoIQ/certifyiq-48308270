import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Lease={id:string;unit_reference:string;lease_start:string;status:string;required_lease_provisions_confirmed:boolean;grievance_procedure_included:boolean;signature_complete:boolean};
type Transfer={id:string;transfer_reason:string;current_unit_reference:string;offered_unit_reference:string|null;status:string;grievance_status:string;block_reason:string|null};

export function PhaPublicHousingOccupancyWorkspace(){
 const q=useQuery({queryKey:["pha-public-housing-occupancy"],queryFn:async()=>{
  // Generated Supabase types lag these PHA occupancy tables until schema refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any;
  const [l,t]=await Promise.all([
   client.from("pha_public_housing_leases").select("id,unit_reference,lease_start,status,required_lease_provisions_confirmed,grievance_procedure_included,signature_complete").order("created_at",{ascending:false}).limit(100),
   client.from("pha_public_housing_transfers").select("id,transfer_reason,current_unit_reference,offered_unit_reference,status,grievance_status,block_reason").order("created_at",{ascending:false}).limit(100),
  ]);
  if(l.error)throw l.error;if(t.error)throw t.error;return{leases:(l.data??[]) as Lease[],transfers:(t.data??[]) as Transfer[]};
 }});
 const leases=q.data?.leases??[];const transfers=q.data?.transfers??[];
 return <AppShell title="Public Housing Occupancy & Transfers" subtitle="Lease execution, right-size transfers, grievance holds, and accommodation-linked moves">
  <div className="grid gap-3 md:grid-cols-3"><Stat label="Executed leases" value={leases.filter(l=>l.status==="executed").length} hint="Leases with required provisions and signatures confirmed"/><Stat label="Transfers ready" value={transfers.filter(t=>t.status==="ready").length} hint="Moves cleared after federal and ACOP controls"/><Stat label="Transfers blocked" value={transfers.filter(t=>t.status==="blocked").length} hint="Notice, grievance, unit, or accommodation controls unresolved"/></div>
  <div className="mt-4 grid gap-4 xl:grid-cols-2">
   <Panel title="Public Housing leases" description="24 CFR 966.4 lease and grievance controls."><div className="space-y-2">{leases.map(l=><div key={l.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">Unit {l.unit_reference}</div><div className="text-xs text-muted-foreground">Lease start {l.lease_start} · provisions {l.required_lease_provisions_confirmed?"confirmed":"pending"} · grievance {l.grievance_procedure_included?"included":"pending"}</div></div><Pill tone={l.status==="executed"?"seal":undefined}>{l.status}</Pill></div></div>)}{!q.isLoading&&leases.length===0?<p className="text-sm text-muted-foreground">No Public Housing lease records are active.</p>:null}</div></Panel>
   <Panel title="Transfers" description="Family-composition and adverse transfers cannot bypass notice or grievance protections."><div className="space-y-2">{transfers.map(t=><div key={t.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{t.current_unit_reference} → {t.offered_unit_reference??"unit pending"}</div><div className="text-xs text-muted-foreground">{t.transfer_reason.replaceAll("_"," ")} · grievance {t.grievance_status.replaceAll("_"," ")}</div>{t.block_reason?<p className="mt-1 text-xs text-muted-foreground">{t.block_reason}</p>:null}</div><Pill tone={t.status==="ready"||t.status==="completed"?"seal":undefined}>{t.status}</Pill></div></div>)}{!q.isLoading&&transfers.length===0?<p className="text-sm text-muted-foreground">No Public Housing transfers are active.</p>:null}</div></Panel>
  </div>
  <Panel className="mt-4" title="Occupancy safeguard" description="A family-composition transfer requires an available appropriate-size unit. An adverse transfer cannot take effect until specific-ground notice, explanation and grievance rights, the request period, and any requested grievance are complete. Reasonable-accommodation transfers remain linked to the controlled accommodation request."/>
 </AppShell>;
}
