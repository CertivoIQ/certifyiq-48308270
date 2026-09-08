import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { StateDocumentLibrary } from "@/components/state-document-library";

type SourceRow={id:string;source_scope:string;program_code:string|null;authority_key:string;source_type:string;title:string;issuing_authority:string;source_reference:string;effective_date:string|null;version_label:string|null;checksum:string|null;status:string};
type TemplateRow={id:string;program_code:string;template_key:string;template_type:string;title:string;version_label:string;status:string;source_library_id:string};

export function PhaSourceLibraryWorkspace(){
 const query=useQuery({queryKey:["pha-source-library"],queryFn:async()=>{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client=supabase as any;
  const [s,t]=await Promise.all([
   client.from("pha_source_library").select("id,source_scope,program_code,authority_key,source_type,title,issuing_authority,source_reference,effective_date,version_label,checksum,status").order("title"),
   client.from("pha_controlled_templates").select("id,program_code,template_key,template_type,title,version_label,status,source_library_id").order("title")
  ]);
  if(s.error)throw s.error;if(t.error)throw t.error;return{sources:(s.data??[]) as SourceRow[],templates:(t.data??[]) as TemplateRow[]};
 }});
 const sources=query.data?.sources??[];const templates=query.data?.templates??[];
 const current=sources.filter(x=>x.status==="current").length;const blocked=sources.filter(x=>x.status==="blocked"||x.status==="pending").length;const validatedTemplates=templates.filter(x=>x.status==="validated").length;
 return <AppShell title="Source Library & Forms" subtitle="Version-controlled federal and agency authority, forms, notices, letters, and checklists">
  <StateDocumentLibrary />
  <div className="grid gap-3 md:grid-cols-3"><Stat label="Current sources" value={current} hint="Validated current authority records"/><Stat label="Pending / blocked" value={blocked} hint="Authority not eligible for rule or template release"/><Stat label="Validated templates" value={validatedTemplates} hint="Forms and notices released for use"/></div>
  <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
   <Panel title="Controlled sources" description="Federal authority is staff-governed. Agency sources are workspace-scoped and versioned."><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Source</th><th className="pb-3">Scope</th><th className="pb-3">Program</th><th className="pb-3">Version</th><th className="pb-3">Status</th></tr></thead><tbody>{sources.map(s=><tr key={s.id} className="border-t border-border"><td className="py-3 pr-3"><div className="font-medium">{s.title}</div><div className="text-xs text-muted-foreground">{s.issuing_authority} · {s.authority_key}</div></td><td className="py-3 pr-3">{s.source_scope}</td><td className="py-3 pr-3">{s.program_code?.replaceAll("_"," ").toUpperCase()??"ALL"}</td><td className="py-3 pr-3">{s.version_label??s.effective_date??"—"}</td><td className="py-3"><Pill tone={s.status==="current"?"seal":undefined}>{s.status}</Pill></td></tr>)}{!query.isLoading&&sources.length===0?<tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No controlled sources loaded yet.</td></tr>:null}</tbody></table></div></Panel>
   <Panel title="Controlled templates" description="Templates cannot validate unless their source is current and any linked agency policy overlay is active and validated."><div className="space-y-2">{templates.map(t=><div key={t.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{t.program_code.toUpperCase()} · {t.template_type} · {t.version_label}</div></div><Pill tone={t.status==="validated"?"seal":undefined}>{t.status}</Pill></div></div>)}{!query.isLoading&&templates.length===0?<p className="text-sm text-muted-foreground">No controlled templates loaded yet.</p>:null}</div></Panel>
  </div>
  <Panel className="mt-4" title="Release safeguard" description="Pending, blocked, superseded, or unvalidated authority cannot release a form or notice template. Source version, checksum, effective date, validator, and policy overlay remain independently traceable."/>
 </AppShell>;
}
