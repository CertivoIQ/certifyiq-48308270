import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";

type TransitionProfile = {
  id: string;
  program_code: string;
  current_standard: "hqs_previous" | "nspire";
  planned_nspire_date: string | null;
  hud_notification_status: string;
  owner_family_notification_complete: boolean;
  inspector_training_complete: boolean;
  source_status: string;
};

type Inspection = {
  id: string;
  program_code: string;
  unit_reference: string;
  inspection_type: string;
  scheduled_for: string | null;
  inspected_at: string | null;
  standard_used: string;
  result: string;
};

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function programLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export function PhaInspectionsWorkspace() {
  const queryClient = useQueryClient();
  const { profile, workspaceUserId, phaRole } = useWorkspaceProfile();
  const isAdmin = phaRole === "workspace_owner" || phaRole === "agency_admin" || phaRole === "compliance_admin";
  const [programCode, setProgramCode] = useState(profile.pha_programs[0] ?? "hcv");
  const [unitReference, setUnitReference] = useState("");
  const [inspectionType, setInspectionType] = useState("periodic");
  const [scheduledFor, setScheduledFor] = useState("");
  const [transitionProgram, setTransitionProgram] = useState(profile.pha_programs[0] ?? "hcv");
  const [plannedDate, setPlannedDate] = useState("2027-02-01");
  const [currentStandard, setCurrentStandard] = useState<"hqs_previous" | "nspire">("hqs_previous");
  const [hudStatus, setHudStatus] = useState("planned");
  const [trainingComplete, setTrainingComplete] = useState(false);
  const [notificationsComplete, setNotificationsComplete] = useState(false);

  const query = useQuery<{ transitions: TransitionProfile[]; inspections: Inspection[] }>({
    queryKey: ["pha-inspections-workspace", workspaceUserId],
    enabled: !!workspaceUserId && profile.organization_type === "pha",
    queryFn: async () => {
      // Generated Supabase types lag the PHA inspection migrations until the next schema refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [transitionResult, inspectionsResult] = await Promise.all([
        client.from("pha_inspection_transition_profiles").select("id, program_code, current_standard, planned_nspire_date, hud_notification_status, owner_family_notification_complete, inspector_training_complete, source_status").eq("workspace_user_id", workspaceUserId).order("program_code"),
        client.from("pha_inspections").select("id, program_code, unit_reference, inspection_type, scheduled_for, inspected_at, standard_used, result").eq("workspace_user_id", workspaceUserId).order("created_at", { ascending: false }),
      ]);
      if (transitionResult.error) throw transitionResult.error;
      if (inspectionsResult.error) throw inspectionsResult.error;
      return { transitions: transitionResult.data ?? [], inspections: inspectionsResult.data ?? [] };
    },
  });

  const transitions = query.data?.transitions ?? [];
  const inspections = query.data?.inspections ?? [];
  const transitionByProgram = useMemo(() => new Map(transitions.map((item) => [item.program_code, item])), [transitions]);
  const scheduled = inspections.filter((item) => item.result === "scheduled").length;
  const failed = inspections.filter((item) => item.result === "fail").length;
  const nspireReady = transitions.filter((item) => item.current_standard === "nspire" && item.source_status === "current").length;

  const saveTransition = useMutation({
    mutationFn: async () => {
      if (!workspaceUserId) throw new Error("PHA workspace is not resolved.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const publicHousing = transitionProgram === "public_housing";
      const { error } = await client.from("pha_inspection_transition_profiles").upsert({
        workspace_user_id: workspaceUserId,
        program_code: transitionProgram,
        current_standard: publicHousing ? "nspire" : currentStandard,
        planned_nspire_date: publicHousing ? null : plannedDate || null,
        hud_notification_status: hudStatus,
        owner_family_notification_complete: notificationsComplete,
        inspector_training_complete: trainingComplete,
        source_authority: publicHousing ? "NSPIRE final rule / 24 CFR part 5" : "PIH 2026-18",
        source_status: "current",
      }, { onConflict: "workspace_user_id,program_code" });
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-inspections-workspace", workspaceUserId] }),
  });

  const scheduleInspection = useMutation({
    mutationFn: async () => {
      if (!workspaceUserId || !unitReference.trim() || !scheduledFor) throw new Error("Program, unit reference, and scheduled date are required.");
      if (!transitionByProgram.has(programCode)) throw new Error("Configure the inspection transition profile for this program before scheduling.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_inspections").insert({
        workspace_user_id: workspaceUserId,
        program_code: programCode,
        unit_reference: unitReference.trim(),
        inspection_type: inspectionType,
        scheduled_for: scheduledFor,
        standard_used: "hqs_previous",
        result: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setUnitReference("");
      await queryClient.invalidateQueries({ queryKey: ["pha-inspections-workspace", workspaceUserId] });
    },
  });

  return (
    <AppShell title="NSPIRE Dashboard" subtitle="Operate Public Housing inspections and control the HCV, PBV, and Mod Rehab transition from previous HQS to NSPIRE">
      <nav aria-label="NSPIRE dashboard menu" className="mb-4 flex flex-wrap gap-2 rounded-lg border border-border bg-card p-2">
        <a href="#overview" className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">Overview</a>
        <a href="#transition-controls" className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">Transition &amp; Scheduling</a>
        <Link to="/pha-nspire-standards" className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">Standards Control</Link>
        <Link to="/pha-reports" className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">Reports &amp; Evidence</Link>
        <Link to="/findings" className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">Deficiencies &amp; Corrections</Link>
      </nav>

      <div id="overview" className="grid scroll-mt-28 gap-3 md:grid-cols-3">
        <Stat label="Scheduled inspections" value={scheduled} hint="Upcoming agency inspection work" />
        <Stat label="Open failed inspections" value={failed} hint="Failed records awaiting correction or reinspection" />
        <Stat label="Programs on NSPIRE" value={nspireReady} hint="Current transition profiles using NSPIRE" />
      </div>

      <div id="transition-controls" className="mt-4 grid scroll-mt-28 gap-4 xl:grid-cols-2">
        <Panel title="NSPIRE transition controls" description="Voucher programs may remain on previous HQS through January 31, 2027. Public Housing is routed to NSPIRE. The database selects the standard by inspection date and preserves it for reinspections.">
          {!isAdmin ? <p className="text-sm text-muted-foreground">Agency administrators control transition dates and HUD notification readiness. Inspection staff can operate scheduled inspections.</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium">Program
                <select className={inputClass} value={transitionProgram} onChange={(event) => {
                  const value = event.target.value;
                  setTransitionProgram(value);
                  const existing = transitionByProgram.get(value);
                  if (existing) {
                    setCurrentStandard(existing.current_standard);
                    setPlannedDate(existing.planned_nspire_date ?? "2027-02-01");
                    setHudStatus(existing.hud_notification_status);
                    setTrainingComplete(existing.inspector_training_complete);
                    setNotificationsComplete(existing.owner_family_notification_complete);
                  } else {
                    setCurrentStandard(value === "public_housing" ? "nspire" : "hqs_previous");
                    setPlannedDate("2027-02-01");
                    setHudStatus("planned");
                    setTrainingComplete(false);
                    setNotificationsComplete(false);
                  }
                }}>
                  {profile.pha_programs.map((program) => <option key={program} value={program}>{programLabel(program)}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium">Current inspection standard
                <select className={inputClass} value={transitionProgram === "public_housing" ? "nspire" : currentStandard} disabled={transitionProgram === "public_housing"} onChange={(event) => setCurrentStandard(event.target.value as "hqs_previous" | "nspire")}>
                  <option value="hqs_previous">HQS as previously defined</option><option value="nspire">NSPIRE</option>
                </select>
              </label>
              {transitionProgram !== "public_housing" ? <label className="text-xs font-medium">Planned NSPIRE date
                <input className={inputClass} type="date" max="2027-02-01" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} />
              </label> : null}
              <label className="text-xs font-medium">HUD notification
                <select className={inputClass} value={hudStatus} onChange={(event) => setHudStatus(event.target.value)}>
                  <option value="not_recorded">Not recorded</option><option value="planned">Planned</option><option value="sent">Sent</option><option value="confirmed">Confirmed</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={trainingComplete} onChange={(event) => setTrainingComplete(event.target.checked)} /> Inspectors trained for selected standard</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={notificationsComplete} onChange={(event) => setNotificationsComplete(event.target.checked)} /> Owners and families notified of NSPIRE transition</label>
              <button type="button" onClick={() => saveTransition.mutate()} disabled={saveTransition.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save transition profile</button>
              {saveTransition.isError ? <p className="text-xs text-destructive">{saveTransition.error instanceof Error ? saveTransition.error.message : "Unable to save transition profile."}</p> : null}
            </div>
          )}
        </Panel>

        <Panel title="Schedule inspection" description="The inspection standard is assigned server-side from the program transition profile; a reinspection retains the standard used by its originating inspection.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium">Program
              <select className={inputClass} value={programCode} onChange={(event) => setProgramCode(event.target.value)}>{profile.pha_programs.map((program) => <option key={program} value={program}>{programLabel(program)}</option>)}</select>
            </label>
            <label className="text-xs font-medium">Inspection type
              <select className={inputClass} value={inspectionType} onChange={(event) => setInspectionType(event.target.value)}><option value="initial">Initial</option><option value="periodic">Periodic</option><option value="special">Special</option><option value="quality_control">Quality control</option></select>
            </label>
            <label className="text-xs font-medium">Unit reference<input className={inputClass} value={unitReference} onChange={(event) => setUnitReference(event.target.value)} placeholder="Property / unit" /></label>
            <label className="text-xs font-medium">Scheduled date<input className={inputClass} type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label>
            <button type="button" onClick={() => scheduleInspection.mutate()} disabled={scheduleInspection.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Schedule inspection</button>
            {scheduleInspection.isError ? <p className="text-xs text-destructive">{scheduleInspection.error instanceof Error ? scheduleInspection.error.message : "Unable to schedule inspection."}</p> : null}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Inspection register" description="HCV/PBV/Mod Rehab inspections use pass/fail operational status. Transition-era corrections and reinspections stay on the standard that governed the original inspection.">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Unit</th><th className="pb-3">Program</th><th className="pb-3">Type</th><th className="pb-3">Scheduled</th><th className="pb-3">Standard</th><th className="pb-3">Result</th></tr></thead><tbody>
          {inspections.map((item) => <tr key={item.id} className="border-t border-border"><td className="py-3 font-medium">{item.unit_reference}</td><td className="py-3">{programLabel(item.program_code)}</td><td className="py-3">{item.inspection_type.replaceAll("_", " ")}</td><td className="py-3">{item.scheduled_for ?? "—"}</td><td className="py-3"><Pill tone={item.standard_used === "nspire" ? "seal" : undefined}>{item.standard_used === "nspire" ? "NSPIRE" : "Previous HQS"}</Pill></td><td className="py-3"><Pill tone={item.result === "pass" ? "seal" : undefined}>{item.result}</Pill></td></tr>)}
          {!query.isLoading && inspections.length === 0 ? <tr className="border-t border-border"><td colSpan={6} className="py-8 text-center text-muted-foreground">No inspections have been scheduled.</td></tr> : null}
        </tbody></table></div>
      </Panel>

      <Panel className="mt-4" title="Controlled-source safeguard" description="PIH 2026-18 governs the voucher-program transition. Carbon-monoxide and smoke-alarm requirements remain applicable during the transition, and inspection cases keep the standard in effect when the original inspection occurred. Deficiency-level correction deadlines will be driven by the controlled NSPIRE standards registry rather than hard-coded generic deadlines." />
    </AppShell>
  );
}
