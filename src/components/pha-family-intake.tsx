import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type ActionRow = {
  id: string;
  family_reference: string;
  program_code: string;
  action_type: string;
  effective_date: string;
  due_date: string | null;
  workflow_status: string;
  verification_complete: boolean;
  eiv_review_complete: boolean;
};

type EvidenceRow = {
  id: string;
  family_action_id: string;
  evidence_type: string;
  source_label: string;
  verified: boolean;
  conflict_detected: boolean;
  notes: string | null;
};

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function PhaFamilyIntake() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionDraft, setActionDraft] = useState({
    family_reference: "",
    program_code: "hcv",
    action_type: "annual_reexamination",
    effective_date: "",
    due_date: "",
  });
  const [evidenceDraft, setEvidenceDraft] = useState({
    evidence_type: "income",
    source_label: "",
    verified: false,
    conflict_detected: false,
    notes: "",
  });

  const query = useQuery<{ actions: ActionRow[]; evidence: EvidenceRow[] }>({
    queryKey: ["pha-family-intake-evidence"],
    queryFn: async () => {
      // Generated Supabase types lag new PHA workflow tables until the next schema type refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [actionsResult, evidenceResult] = await Promise.all([
        client
          .from("pha_family_actions")
          .select("id, family_reference, program_code, action_type, effective_date, due_date, workflow_status, verification_complete, eiv_review_complete")
          .order("created_at", { ascending: false }),
        client
          .from("pha_family_evidence")
          .select("id, family_action_id, evidence_type, source_label, verified, conflict_detected, notes")
          .order("created_at", { ascending: false }),
      ]);
      if (actionsResult.error) throw actionsResult.error;
      if (evidenceResult.error) throw evidenceResult.error;
      return { actions: actionsResult.data ?? [], evidence: evidenceResult.data ?? [] };
    },
  });

  const actions = query.data?.actions ?? [];
  const evidence = query.data?.evidence ?? [];
  const selected = useMemo(() => actions.find((row) => row.id === selectedId) ?? null, [actions, selectedId]);
  const selectedEvidence = useMemo(() => evidence.filter((row) => row.family_action_id === selectedId), [evidence, selectedId]);

  const createAction = useMutation({
    mutationFn: async () => {
      if (!actionDraft.family_reference.trim() || !actionDraft.effective_date) {
        throw new Error("Family reference and effective date are required.");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.from("pha_family_actions").insert({
        family_reference: actionDraft.family_reference.trim(),
        program_code: actionDraft.program_code,
        action_type: actionDraft.action_type,
        effective_date: actionDraft.effective_date,
        due_date: actionDraft.due_date || null,
        workflow_status: "verification",
      }).select("id").single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: async (id) => {
      setSelectedId(id);
      setActionDraft({ family_reference: "", program_code: "hcv", action_type: "annual_reexamination", effective_date: "", due_date: "" });
      await queryClient.invalidateQueries({ queryKey: ["pha-family-intake-evidence"] });
      await queryClient.invalidateQueries({ queryKey: ["pha-family-actions-with-calculations"] });
    },
  });

  const addEvidence = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a family action before adding evidence.");
      if (!evidenceDraft.source_label.trim()) throw new Error("Evidence source label is required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_family_evidence").insert({
        family_action_id: selected.id,
        evidence_type: evidenceDraft.evidence_type,
        source_label: evidenceDraft.source_label.trim(),
        verified: evidenceDraft.verified,
        conflict_detected: evidenceDraft.conflict_detected,
        notes: evidenceDraft.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setEvidenceDraft({ evidence_type: "income", source_label: "", verified: false, conflict_detected: false, notes: "" });
      await queryClient.invalidateQueries({ queryKey: ["pha-family-intake-evidence"] });
      await queryClient.invalidateQueries({ queryKey: ["pha-family-actions-with-calculations"] });
    },
  });

  const verifiedCount = selectedEvidence.filter((row) => row.verified && !row.conflict_detected).length;
  const conflictCount = selectedEvidence.filter((row) => row.conflict_detected).length;

  return (
    <AppShell title="Family Intake & Evidence" subtitle="Create PHA family actions and attach verification/EIV evidence before substantive calculation">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Open family actions" value={actions.filter((row) => row.workflow_status !== "routed").length} hint="Admissions, reexams, portability, and other actions" />
        <Stat label="Verified evidence" value={evidence.filter((row) => row.verified && !row.conflict_detected).length} hint="Evidence currently marked verified" />
        <Stat label="Evidence conflicts" value={evidence.filter((row) => row.conflict_detected).length} hint="Conflicts block calculation until resolved" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Create family action" description="Start an admission, annual, interim, portability, or other HUD-50058-generating workflow.">
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); createAction.mutate(); }}>
            <label className="block text-xs font-medium">Family reference<input className={inputClass} value={actionDraft.family_reference} onChange={(event) => setActionDraft((value) => ({ ...value, family_reference: event.target.value }))} placeholder="Agency family ID or case reference" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Program<select className={inputClass} value={actionDraft.program_code} onChange={(event) => setActionDraft((value) => ({ ...value, program_code: event.target.value }))}><option value="hcv">HCV</option><option value="pbv">PBV</option><option value="public_housing">Public Housing</option><option value="mod_rehab">Mod Rehab</option></select></label>
              <label className="text-xs font-medium">Action type<select className={inputClass} value={actionDraft.action_type} onChange={(event) => setActionDraft((value) => ({ ...value, action_type: event.target.value }))}><option value="admission">Admission</option><option value="annual_reexamination">Annual reexamination</option><option value="interim_reexamination">Interim reexamination</option><option value="portability">Portability</option><option value="other">Other</option></select></label>
              <label className="text-xs font-medium">Effective date<input type="date" className={inputClass} value={actionDraft.effective_date} onChange={(event) => setActionDraft((value) => ({ ...value, effective_date: event.target.value }))} /></label>
              <label className="text-xs font-medium">Due date<input type="date" className={inputClass} value={actionDraft.due_date} onChange={(event) => setActionDraft((value) => ({ ...value, due_date: event.target.value }))} /></label>
            </div>
            <button type="submit" disabled={createAction.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{createAction.isPending ? "Creating…" : "Create family action"}</button>
            {createAction.isError ? <p className="text-xs text-destructive">{createAction.error instanceof Error ? createAction.error.message : "Unable to create family action."}</p> : null}
          </form>
        </Panel>

        <Panel title="Verification / EIV evidence" description={selected ? `${selected.family_reference} · ${selected.program_code.replaceAll("_", " ").toUpperCase()}` : "Select a family action below before adding evidence."}>
          {!selected ? <p className="text-sm text-muted-foreground">Select a family action from the queue.</p> : <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); addEvidence.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Evidence type<select className={inputClass} value={evidenceDraft.evidence_type} onChange={(event) => setEvidenceDraft((value) => ({ ...value, evidence_type: event.target.value }))}><option value="eiv">EIV</option><option value="income">Income</option><option value="assets">Assets</option><option value="deductions">Deductions</option><option value="identity">Identity</option><option value="citizenship">Citizenship / eligible status</option><option value="other">Other</option></select></label>
              <label className="text-xs font-medium">Source label<input className={inputClass} value={evidenceDraft.source_label} onChange={(event) => setEvidenceDraft((value) => ({ ...value, source_label: event.target.value }))} placeholder="EIV report, paystub, bank statement…" /></label>
            </div>
            <label className="block text-xs font-medium">Reviewer notes<textarea className={`${inputClass} min-h-20`} value={evidenceDraft.notes} onChange={(event) => setEvidenceDraft((value) => ({ ...value, notes: event.target.value }))} /></label>
            <div className="flex flex-wrap gap-4 text-xs font-medium"><label className="flex items-center gap-2"><input type="checkbox" checked={evidenceDraft.verified} onChange={(event) => setEvidenceDraft((value) => ({ ...value, verified: event.target.checked }))} />Verified</label><label className="flex items-center gap-2"><input type="checkbox" checked={evidenceDraft.conflict_detected} onChange={(event) => setEvidenceDraft((value) => ({ ...value, conflict_detected: event.target.checked }))} />Conflict detected</label></div>
            <button type="submit" disabled={addEvidence.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{addEvidence.isPending ? "Adding…" : "Add evidence"}</button>
            {addEvidence.isError ? <p className="text-xs text-destructive">{addEvidence.error instanceof Error ? addEvidence.error.message : "Unable to add evidence."}</p> : null}
            <div className="flex gap-2 pt-2"><Pill tone={conflictCount ? undefined : "seal"}>{verifiedCount} verified</Pill><Pill>{conflictCount} conflicts</Pill></div>
          </form>}
        </Panel>
      </div>

      <Panel className="mt-4" title="Family intake queue" description="Choose a family action to add or review evidence. Evidence conflicts propagate to the existing fail-closed calculation gate.">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective</th><th className="pb-3">Due</th><th className="pb-3">Stage</th><th className="pb-3">Evidence</th></tr></thead><tbody>{actions.map((row) => { const rowEvidence = evidence.filter((item) => item.family_action_id === row.id); const conflicts = rowEvidence.filter((item) => item.conflict_detected).length; return <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-t border-border ${selectedId === row.id ? "bg-muted/40" : ""}`}><td className="py-3 pr-3 font-medium">{row.family_reference}</td><td className="py-3 pr-3">{row.program_code.replaceAll("_", " ").toUpperCase()}</td><td className="py-3 pr-3">{row.action_type.replaceAll("_", " ")}</td><td className="py-3 pr-3 font-mono text-xs">{row.effective_date}</td><td className="py-3 pr-3 font-mono text-xs">{row.due_date ?? "—"}</td><td className="py-3 pr-3"><Pill tone={row.workflow_status === "routed" ? "seal" : undefined}>{row.workflow_status.replaceAll("_", " ")}</Pill></td><td className="py-3 text-xs">{rowEvidence.length} item{rowEvidence.length === 1 ? "" : "s"}{conflicts ? ` · ${conflicts} conflict${conflicts === 1 ? "" : "s"}` : ""}</td></tr>; })}</tbody></table></div>
      </Panel>
    </AppShell>
  );
}
