import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CrmShell } from "@/components/crm/crm-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/crm-pha-controls")({
  head: () => ({ meta: [
    { title: "PHA Control Console — CertivoIQ Staff" },
    { name: "description", content: "Staff-only PHA source, rule, HOTMA, reporting, and software readiness controls." },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: PhaControlConsole,
});

type Profile = {
  user_id: string;
  organization_type: string;
  pha_programs: string[];
  pha_hotma_cohort: string | null;
  hud_50058_reporting_path: string | null;
};

type Control = {
  id: string;
  user_id: string;
  program_code: string;
  source_release_status: string;
  rule_version_status: string;
  hotma_policy_status: string;
  reporting_path_status: string;
  software_compatibility_status: string;
  source_status_conflict: boolean;
  source_authority_key: string | null;
  rule_version: string | null;
  validated_at: string | null;
};

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const programs = ["hcv", "pbv", "public_housing", "mod_rehab"] as const;

function PhaControlConsole() {
  const { isStaff, loading, email } = useIsStaff();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [programCode, setProgramCode] = useState<string>("hcv");
  const [draft, setDraft] = useState({
    source_release_status: "pending",
    rule_version_status: "pending",
    hotma_policy_status: "pending",
    reporting_path_status: "pending",
    software_compatibility_status: "pending",
    source_status_conflict: false,
    source_authority_key: "",
    rule_version: "",
  });

  const profiles = useQuery<Profile[]>({
    queryKey: ["staff", "pha-workspace-profiles"],
    enabled: isStaff,
    queryFn: async () => {
      // Generated types lag the newly added PHA control tables.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.from("customer_workspace_profiles")
        .select("user_id, organization_type, pha_programs, pha_hotma_cohort, hud_50058_reporting_path")
        .eq("organization_type", "pha")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const controls = useQuery<Control[]>({
    queryKey: ["staff", "pha-authoritative-controls"],
    enabled: isStaff,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.from("pha_authoritative_control_state").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profile = useMemo(() => (profiles.data ?? []).find((row) => row.user_id === selectedUserId) ?? null, [profiles.data, selectedUserId]);
  const current = useMemo(() => (controls.data ?? []).find((row) => row.user_id === selectedUserId && row.program_code === programCode) ?? null, [controls.data, selectedUserId, programCode]);

  const loadCurrent = () => {
    setDraft({
      source_release_status: current?.source_release_status ?? "pending",
      rule_version_status: current?.rule_version_status ?? "pending",
      hotma_policy_status: current?.hotma_policy_status ?? "pending",
      reporting_path_status: current?.reporting_path_status ?? "pending",
      software_compatibility_status: current?.software_compatibility_status ?? "pending",
      source_status_conflict: current?.source_status_conflict ?? false,
      source_authority_key: current?.source_authority_key ?? "",
      rule_version: current?.rule_version ?? "",
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Select a PHA workspace first.");
      if (!profile?.pha_programs.includes(programCode)) throw new Error("This PHA does not administer the selected program.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_authoritative_control_state").upsert({
        user_id: selectedUserId,
        program_code: programCode,
        ...draft,
        source_authority_key: draft.source_authority_key.trim() || null,
        rule_version: draft.rule_version.trim() || null,
        validated_by: user?.id ?? null,
        validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,program_code" });
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["staff", "pha-authoritative-controls"] }),
  });

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin" /></div>;

  const readyCount = (controls.data ?? []).filter((row) => row.source_release_status === "approved" && row.rule_version_status === "current" && ["validated", "not_applicable"].includes(row.hotma_policy_status) && row.reporting_path_status === "validated" && row.software_compatibility_status === "validated" && !row.source_status_conflict).length;
  const blockedCount = (controls.data ?? []).filter((row) => row.source_status_conflict || [row.source_release_status, row.rule_version_status, row.hotma_policy_status, row.reporting_path_status, row.software_compatibility_status].includes("blocked")).length;

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="PHA workspaces" value={String(profiles.data?.length ?? 0)} hint="Configured PHA accounts" />
        <Stat label="Program controls ready" value={String(readyCount)} hint="All authority gates validated" />
        <Stat label="Blocked/conflicted" value={String(blockedCount)} hint="Requires staff resolution" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)]">
        <Panel title="PHA & program" description="Choose the authoritative workspace and administered program.">
          <label className="block text-xs font-medium">PHA workspace
            <select className={inputClass} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">Select PHA workspace</option>
              {(profiles.data ?? []).map((row) => <option key={row.user_id} value={row.user_id}>{row.user_id.slice(0, 8)}… · {row.pha_programs.join(", ") || "no programs"}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-xs font-medium">Program
            <select className={inputClass} value={programCode} onChange={(e) => setProgramCode(e.target.value)}>
              {programs.map((program) => <option key={program} value={program}>{program.replaceAll("_", " ").toUpperCase()}</option>)}
            </select>
          </label>
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between"><span>Program applicability</span><Pill tone={profile?.pha_programs.includes(programCode) ? "seal" : undefined}>{profile?.pha_programs.includes(programCode) ? "Derived applicable" : "Not applicable"}</Pill></div>
            <div className="flex justify-between"><span>HOTMA cohort</span><span className="font-mono">{profile?.pha_hotma_cohort ?? "—"}</span></div>
            <div className="flex justify-between"><span>HUD-50058 path</span><span className="font-mono">{profile?.hud_50058_reporting_path ?? "—"}</span></div>
          </div>
          <button type="button" onClick={loadCurrent} disabled={!selectedUserId} className="mt-4 w-full rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Load current control state</button>
        </Panel>

        <Panel title="Authoritative control state" description="Staff-governed source, rule, HOTMA, reporting, and software gates. Saving refreshes all downstream family and HUD-50058 snapshots automatically.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium">Source release<select className={inputClass} value={draft.source_release_status} onChange={(e) => setDraft((v) => ({ ...v, source_release_status: e.target.value }))}><option value="pending">Pending</option><option value="approved">Approved</option><option value="blocked">Blocked</option></select></label>
            <label className="text-xs font-medium">Rule version status<select className={inputClass} value={draft.rule_version_status} onChange={(e) => setDraft((v) => ({ ...v, rule_version_status: e.target.value }))}><option value="pending">Pending</option><option value="current">Current</option><option value="stale">Stale</option><option value="blocked">Blocked</option></select></label>
            <label className="text-xs font-medium">HOTMA policy status<select className={inputClass} value={draft.hotma_policy_status} onChange={(e) => setDraft((v) => ({ ...v, hotma_policy_status: e.target.value }))}><option value="pending">Pending</option><option value="validated">Validated</option><option value="not_applicable">Not applicable</option><option value="blocked">Blocked</option></select></label>
            <label className="text-xs font-medium">Reporting path status<select className={inputClass} value={draft.reporting_path_status} onChange={(e) => setDraft((v) => ({ ...v, reporting_path_status: e.target.value }))}><option value="pending">Pending</option><option value="validated">Validated</option><option value="blocked">Blocked</option></select></label>
            <label className="text-xs font-medium">Software compatibility<select className={inputClass} value={draft.software_compatibility_status} onChange={(e) => setDraft((v) => ({ ...v, software_compatibility_status: e.target.value }))}><option value="pending">Pending</option><option value="validated">Validated</option><option value="blocked">Blocked</option></select></label>
            <label className="text-xs font-medium">Controlled source authority<input className={inputClass} value={draft.source_authority_key} onChange={(e) => setDraft((v) => ({ ...v, source_authority_key: e.target.value }))} placeholder="HUD notice/rule-pack authority key" /></label>
            <label className="text-xs font-medium">Rule version<input className={inputClass} value={draft.rule_version} onChange={(e) => setDraft((v) => ({ ...v, rule_version: e.target.value }))} placeholder="Controlled rule-pack version" /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium"><input type="checkbox" checked={draft.source_status_conflict} onChange={(e) => setDraft((v) => ({ ...v, source_status_conflict: e.target.checked }))} />Source-status conflict</label>
          </div>
          <button type="button" onClick={() => save.mutate()} disabled={!selectedUserId || save.isPending} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{save.isPending ? "Saving…" : "Save authoritative state"}</button>
          {save.isError ? <p className="mt-2 text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Unable to save control state."}</p> : null}
          {current?.validated_at ? <p className="mt-3 text-xs text-muted-foreground">Current record last validated {new Date(current.validated_at).toLocaleString()}.</p> : null}
        </Panel>
      </div>
    </CrmShell>
  );
}
