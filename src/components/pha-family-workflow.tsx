import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

 type FamilyActionRow = {
  id: string;
  family_reference: string;
  program_code: string;
  action_type: string;
  effective_date: string;
  due_date: string | null;
  workflow_status: string;
  verification_complete: boolean;
  eiv_review_complete: boolean;
  calculation_complete: boolean;
  notice_complete: boolean;
};

function progressLabel(row: FamilyActionRow) {
  if (row.workflow_status === "routed") return "HUD-50058 queued";
  if (!row.verification_complete || !row.eiv_review_complete) return "Verification / EIV";
  if (!row.calculation_complete) return "Calculation";
  if (!row.notice_complete) return "Notice";
  return "Ready to route";
}

export function PhaFamilyWorkflow() {
  const query = useQuery<FamilyActionRow[]>({
    queryKey: ["pha-family-actions"],
    queryFn: async () => {
      // Generated Supabase types lag new PHA workflow tables until the next schema type refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("pha_family_actions")
        .select("id, family_reference, program_code, action_type, effective_date, due_date, workflow_status, verification_complete, eiv_review_complete, calculation_complete, notice_complete")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = query.data ?? [];
  const annuals = rows.filter((row) => row.action_type === "annual_reexamination" && row.workflow_status !== "routed").length;
  const interims = rows.filter((row) => row.action_type === "interim_reexamination" && row.workflow_status !== "routed").length;
  const open = rows.filter((row) => !["routed", "blocked"].includes(row.workflow_status)).length;

  return (
    <AppShell title="Families & Reexaminations" subtitle="Admissions, annuals, interims, verification/EIV, calculations, notices, and HUD-50058 handoff">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Families requiring action" value={open} hint="Open family workflow items" />
        <Stat label="Annual reexaminations" value={annuals} hint="Annual actions not yet routed" />
        <Stat label="Interim actions" value={interims} hint="Interim actions not yet routed" />
      </div>

      <Panel className="mt-4" title="Family workflow queue" description="A family action advances through verification/EIV, calculation, notice, and then automatically creates its HUD-50058 transaction record.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="pb-3">Family</th><th className="pb-3">Program</th><th className="pb-3">Action</th><th className="pb-3">Effective</th><th className="pb-3">Due</th><th className="pb-3">Stage</th><th className="pb-3">Controls</th></tr>
            </thead>
            <tbody>
              {query.isLoading ? <tr className="border-t border-border"><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading family workflow…</td></tr> : null}
              {!query.isLoading && rows.length === 0 ? <tr className="border-t border-border"><td colSpan={7} className="py-8 text-center text-muted-foreground">No family actions have been loaded yet.</td></tr> : null}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3 font-medium">{row.family_reference}</td>
                  <td className="py-3 pr-3">{row.program_code.replaceAll("_", " ").toUpperCase()}</td>
                  <td className="py-3 pr-3">{row.action_type.replaceAll("_", " ")}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{row.effective_date}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{row.due_date ?? "—"}</td>
                  <td className="py-3 pr-3"><Pill tone={row.workflow_status === "routed" ? "seal" : undefined}>{progressLabel(row)}</Pill></td>
                  <td className="py-3 text-xs text-muted-foreground">
                    Verification {row.verification_complete ? "✓" : "—"} · EIV {row.eiv_review_complete ? "✓" : "—"} · Calculation {row.calculation_complete ? "✓" : "—"} · Notice {row.notice_complete ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Verification / EIV evidence"><p className="text-sm leading-6 text-muted-foreground">Evidence is stored against the family action with source type, verification status, conflict flag, and reviewer notes. Conflicting evidence must remain unresolved rather than silently passing to calculation.</p></Panel>
        <Panel title="Calculation & notices"><p className="text-sm leading-6 text-muted-foreground">After verified evidence is complete, the action advances to calculation and required notice issuance. Only completed controls can trigger the HUD-50058 handoff.</p></Panel>
      </div>
    </AppShell>
  );
}
