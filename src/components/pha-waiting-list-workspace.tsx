import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";

type Policy = { id: string; program_code: string; policy_version: string; policy_type: string; source_reference: string };
type WaitingList = { id: string; program_code: string; list_name: string; geographic_scope: string; selection_method: string; policy_overlay_id: string; status: string; opened_at: string | null; closed_at: string | null };
type Preference = { id: string; waiting_list_id: string; preference_code: string; preference_label: string; priority: number; policy_rule_reference: string; active: boolean };
type Applicant = { id: string; waiting_list_id: string; applicant_reference: string; applicant_name: string; family_unit_size: number; application_received_at: string; preference_codes: string[]; preference_priority: number; preference_verified: boolean; status: string; reasonable_accommodation_review_required: boolean };
type Selection = { id: string; waiting_list_id: string; applicant_id: string; selection_method: string; preference_priority: number; candidate_count: number; selected_at: string };

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const eligiblePrograms = ["hcv", "public_housing"] as const;

function programLabel(value: string) { return value.replaceAll("_", " ").toUpperCase(); }

export function PhaWaitingListWorkspace() {
  const queryClient = useQueryClient();
  const { profile, workspaceUserId, phaRole } = useWorkspaceProfile();
  const canWrite = phaRole === "workspace_owner" || phaRole === "agency_admin" || phaRole === "compliance_admin" || phaRole === "hcv_pbv_specialist" || phaRole === "public_housing_specialist";
  const configuredPrograms = eligiblePrograms.filter((program) => profile.pha_programs.includes(program));
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listDraft, setListDraft] = useState({ program_code: configuredPrograms[0] ?? "hcv", list_name: "", geographic_scope: "agency", selection_method: "date_time", policy_overlay_id: "" });
  const [preferenceDraft, setPreferenceDraft] = useState({ code: "", label: "", priority: "1", rule: "" });
  const [applicantDraft, setApplicantDraft] = useState({ reference: "", name: "", familyUnitSize: "1", preferenceCode: "", accessibility: false });

  const query = useQuery<{ policies: Policy[]; lists: WaitingList[]; preferences: Preference[]; applicants: Applicant[]; selections: Selection[] }>({
    queryKey: ["pha-waiting-lists", workspaceUserId], enabled: !!workspaceUserId && profile.organization_type === "pha",
    queryFn: async () => {
      // Generated Supabase types lag waiting-list migrations until schema refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [policiesResult, listsResult, preferencesResult, applicantsResult, selectionsResult] = await Promise.all([
        client.from("pha_notice_policy_overlays").select("id, program_code, policy_version, policy_type, source_reference").eq("workspace_user_id", workspaceUserId).eq("active", true).eq("validated", true),
        client.from("pha_waiting_lists").select("id, program_code, list_name, geographic_scope, selection_method, policy_overlay_id, status, opened_at, closed_at").eq("workspace_user_id", workspaceUserId).order("created_at", { ascending: false }),
        client.from("pha_waiting_list_preferences").select("id, waiting_list_id, preference_code, preference_label, priority, policy_rule_reference, active").order("priority"),
        client.from("pha_waiting_list_applicants").select("id, waiting_list_id, applicant_reference, applicant_name, family_unit_size, application_received_at, preference_codes, preference_priority, preference_verified, status, reasonable_accommodation_review_required").order("application_received_at"),
        client.from("pha_waiting_list_selection_events").select("id, waiting_list_id, applicant_id, selection_method, preference_priority, candidate_count, selected_at").order("selected_at", { ascending: false }),
      ]);
      for (const result of [policiesResult, listsResult, preferencesResult, applicantsResult, selectionsResult]) if (result.error) throw result.error;
      return { policies: policiesResult.data ?? [], lists: listsResult.data ?? [], preferences: preferencesResult.data ?? [], applicants: applicantsResult.data ?? [], selections: selectionsResult.data ?? [] };
    },
  });

  const policies = query.data?.policies ?? [];
  const lists = query.data?.lists ?? [];
  const preferences = query.data?.preferences ?? [];
  const applicants = query.data?.applicants ?? [];
  const selections = query.data?.selections ?? [];
  const selectedList = useMemo(() => lists.find((item) => item.id === selectedListId) ?? lists[0] ?? null, [lists, selectedListId]);
  const selectedPreferences = preferences.filter((item) => item.waiting_list_id === selectedList?.id && item.active);
  const selectedApplicants = applicants.filter((item) => item.waiting_list_id === selectedList?.id);
  const selectedEvents = selections.filter((item) => item.waiting_list_id === selectedList?.id);

  const createList = useMutation({
    mutationFn: async () => {
      if (!workspaceUserId || !listDraft.list_name.trim() || !listDraft.policy_overlay_id) throw new Error("List name and validated agency policy are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_waiting_lists").insert({ workspace_user_id: workspaceUserId, ...listDraft, list_name: listDraft.list_name.trim(), geographic_scope: listDraft.geographic_scope.trim() || "agency", status: "open", source_status: "current" });
      if (error) throw error;
    },
    onSuccess: async () => { setListDraft((value) => ({ ...value, list_name: "", policy_overlay_id: "" })); await queryClient.invalidateQueries({ queryKey: ["pha-waiting-lists", workspaceUserId] }); },
  });

  const addPreference = useMutation({
    mutationFn: async () => {
      if (!selectedList || !preferenceDraft.code.trim() || !preferenceDraft.label.trim() || !preferenceDraft.rule.trim()) throw new Error("Preference code, label, and exact policy rule reference are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_waiting_list_preferences").insert({ waiting_list_id: selectedList.id, preference_code: preferenceDraft.code.trim(), preference_label: preferenceDraft.label.trim(), priority: Number(preferenceDraft.priority), policy_rule_reference: preferenceDraft.rule.trim(), active: true });
      if (error) throw error;
    },
    onSuccess: async () => { setPreferenceDraft({ code: "", label: "", priority: "1", rule: "" }); await queryClient.invalidateQueries({ queryKey: ["pha-waiting-lists", workspaceUserId] }); },
  });

  const addApplicant = useMutation({
    mutationFn: async () => {
      if (!selectedList || !applicantDraft.reference.trim() || !applicantDraft.name.trim()) throw new Error("Applicant reference and name are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const codes = applicantDraft.preferenceCode ? [applicantDraft.preferenceCode] : [];
      const { error } = await client.from("pha_waiting_list_applicants").insert({ waiting_list_id: selectedList.id, applicant_reference: applicantDraft.reference.trim(), applicant_name: applicantDraft.name.trim(), family_unit_size: Number(applicantDraft.familyUnitSize), application_received_at: new Date().toISOString(), preference_codes: codes, preference_verified: codes.length === 0, reasonable_accommodation_review_required: applicantDraft.accessibility });
      if (error) throw error;
    },
    onSuccess: async () => { setApplicantDraft({ reference: "", name: "", familyUnitSize: "1", preferenceCode: "", accessibility: false }); await queryClient.invalidateQueries({ queryKey: ["pha-waiting-lists", workspaceUserId] }); },
  });

  const verifyPreference = useMutation({
    mutationFn: async (applicant: Applicant) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_waiting_list_applicants").update({ preference_verified: true }).eq("id", applicant.id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-waiting-lists", workspaceUserId] }),
  });

  const setListStatus = useMutation({
    mutationFn: async (status: "open" | "closed") => {
      if (!selectedList) throw new Error("Select a waiting list.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_waiting_lists").update({ status }).eq("id", selectedList.id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-waiting-lists", workspaceUserId] }),
  });

  const selectNext = useMutation({
    mutationFn: async () => {
      if (!selectedList) throw new Error("Select a waiting list.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.rpc("select_next_pha_waiting_list_applicant", { target_waiting_list_id: selectedList.id });
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-waiting-lists", workspaceUserId] }),
  });

  const activeApplicants = applicants.filter((item) => item.status === "active").length;
  const selectedCount = applicants.filter((item) => item.status === "selected").length;
  const blockedPreferences = applicants.filter((item) => item.preference_codes.length > 0 && !item.preference_verified).length;
  const programPolicies = policies.filter((policy) => policy.program_code === listDraft.program_code);

  return (
    <AppShell title="Waiting Lists" subtitle="Operate auditable HCV and Public Housing waiting lists using the agency's validated admission policy and controlled selection method">
      <div className="grid gap-3 md:grid-cols-3"><Stat label="Active applicants" value={activeApplicants} hint="Applicants currently eligible to remain in candidate pools" /><Stat label="Selections recorded" value={selectedCount} hint="Selected applicants with immutable audit events" /><Stat label="Preference verification due" value={blockedPreferences} hint="Applicants blocked from preference-based selection until verified" /></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Create controlled waiting list" description="HCV and Public Housing use separate verified admission rules. A validated Administrative Plan or ACOP is mandatory before a list can operate.">
          {!canWrite ? <p className="text-sm text-muted-foreground">Your role has read-only waiting-list access.</p> : <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Program<select className={inputClass} value={listDraft.program_code} onChange={(event) => setListDraft((value) => ({ ...value, program_code: event.target.value === "public_housing" ? "public_housing" : "hcv", policy_overlay_id: "" }))}>{configuredPrograms.map((program) => <option key={program} value={program}>{programLabel(program)}</option>)}</select></label><label className="text-xs font-medium">Selection method<select className={inputClass} value={listDraft.selection_method} onChange={(event) => setListDraft((value) => ({ ...value, selection_method: event.target.value }))}><option value="date_time">Date & time</option><option value="random">Random choice</option></select></label></div>
            <label className="block text-xs font-medium">List name<input className={inputClass} value={listDraft.list_name} onChange={(event) => setListDraft((value) => ({ ...value, list_name: event.target.value }))} /></label>
            <label className="block text-xs font-medium">Geographic scope<input className={inputClass} value={listDraft.geographic_scope} onChange={(event) => setListDraft((value) => ({ ...value, geographic_scope: event.target.value }))} placeholder="agency, county, municipality" /></label>
            <label className="block text-xs font-medium">Validated admission policy<select className={inputClass} value={listDraft.policy_overlay_id} onChange={(event) => setListDraft((value) => ({ ...value, policy_overlay_id: event.target.value }))}><option value="">Select validated policy</option>{programPolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.policy_version} · {policy.policy_type.replaceAll("_", " ")}</option>)}</select></label>
            <button type="button" onClick={() => createList.mutate()} disabled={createList.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Create & open waiting list</button>
            {createList.isError ? <p className="text-xs text-destructive">{createList.error instanceof Error ? createList.error.message : "Unable to create waiting list."}</p> : null}
          </div>}
        </Panel>

        <Panel title="Selection controls" description={selectedList ? `${selectedList.list_name} · ${programLabel(selectedList.program_code)} · ${selectedList.selection_method.replaceAll("_", " ")}` : "Select a waiting list below."}>
          {!selectedList ? <p className="text-sm text-muted-foreground">No waiting list is selected.</p> : <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm">List status</span><Pill tone={selectedList.status === "closed" ? "seal" : undefined}>{selectedList.status}</Pill></div>
            <p className="text-xs text-muted-foreground">Selection is allowed only after the list is closed, preserving the candidate pool used for the audit snapshot.</p>
            {canWrite ? <div className="flex gap-2"><button type="button" onClick={() => setListStatus.mutate(selectedList.status === "open" ? "closed" : "open")} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">{selectedList.status === "open" ? "Close list for selection" : "Reopen list"}</button><button type="button" onClick={() => selectNext.mutate()} disabled={selectedList.status !== "closed" || selectNext.isPending} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Select next applicant</button></div> : null}
            {selectNext.isError ? <p className="text-xs text-destructive">{selectNext.error instanceof Error ? selectNext.error.message : "Selection failed."}</p> : null}
            <div className="text-xs text-muted-foreground">Audit events retained: {selectedEvents.length}</div>
          </div>}
        </Panel>
      </div>

      {selectedList && canWrite ? <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Controlled local preferences" description="Preference definitions must cite the exact agency policy rule. CertivoIQ does not invent preference categories or rankings.">
          <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">Code<input className={inputClass} value={preferenceDraft.code} onChange={(event) => setPreferenceDraft((value) => ({ ...value, code: event.target.value }))} /></label><label className="text-xs font-medium">Label<input className={inputClass} value={preferenceDraft.label} onChange={(event) => setPreferenceDraft((value) => ({ ...value, label: event.target.value }))} /></label><label className="text-xs font-medium">Priority<input className={inputClass} type="number" min="0" value={preferenceDraft.priority} onChange={(event) => setPreferenceDraft((value) => ({ ...value, priority: event.target.value }))} /></label></div><label className="block text-xs font-medium">Exact policy rule reference<input className={inputClass} value={preferenceDraft.rule} onChange={(event) => setPreferenceDraft((value) => ({ ...value, rule: event.target.value }))} /></label><button type="button" onClick={() => addPreference.mutate()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Add controlled preference</button><div className="flex flex-wrap gap-2">{selectedPreferences.map((item) => <Pill key={item.id}>{item.priority} · {item.preference_label}</Pill>)}</div></div>
        </Panel>
        <Panel title="Add applicant" description="HCV records include the data needed by 24 CFR 982.204. Applicants with claimed preferences are blocked from preference selection until verified.">
          <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Applicant reference<input className={inputClass} value={applicantDraft.reference} onChange={(event) => setApplicantDraft((value) => ({ ...value, reference: event.target.value }))} /></label><label className="text-xs font-medium">Applicant name<input className={inputClass} value={applicantDraft.name} onChange={(event) => setApplicantDraft((value) => ({ ...value, name: event.target.value }))} /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Family unit size<input className={inputClass} type="number" min="1" value={applicantDraft.familyUnitSize} onChange={(event) => setApplicantDraft((value) => ({ ...value, familyUnitSize: event.target.value }))} /></label><label className="text-xs font-medium">Claimed preference<select className={inputClass} value={applicantDraft.preferenceCode} onChange={(event) => setApplicantDraft((value) => ({ ...value, preferenceCode: event.target.value }))}><option value="">No local preference</option>{selectedPreferences.map((item) => <option key={item.id} value={item.preference_code}>{item.preference_label}</option>)}</select></label></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={applicantDraft.accessibility} onChange={(event) => setApplicantDraft((value) => ({ ...value, accessibility: event.target.checked }))} />Reasonable-accommodation review required before any nonresponse removal</label><button type="button" onClick={() => addApplicant.mutate()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add applicant</button></div>
        </Panel>
      </div> : null}

      <Panel className="mt-4" title="Applicant register" description="Family size is recorded but is not used as a shortcut to skip the top HCV family. Selection is driven by the validated preference category and the policy-selected date/time or random method.">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Applicant</th><th className="pb-3">Applied</th><th className="pb-3">Unit size</th><th className="pb-3">Preference</th><th className="pb-3">Verified</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr></thead><tbody>{selectedApplicants.map((item) => <tr key={item.id} className="border-t border-border"><td className="py-3 font-medium">{item.applicant_name}<div className="text-xs text-muted-foreground">{item.applicant_reference}</div></td><td className="py-3 text-xs">{new Date(item.application_received_at).toLocaleString()}</td><td className="py-3">{item.family_unit_size}</td><td className="py-3">{item.preference_codes.join(", ") || "none"}</td><td className="py-3"><Pill tone={item.preference_verified ? "seal" : undefined}>{item.preference_verified ? "verified" : "pending"}</Pill></td><td className="py-3">{item.status}</td><td className="py-3">{canWrite && !item.preference_verified ? <button type="button" onClick={() => verifyPreference.mutate(item)} className="rounded-md border border-border px-2 py-1 text-xs">Verify preference</button> : "—"}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel className="mt-4" title="Waiting-list safeguards" description="HCV selection follows the validated Administrative Plan and 24 CFR 982.204/.207; Public Housing follows the validated ACOP/PHA plan and 24 CFR 960.206. Selection writes a candidate-pool and policy snapshot so every selection can be reconstructed. PBV is excluded until its separate waiting-list rules are activated." />
    </AppShell>
  );
}
