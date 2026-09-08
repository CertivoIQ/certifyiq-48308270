import {useEffect,useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Panel} from '@/components/ui-kit';
import {DOCUMENT_PROGRAMS,STATE_DOCUMENT_LIBRARIES,LIBRARY_REVIEW_DATE,documentChecklist,type DocumentProgram} from '@/lib/certification-document-library';

export function StateDocumentLibrary(){
 const [state,setState]=useState('FL');
 const [programs,setPrograms]=useState<DocumentProgram[]>(['LIHTC']);
 const [search,setSearch]=useState('');
 useEffect(()=>{
  const readLink=()=>{const code=/^#state-library-([A-Z]{2})$/.exec(window.location.hash)?.[1];if(code&&STATE_DOCUMENT_LIBRARIES.some(s=>s.code===code))setState(code);};
  readLink();window.addEventListener('hashchange',readLink);return()=>window.removeEventListener('hashchange',readLink);
 },[]);
 const library=STATE_DOCUMENT_LIBRARIES.find(s=>s.code===state)!;
 const checklist=useMemo(()=>documentChecklist(programs),[programs]);
 const visible=checklist.filter(d=>`${d.title} ${d.detail} ${d.timing} ${d.category}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.category.localeCompare(b.category)||a.title.localeCompare(b.title));
 const sourceTitle=(type:string)=>type.split('_').map(word=>/^(LIHTC|HUD|HOME|HTF|NHTF|QAP|VAWA|PHA|IRS|USDA|HCV|PBV|EIV)$/.test(word)?word:word.charAt(0)+word.slice(1).toLowerCase()).join(' ');
 const stateSources=library.agencies.flatMap(a=>a.sources.map(s=>({...s,agency:a.name,title:sourceTitle(s.type)}))).sort((a,b)=>a.title.localeCompare(b.title));
 const visibleSources=stateSources.filter(s=>`${s.title} ${s.agency}`.toLowerCase().includes(search.toLowerCase()));
 const download=()=>{
  const text=`# ${library.name} certification document library\n\nPrograms: ${programs.map(p=>DOCUMENT_PROGRAMS[p]).join(', ')}\n\nFederal reference review: ${LIBRARY_REVIEW_DATE}. This is a preparation checklist, not a file-completeness determination. State sources below are discovery references; current forms, revisions, local policies and property agreements still require review. Use the requirements applicable to the certification effective date.\n\n`+
   checklist.map(d=>`## ${d.title}\n\n${d.category} · ${d.timing}\n\n${d.detail}\n\n[Official source](${d.source})\n`).join('\n')+
   '\n## State agency sources\n\n'+library.agencies.map(a=>`### ${a.name}\n\n`+a.sources.map(s=>`- [${s.type.replaceAll('_',' ')}](${s.url})`).join('\n')).join('\n\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${state}-certification-document-checklist.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <Panel className="mb-6" title="State document libraries" description="Separate libraries for all 50 states and the District of Columbia, with program checklists and agency sources.">
  <div className="space-y-5 p-4">
   <nav aria-label="State libraries A to Z" className="space-y-3">
    <h2 className="text-lg font-semibold">Browse states A–Z</h2>
    <p className="text-sm text-muted-foreground">Open a letter, then choose a state to view its document checklist and agency sources.</p>
    <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-4 lg:grid-cols-6">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter=>{
     const states=STATE_DOCUMENT_LIBRARIES.filter(s=>s.name.startsWith(letter));
     return <details key={letter} className="rounded-lg border p-3"><summary aria-label={`States beginning with ${letter}`} className="cursor-pointer font-semibold">{letter}<span className="ml-2 text-xs font-normal text-muted-foreground">{states.length}</span></summary><ul className="mt-3 space-y-2">{states.map(s=><li key={s.code}><a href={`#state-library-${s.code}`} aria-current={state===s.code?'page':undefined} className="text-sm underline" onClick={()=>{setState(s.code);setSearch('');}}>{s.name}</a></li>)}</ul>{!states.length&&<p className="mt-2 text-xs text-muted-foreground">No states under {letter}.</p>}</details>;
    })}</div>
   </nav>
   <div id={`state-library-${state}`} className="scroll-mt-6"><h2 className="text-xl font-semibold">{library.name} document library</h2><p className="mt-1 text-sm text-muted-foreground">Search titled documents below. Select the programs that apply to this property.</p></div>
   <div className="flex flex-wrap items-end gap-4"><label className="flex flex-col gap-1 text-sm">State library<select className="rounded-md border bg-background p-2" value={state} onChange={e=>setState(e.target.value)}>{STATE_DOCUMENT_LIBRARIES.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select></label><Button variant="outline" onClick={download} disabled={!programs.length}>Download this checklist</Button></div>
   <fieldset><legend className="mb-2 font-medium">Programs at this property — select every funding layer</legend><div className="grid gap-2 md:grid-cols-2">{Object.entries(DOCUMENT_PROGRAMS).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={programs.includes(key as DocumentProgram)} onChange={e=>setPrograms(previous=>e.target.checked?[...previous,key as DocumentProgram]:previous.filter(p=>p!==key))}/>{label}</label>)}</div></fieldset>
   <div className="rounded-lg border bg-muted/30 p-3 text-sm"><strong>{library.name}: preparation checklist</strong><p className="mt-1">Core documents, conditional evidence and property records are listed separately. A file is complete only after applicable state forms, local agency policies, funding agreements and effective-date rules are reconciled. This library does not mark a certification compliant.</p><p className="mt-2">Use the rules in effect for the certification date, including the agency’s HOTMA implementation. A printed historical passbook rate or income limit is source evidence, not current authority.</p></div>
   <label className="flex flex-col gap-1 text-sm">Find a document<input className="rounded-md border bg-background p-2" value={search} onChange={e=>setSearch(e.target.value)} placeholder="VAWA, consent, income, lease…"/></label>
   <section aria-label={`${library.name} agency documents and forms`} className="space-y-3"><h3 className="font-semibold">{library.name} agency documents and forms</h3><p className="text-sm text-muted-foreground">Official source directory, primarily for LIHTC. Current form revisions and program-specific requirements have not all been validated. Local HOME and PHA forms must be checked with the administering city, county or PHA.</p><ul className="grid gap-3 md:grid-cols-2">{visibleSources.map(s=><li key={`${s.agency}-${s.url}`} className="rounded-lg border p-3"><a className="text-sm font-medium underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a><p className="mt-1 text-xs text-muted-foreground">{s.agency}</p></li>)}</ul>{!visibleSources.length&&<p className="text-sm text-muted-foreground">No state agency sources match this search. Program documents are listed below.</p>}</section>
   <h3 className="font-semibold">Program certification documents</h3>
   {!programs.length?<p>Select at least one program to see its checklist.</p>:<div className="space-y-3">{visible.map(d=><article key={d.id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{d.title}</h3><span className="text-xs text-muted-foreground">{d.category}</span></div><p className="mt-1 text-xs text-muted-foreground">{d.timing} · {programs.filter(p=>d.applies.includes(p)).map(p=>DOCUMENT_PROGRAMS[p]).join(' / ')}</p><p className="mt-2 text-sm">{d.detail}</p><a className="mt-2 inline-block text-sm underline" href={d.source} target="_blank" rel="noreferrer">Official requirements / forms</a></article>)}{!visible.length&&<p>No documents match this search.</p>}</div>}
   <p className="text-xs text-muted-foreground">Federal reference review: {LIBRARY_REVIEW_DATE}. VAWA notices and blank forms belong in the library. Completed survivor documentation is conditional and must be kept confidential, outside shared records.</p>
  </div>
 </Panel>;
}

