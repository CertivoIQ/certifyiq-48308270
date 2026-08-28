import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Release={id:string;release_key:string;source_url:string;source_version:string;published_date:string|null;source_checksum:string|null;status:string;verified_at:string|null;activated_at:string|null;notes:string|null};
type Standard={id:string;release_id:string|null;standard_name:string;inspectable_area:string;deficiency_reference:string;severity:string;correction_hours:number;hcv_correction_hours:number;hcv_pass_fail:string;source_status:string};

export function PhaNspireStandardsWorkspace(){
 const query=useQuery({queryKey:["pha-nspire-standards-control"],queryFn:async()=>{
  // Generated Supabase types lag newly deployed governance tables until schema types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any;
  const [r,s]=await Promise.all([
   client.from("pha_nspire_standard_releases").select("id,release_key,source_url,source_version,published_date,source_checksum,status,verified_at,activated_at,notes").order("created_at",{ascending:false}),
   client.from("pha_nspire_deficiency_standards").select("id,release_id,standard_name,inspectable_area,deficiency_reference,severity,correction_hours,hcv_correction_hours,hcv_pass_fail,source_status")
  ]);
  if(r.error)throw r.error;if(s.error)throw s.error;return{releases:(r.data??[]) as Release[],standards:(s.data??[]) as Standard[]};
 }});
 const releases=query.data?.releases??[];const standards=query.data?.standards??[];const current=releases.find(r=>r.status==="current")??null;const currentRows=current?standards.filter(s=>s.release_id===current.id&&s.source_status==="current").length:0;
 return <AppShell title="NSPIRE Standards Control" subtitle="HUD source release, deficiency-row population, correction timeframes, HCV pass/fail, and activation state">
  <div className="grid gap-3 md:grid-cols-3"><Stat label="Release status" value={current?"Active":"Pending"} hint={current?current.source_version:"No verified release is active"}/><Stat label="Active deficiencies" value={currentRows} hint="Current controlled deficiency/location rows"/><Stat label="Registry rows" value={standards.length} hint="Loaded rows across all release states"/></div>
  <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
   <Panel title="HUD release manifest" description="A release cannot activate without an official HUD source, checksum, verification record, and populated deficiency registry."><div className="space-y-2">{releases.map(r=><div key={r.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{r.source_version}</div><div className="text-xs text-muted-foreground">{r.release_key} · published {r.published_date??"—"}</div></div><Pill tone={r.status==="current"?"seal":undefined}>{r.status}</Pill></div><div className="mt-2 text-xs text-muted-foreground">Checksum: {r.source_checksum?"recorded":"required before activation"}</div>{r.notes?<p className="mt-2 text-xs text-muted-foreground">{r.notes}</p>:null}</div>)}</div></Panel>
   <Panel title="Deficiency registry" description="Correction timeframes are deficiency-specific. Voucher-program deadlines and pass/fail are retained separately from Public Housing/MFH correction windows."><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Standard</th><th className="pb-3">Area</th><th className="pb-3">Severity</th><th className="pb-3">General</th><th className="pb-3">HCV</th></tr></thead><tbody>{standards.slice(0,100).map(s=><tr key={s.id} className="border-t border-border"><td className="py-3 pr-3"><div className="font-medium">{s.standard_name}</div><div className="text-xs text-muted-foreground">{s.deficiency_reference}</div></td><td className="py-3 pr-3">{s.inspectable_area}</td><td className="py-3 pr-3">{s.severity.replaceAll("_"," ")}</td><td className="py-3 pr-3">{s.correction_hours}h</td><td className="py-3">{s.hcv_correction_hours}h · {s.hcv_pass_fail}</td></tr>)}{!query.isLoading&&standards.length===0?<tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No deficiency rows loaded. Activation is correctly blocked.</td></tr>:null}</tbody></table></div></Panel>
  </div>
  <Panel className="mt-4" title="Fail-closed activation" description="CertivoIQ does not infer a correction deadline from severity when HUD publishes a deficiency-specific timeframe. NSPIRE deficiencies remain blocked until the exact standard/location row is part of a verified current release."/>
 </AppShell>;
}
