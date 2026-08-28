import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, ClipboardCheck, FileCheck2, Users, ArrowLeftRight, Accessibility, ListChecks } from "lucide-react";
import { useWorkspaceProfile, type PhaAgencyRole } from "@/hooks/use-workspace-profile";
import { classifyPhaHotmaImplementation } from "@/lib/pha-hotma-implementation-engine.mjs";
import { supabase } from "@/integrations/supabase/client";

const PROGRAM_LABELS: Record<string, string> = { hcv: "HCV", pbv: "Project-Based Voucher", public_housing: "Public Housing", mod_rehab: "Moderate Rehabilitation" };
const ENGINE_PROGRAMS: Record<string, string> = { hcv: "HCV_TENANT_BASED", pbv: "HUD_PBV", public_housing: "PUBLIC_HOUSING", mod_rehab: "MOD_REHAB" };
const COHORT_LABELS: Record<string, string> = { NON_MTW_NON_FRS: "Non-MTW / Non-FRS", INITIAL_MTW: "Initial MTW", MTW_EXPANSION: "MTW Expansion", FRS_EXCLUSIVE: "FRS-Exclusive" };

type DashboardMetrics = { familyActions:number; reexamsDue:number; blocked50058:number; inspectionsAction:number; openAccommodations:number; activeWaiting:number; portabilityOpen:number };
const EMPTY:DashboardMetrics={familyActions:0,reexamsDue:0,blocked50058:0,inspectionsAction:0,openAccommodations:0,activeWaiting:0,portabilityOpen:0};
const ROLE_TITLES:Record<string,string>={workspace_owner:"PHA Command Center",executive:"Executive Command Center",agency_admin:"Agency Administration",compliance_admin:"Compliance Command Center",hcv_pbv_specialist:"HCV / PBV Operations",public_housing_specialist:"Public Housing Operations",inspection_staff:"Inspection Operations"};

function actionCards(role:PhaAgencyRole|null){
 const common=[{to:"/pha-families",Icon:Users,title:"Family & eligibility queue",detail:"Admissions, annual and interim reexaminations"},{to:"/pha-50058",Icon:FileCheck2,title:"HUD-50058 queue",detail:"Ready, blocked and exception transactions"}];
 if(role==="inspection_staff") return [{to:"/pha-inspections",Icon:ClipboardCheck,title:"Inspection queue",detail:"NSPIRE/HQS inspections, deficiencies and reinspections"},{to:"/pha-accommodations",Icon:Accessibility,title:"Accommodation impacts",detail:"Inspection-related accessibility and communication requests"}];
 if(role==="hcv_pbv_specialist") return [...common,{to:"/pha-portability",Icon:ArrowLeftRight,title:"HCV portability",detail:"Outgoing/incoming ports and absorb/bill decisions"},{to:"/pha-waiting-lists",Icon:ListChecks,title:"Waiting lists",detail:"HCV applicant selection and preference controls"}];
 if(role==="public_housing_specialist") return [...common,{to:"/pha-waiting-lists",Icon:ListChecks,title:"Waiting lists",detail:"Public Housing applicant selection and ACOP controls"},{to:"/pha-inspections",Icon:ClipboardCheck,title:"NSPIRE inspections",detail:"Public Housing inspection and deficiency follow-up"}];
 return [...common,{to:"/pha-inspections",Icon:ClipboardCheck,title:"Inspection queue",detail:"NSPIRE inspections and corrective actions"},{to:"/pha-accommodations",Icon:Accessibility,title:"Reasonable accommodations",detail:"Open requests and interactive-process holds"}];
}

export function PhaDashboard() {
  const { profile, phaRole } = useWorkspaceProfile();
  const metrics=useQuery<DashboardMetrics>({queryKey:["pha-command-center-metrics",phaRole],queryFn:async()=>{ // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client=supabase as any;
    const [families,reexams,tx,inspections,ra,waiting,ports]=await Promise.all([
      client.from("pha_family_actions").select("id",{count:"exact",head:true}).neq("workflow_status","routed"),
      client.from("pha_family_actions").select("id",{count:"exact",head:true}).in("action_type",["annual_reexamination","interim_reexamination"]).not("due_date","is",null).lte("due_date",new Date(Date.now()+30*86400000).toISOString().slice(0,10)).neq("workflow_status","routed"),
      client.from("pha_50058_transactions").select("id",{count:"exact",head:true}).in("routing_status",["BLOCKED","AWAITING_HUD_GUIDANCE"]),
      client.from("pha_inspections").select("id",{count:"exact",head:true}).in("result",["scheduled","in_progress","fail"]),
      client.from("pha_reasonable_accommodation_requests").select("id",{count:"exact",head:true}).in("status",["received","interactive_process"]),
      client.from("pha_waiting_list_applicants").select("id",{count:"exact",head:true}).eq("status","active"),
      client.from("pha_portability_cases").select("id",{count:"exact",head:true}).not("status","in",'(completed,cancelled)'),
    ]);
    for(const r of [families,reexams,tx,inspections,ra,waiting,ports]) if(r.error) throw r.error;
    return {familyActions:families.count??0,reexamsDue:reexams.count??0,blocked50058:tx.count??0,inspectionsAction:inspections.count??0,openAccommodations:ra.count??0,activeWaiting:waiting.count??0,portabilityOpen:ports.count??0};
  }});
  const m=metrics.data??EMPTY;
  const hotma103 = profile.derived_overlays.includes("hotma_103");
  const selectedProgram = profile.pha_programs.find((program) => ENGINE_PROGRAMS[program]);
  const implementationRoute = selectedProgram && profile.pha_hotma_cohort ? classifyPhaHotmaImplementation({module_id:"PHA-HOTMA-FULL-SECTIONS-102-104",program:ENGINE_PROGRAMS[selectedProgram],program_applicability_validated:true,pha_cohort:profile.pha_hotma_cohort,transaction_effective_date:"2027-01-01",controlled_source_release_approved:true,current_rule_version_validated:true,source_status_conflict:false,hud_50058_reporting_path:profile.hud_50058_reporting_path??undefined}) : null;
  const futureGuidance = implementationRoute?.reason_code === "PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE";
  const cohortConfigured = Boolean(profile.pha_hotma_cohort && profile.hud_50058_reporting_path);
  const readinessHint = !cohortConfigured ? "Complete PHA cohort and HUD-50058 routing setup" : futureGuidance ? "HUD cohort-specific deadline guidance pending" : "Standard PIH implementation route configured";
  const cards=actionCards(phaRole);
  const isExecutive=phaRole==="executive";
  return <AppShell title={ROLE_TITLES[phaRole??""]??"PHA Command Center"} subtitle={isExecutive?"Agency-wide risk, workload, and regulatory readiness":"Role-prioritized PHA operations, exceptions, and regulatory readiness"} actions={<Button size="sm" asChild><Link to={phaRole==="inspection_staff"?"/pha-inspections":"/launchpad"}>{phaRole==="inspection_staff"?"Open inspection queue":"Review agency setup"}</Link></Button>}>
    <div className="flex flex-wrap gap-2">{(profile.pha_programs.length?profile.pha_programs:["hcv","pbv","public_housing"]).map(program=><Pill key={program} tone="seal">{PROGRAM_LABELS[program]??program}</Pill>)}{profile.pha_hotma_cohort?<Pill>{COHORT_LABELS[profile.pha_hotma_cohort]??profile.pha_hotma_cohort}</Pill>:<Pill>PHA cohort not configured</Pill>}{phaRole?<Pill>{phaRole.replaceAll("_"," ")}</Pill>:null}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Families requiring action" value={m.familyActions} hint="Open family workflows"/><Stat label="Reexams due ≤30 days" value={m.reexamsDue} hint="Annual and interim workload"/><Stat label="HUD-50058 exceptions" value={m.blocked50058} hint="Blocked or guidance-pending"/><Stat label="HOTMA readiness" value={cohortConfigured?(futureGuidance?"Guidance pending":"Configured"):"Setup required"} hint={readinessHint}/><Stat label="Inspections requiring action" value={m.inspectionsAction} hint="Scheduled, active or failed"/></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3"><Stat label="Open accommodations" value={m.openAccommodations} hint="Received or interactive process"/><Stat label="Active waiting applicants" value={m.activeWaiting} hint="Visible under role-scoped RLS"/><Stat label="Open portability cases" value={m.portabilityOpen} hint="HCV operations only"/></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]"><Panel title={isExecutive?"Agency risk & workload":"Action Center"} description={isExecutive?"Executive view is read-only and prioritizes aggregate exposure.":"Work is prioritized by role, urgency, and regulatory consequence."}><div className="grid gap-3 sm:grid-cols-2">{cards.map(({to,Icon,title,detail})=><Link key={to} to={to} className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"><Icon className="size-5 text-primary"/><h3 className="mt-3 font-display text-[15px]">{title}</h3><p className="mt-1 text-[12.5px] text-muted-foreground">{detail}</p></Link>)}</div></Panel><Panel title="HOTMA implementation" description="Applicability and deadline routing are derived from agency programs, cohort, effective date, and reporting path."><div className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span>Sections 102 / 104</span><Pill tone="seal">Applicable</Pill></div><div className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span>Section 103 over-income</span><Pill tone={hotma103?"seal":undefined}>{hotma103?"Applicable":"Not applicable"}</Pill></div><div className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span>Implementation cohort</span><Pill>{profile.pha_hotma_cohort?COHORT_LABELS[profile.pha_hotma_cohort]:"Setup required"}</Pill></div><div className="rounded-md border border-border bg-muted/30 p-3 text-[12.5px] text-muted-foreground">{!cohortConfigured?"Configure the PHA cohort and HUD-50058 reporting path before CertivoIQ applies an enforcement timeline.":futureGuidance?"This MTW/FRS cohort is blocked from a generic January 1, 2027 enforcement assumption until applicable HUD guidance is controlled and validated.":"For this non-MTW/non-FRS route, January 1, 2027 is the current full-compliance enforcement date for Sections 102 and 104."}</div></div></Panel></div>
    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0"/><span>{isExecutive?"Executive access is read-only at the database policy layer; operational mutations remain with authorized agency roles.":"This command center is role-filtered, while database RLS remains the actual authorization boundary."}</span></div></div>
  </AppShell>;
}
