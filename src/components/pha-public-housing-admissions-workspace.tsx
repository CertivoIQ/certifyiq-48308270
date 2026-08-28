import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Control={id:string;fiscal_year:number;public_housing_waiting_list_admissions:number;public_housing_eli_admissions:number;hcv_excess_eli_admissions:number;qualifying_high_poverty_low_income_occupancies:number;validated:boolean};
type Development={id:string;development_reference:string;occupancy_type:string;covered_by_deconcentration:boolean;established_income_range_status:string;active:boolean};
type Offer={id:string;unit_reference:string;offer_date:string;targeting_status:string;deconcentration_status:string;final_selection_status:string;block_reason:string|null};

export function PhaPublicHousingAdmissionsWorkspace(){
 const q=useQuery({queryKey:["pha-public-housing-admissions"],queryFn:async()=>{
  // Generated Supabase types lag newly deployed PHA admission tables until schema refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any;
  const [controls,developments,offers]=await Promise.all([
   client.from("pha_public_housing_admission_year_controls").select("id,fiscal_year,public_housing_waiting_list_admissions,public_housing_eli_admissions,hcv_excess_eli_admissions,qualifying_high_poverty_low_income_occupancies,validated").order("fiscal_year",{ascending:false}),
   client.from("pha_public_housing_development_profiles").select("id,development_reference,occupancy_type,covered_by_deconcentration,established_income_range_status,active").eq("active",true).order("development_reference"),
   client.from("pha_public_housing_unit_offers").select("id,unit_reference,offer_date,targeting_status,deconcentration_status,final_selection_status,block_reason").order("created_at",{ascending:false}).limit(100),
  ]);
  for(const result of [controls,developments,offers])if(result.error)throw result.error;
  return{controls:(controls.data??[]) as Control[],developments:(developments.data??[]) as Development[],offers:(offers.data??[]) as Offer[]};
 }});
 const controls=q.data?.controls??[];const developments=q.data?.developments??[];const offers=q.data?.offers??[];const activeControl=controls.find(x=>x.validated)??null;
 return <AppShell title="Public Housing Admissions" subtitle="Federal targeting, deconcentration, designated-development, accessibility, and final unit-offer controls">
  <div className="grid gap-3 md:grid-cols-4">
   <Stat label="Validated fiscal year" value={activeControl?.fiscal_year??"None"} hint="ACOP + PHA Annual Plan controls"/>
   <Stat label="PH admissions" value={activeControl?.public_housing_waiting_list_admissions??0} hint="Waiting-list admissions this fiscal year"/>
   <Stat label="ELI admissions" value={activeControl?.public_housing_eli_admissions??0} hint="Tracks the 40% annual targeting requirement"/>
   <Stat label="Blocked offers" value={offers.filter(x=>x.final_selection_status==="blocked").length} hint="Final unit offers needing resolution"/>
  </div>
  <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
   <Panel title="Development admission profiles" description="Deconcentration status and occupancy designation are evaluated separately from waiting-list preference rank.">
    <div className="space-y-2">{developments.map(d=><div key={d.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{d.development_reference}</div><div className="text-xs text-muted-foreground">{d.occupancy_type.replaceAll("_"," ")} · {d.covered_by_deconcentration?"deconcentration covered":"exempt/not covered"}</div></div><Pill tone={d.established_income_range_status==="within"?"seal":undefined}>{d.established_income_range_status.replaceAll("_"," ")}</Pill></div></div>)}{!q.isLoading&&developments.length===0?<p className="text-sm text-muted-foreground">No Public Housing development profiles are configured.</p>:null}</div>
   </Panel>
   <Panel title="Final unit-offer control" description="A selected applicant is not admission-ready until the federal unit-assignment controls clear.">
    <div className="space-y-2">{offers.map(o=><div key={o.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">Unit {o.unit_reference}</div><div className="text-xs text-muted-foreground">{o.offer_date} · targeting {o.targeting_status.replaceAll("_"," ")} · deconcentration {o.deconcentration_status.replaceAll("_"," ")}</div>{o.block_reason?<p className="mt-1 text-xs text-muted-foreground">{o.block_reason}</p>:null}</div><Pill tone={o.final_selection_status==="ready"?"seal":undefined}>{o.final_selection_status}</Pill></div></div>)}{!q.isLoading&&offers.length===0?<p className="text-sm text-muted-foreground">No final Public Housing unit offers have been evaluated yet.</p>:null}</div>
   </Panel>
  </div>
  <Panel className="mt-4" title="Federal admission safeguards" description="24 CFR 960.202 requires annual extremely-low-income targeting and deconcentration controls. 24 CFR 960.206 requires accessibility-first unit matching and limits two-or-more-bedroom assistance for certain single persons. Mixed-population and designated-development eligibility are evaluated independently of local preference ranking."/>
 </AppShell>;
}
