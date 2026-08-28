import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useSession } from "@/hooks/use-session";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";

type Overlay = {
  id: string; program_code: string; policy_type: string; policy_version: string; source_reference: string;
  effective_date: string; hearing_request_deadline_rule: Record<string, unknown>; delivery_requirements: Record<string, unknown>;
  language_access_requirements: Record<string, unknown>; accessibility_requirements: Record<string, unknown>;
  validated: boolean; validated_at: string | null; active: boolean;
};

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const defaults = { version: "", source: "", effectiveDate: "", deadline: "", delivery: "", language: "", accessibility: "" };

function policyType(programCode: string) {
  if (programCode === "public_housing") return "acop";
  if (programCode === "mod_rehab") return "mod_rehab_policy";
  return "administrative_plan";
}

function label(value: string) { return value.replaceAll("_", " ").toUpperCase(); }

export function PhaPolicyOverlayConsole() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { profile, workspaceUserId, phaRole } = useWorkspaceProfile();
  const canManage = phaRole === "workspace_owner" || phaRole === "agency_admin" || phaRole === "compliance_admin";
  const [programCode, setProgramCode] = useState(profile.pha_programs[0] ?? "hcv");
  const [draft, setDraft] = useState(defaults);

  const query = useQuery<Overlay[]>({
    queryKey: ["pha-policy-overlays", workspaceUserId], enabled: !!workspaceUserId && profile.organization_type === "pha",
    queryFn: async () => {
      // Generated Supabase types lag controlled PHA policy-overlay migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.from("pha_notice_policy_overlays").select("id, program_code, policy_type, policy_version, source_reference, effective_date, hearing_request_deadline_rule, delivery_requirements, language_access_requirements, accessibility_requirements, validated, validated_at, active").eq("workspace_user_id", workspaceUserId).order("effective_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const overlays = query.data ?? [];
  const activeByProgram = useMemo(() => new Map(overlays.filter((item) => item.active).map((item) => [item.program_code, item])), [overlays]);
  const validatedCount = overlays.filter((item) => item.active && item.validated).length;
  const unresolvedPrograms = profile.pha_programs.filter((program) => !activeByProgram.get(program)?.validated).length;

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!workspaceUserId || !draft.version.trim() || !draft.source.trim() || !draft.effectiveDate) throw new Error("Policy version, source reference, and effective date are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_notice_policy_overlays").insert({
        workspace_user_id: workspaceUserId, program_code: programCode, policy_type: policyType(programCode), policy_version: draft.version.trim(), source_reference: draft.source.trim(), effective_date: draft.effectiveDate,
        hearing_request_deadline_rule: draft.deadline.trim() ? { agency_rule: draft.deadline.trim() } : {},
        delivery_requirements: draft.delivery.trim() ? { agency_rule: draft.delivery.trim() } : {},
        language_access_requirements: draft.language.trim() ? { agency_rule: draft.language.trim() } : {},
        accessibility_requirements: draft.accessibility.trim() ? { agency_rule: draft.accessibility.trim() } : {},
        validated: false, active: true,
      });
      if (error) throw error;
    },
    onSuccess: async () => { setDraft(defaults); await queryClient.invalidateQueries({ queryKey: ["pha-policy-overlays", workspaceUserId] }); },
  });

  const validateOverlay = useMutation({
    mutationFn: async (overlay: Overlay) => {
      if (!user?.id) throw new Error("Authenticated validator required.");
      if (!overlay.source_reference.trim()) throw new Error("Source reference is required before validation.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error: deactivateError } = await client.from("pha_notice_policy_overlays").update({ active: false }).eq("workspace_user_id", workspaceUserId).eq("program_code", overlay.program_code).neq("id", overlay.id);
      if (deactivateError) throw deactivateError;
      const { error } = await client.from("pha_notice_policy_overlays").update({ validated: true, validated_by: user.id, validated_at: new Date().toISOString(), active: true }).eq("id", overlay.id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-policy-overlays", workspaceUserId] }),
  });

  return (
    <AppShell title="PHA Policies & Notice Controls" subtitle="Manage the agency Administrative Plan, ACOP, and Mod Rehab policy overlays that control legal notice and hearing/grievance issuance">
      <div className="grid gap-3 md:grid-cols-3"><Stat label="Validated active policies" value={validatedCount} hint="Agency policy versions currently eligible for notice gating" /><Stat label="Programs unresolved" value={unresolvedPrograms} hint="Programs without a validated current policy overlay" /><Stat label="Policy history" value={overlays.length} hint="Retained policy versions for audit traceability" /></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Add agency policy version" description="New versions begin unvalidated. CertivoIQ will not treat a policy as authoritative for legal notice issuance until an authorized agency administrator validates it.">
          {!canManage ? <p className="text-sm text-muted-foreground">Your role can view policy status but cannot create or validate agency policy versions.</p> : <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Program<select className={inputClass} value={programCode} onChange={(event) => setProgramCode(event.target.value)}>{profile.pha_programs.map((program) => <option key={program} value={program}>{label(program)}</option>)}</select></label><label className="text-xs font-medium">Required policy type<input className={inputClass} value={policyType(programCode).replaceAll("_", " ")} disabled /></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Policy version<input className={inputClass} value={draft.version} onChange={(event) => setDraft((value) => ({ ...value, version: event.target.value }))} placeholder="e.g. ACOP 2026.2" /></label><label className="text-xs font-medium">Effective date<input type="date" className={inputClass} value={draft.effectiveDate} onChange={(event) => setDraft((value) => ({ ...value, effectiveDate: event.target.value }))} /></label></div>
            <label className="block text-xs font-medium">Controlled source reference<input className={inputClass} value={draft.source} onChange={(event) => setDraft((value) => ({ ...value, source: event.target.value }))} placeholder="Agency document URL, repository ID, or controlled source reference" /></label>
            <label className="block text-xs font-medium">Hearing / review request deadline rule<textarea className={`${inputClass} min-h-16`} value={draft.deadline} onChange={(event) => setDraft((value) => ({ ...value, deadline: event.target.value }))} placeholder="Exact agency rule; do not approximate" /></label>
            <label className="block text-xs font-medium">Delivery requirements<textarea className={`${inputClass} min-h-16`} value={draft.delivery} onChange={(event) => setDraft((value) => ({ ...value, delivery: event.target.value }))} /></label>
            <label className="block text-xs font-medium">Language access requirements<textarea className={`${inputClass} min-h-16`} value={draft.language} onChange={(event) => setDraft((value) => ({ ...value, language: event.target.value }))} /></label>
            <label className="block text-xs font-medium">Accessibility / reasonable accommodation requirements<textarea className={`${inputClass} min-h-16`} value={draft.accessibility} onChange={(event) => setDraft((value) => ({ ...value, accessibility: event.target.value }))} /></label>
            <button type="button" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save unvalidated policy version</button>
            {saveDraft.isError ? <p className="text-xs text-destructive">{saveDraft.error instanceof Error ? saveDraft.error.message : "Unable to save policy version."}</p> : null}
          </div>}
        </Panel>

        <Panel title="Program readiness" description="Family Notices reads these validated overlays server-side. Missing or unvalidated policy versions keep legal notice issuance blocked.">
          <div className="space-y-3">{profile.pha_programs.map((program) => { const current = activeByProgram.get(program); return <div key={program} className="rounded-md border border-border p-3 text-sm"><div className="flex items-center justify-between gap-3"><strong>{label(program)}</strong><Pill tone={current?.validated ? "seal" : undefined}>{current?.validated ? "Validated" : "Blocked"}</Pill></div><div className="mt-2 text-xs text-muted-foreground">{current ? `${current.policy_version} · ${current.policy_type.replaceAll("_", " ")} · effective ${current.effective_date}` : "No active agency policy overlay"}</div></div>; })}</div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Policy version history" description="Validation is explicit and auditable. Activating a validated version deactivates older versions for that program without deleting the historical records.">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Program</th><th className="pb-3">Type</th><th className="pb-3">Version</th><th className="pb-3">Effective</th><th className="pb-3">Source</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr></thead><tbody>{overlays.map((item) => <tr key={item.id} className="border-t border-border"><td className="py-3">{label(item.program_code)}</td><td className="py-3">{item.policy_type.replaceAll("_", " ")}</td><td className="py-3 font-medium">{item.policy_version}</td><td className="py-3">{item.effective_date}</td><td className="max-w-64 truncate py-3 text-xs">{item.source_reference}</td><td className="py-3"><Pill tone={item.active && item.validated ? "seal" : undefined}>{item.active ? (item.validated ? "validated active" : "unvalidated") : "historical"}</Pill></td><td className="py-3">{canManage && item.active && !item.validated ? <button type="button" onClick={() => validateOverlay.mutate(item)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Validate version</button> : "—"}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel className="mt-4" title="Governance safeguard" description="This console records the agency's own Administrative Plan, ACOP, or Mod Rehab policy requirements; it does not invent deadlines or hearing rights. Federal authority remains separately controlled by CertivoIQ's legal-notice profile registry, and notice issuance requires both layers to be current." />
    </AppShell>
  );
}
