import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type ActionRow={id:string;family_reference:string;program_code:string;action_type:string;effective_date:string;workflow_status:string;verification_complete:boolean;eiv_review_complete:boolean;calculation_complete:boolean;notice_complete:boolean};
export function PhaReportsWorkspace(){
 const q=useQuery<ActionRow[]>({queryKey:["pha-report-actions"],queryFn:async()=>{ // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any; const {data,error}=await client.from("pha_family_actions").select("id,family_reference,program_code,action_type,effective_date,workflow_status,verification_complete,eiv_review_complete,calculation_complete,notice_complete").order("updated_at",{ascending:false}); if(error) throw error; return data??[]; }});
 const rows=q.data??[];
 async function exportManifest(row:ActionRow){ // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any; const {data,error}=await client.rpc("build_pha_family_evidence_manifest",{target_family_action_id:row.id}); if(error) throw error; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${row.family_reference}-${row.program_code}-evidence-manifest.json`; a.click(); URL.revokeObjectURL(url); }
 const complete=rows.filter(r=>r.verification_complete&&r.eiv_review_complete&&r.calculation_complete&&r.notice_complete).length;
 return <AppShell title="PHA Reports & Evidence" subtitle="Executive workload reporting and family-level evidence manifests for audit and HUD review">
  <div className="grid gap-3 sm:grid-cols-3"><Stat label="Family actions" value={rows.length} hint="Visible under agency role scope"/><Stat label="Workflow complete" value={complete} hint="Verification, calculation and notice complete"/><Stat label="Open / blocked" value={rows.filter(r=>!["routed"].includes(r.workflow_status)).length} hint="Requires operational attention"/></div>
  <Panel className="mt-4" title="Family evidence manifests" description="Exports the family action, evidence, calculation, notices, HUD-50058 transaction, rule/control state, and integrity flags as one audit record."><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective</th><th className="pb-3">Stage</th><th className="pb-3">Manifest</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-border"><td className="py-3 pr-3 font-medium">{r.family_reference}</td><td className="py-3 pr-3">{r.program_code.replaceAll("_"," ").toUpperCase()}</td><td className="py-3 pr-3">{r.action_type.replaceAll("_"," ")}</td><td className="py-3 pr-3 font-mono text-xs">{r.effective_date}</td><td className="py-3 pr-3"><Pill tone={r.workflow_status==="routed"?"seal":undefined}>{r.workflow_status.replaceAll("_"," ")}</Pill></td><td className="py-3"><button type="button" onClick={()=>void exportManifest(r)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Export JSON</button></td></tr>)}</tbody></table></div></Panel>
 </AppShell>;
}
