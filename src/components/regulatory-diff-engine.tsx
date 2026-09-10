import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GitCompareArrows } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type DiffReport = {
  report_id: string;
  source_family: string;
  diff_status: string;
  automatic_activation: false;
  prior: { label: string; source_version: string | null };
  current: { label: string; source_version: string | null };
  changes: {
    substantive_text_changed: boolean;
    effective_date_changed: boolean;
    requirements_added: string[];
    requirements_removed: string[];
    supersession_declared: boolean;
    impacted_rule_mappings: string[];
    limitations: string[];
  };
  impacted_counts: Record<string, number>;
  report_sha256: string;
};

export function RegulatoryDiffEngine() {
  const [priorId, setPriorId] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<DiffReport | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const comparison = useMutation({
    mutationFn: async () => {
      if (!priorId.trim() || !currentId.trim()) throw new Error("Select both validated source versions");
      const { data, error } = await client.rpc("compare_regulatory_source_versions", {
        _prior_source_node_id: priorId.trim(),
        _current_source_node_id: currentId.trim(),
        _as_of: asOf,
      });
      if (error) throw error;
      return data as DiffReport;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success("Regulatory diff preserved", { description: "Authorized review is required before activation." });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Regulatory comparison failed closed"),
  });

  return (
    <Panel
      title="Regulatory Diff Engine"
      description="Compare two validated versions using exact structured changes, then map the affected compliance scope."
      actions={<Button size="sm" onClick={() => comparison.mutate()} disabled={comparison.isPending}><GitCompareArrows className="size-4" /> Compare versions</Button>}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
        <div className="space-y-2"><Label htmlFor="diff-prior">Prior source node ID</Label><Input id="diff-prior" value={priorId} onChange={(e) => setPriorId(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="diff-current">Current source node ID</Label><Input id="diff-current" value={currentId} onChange={(e) => setCurrentId(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="diff-as-of">Impact as of</Label><Input id="diff-as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
      </div>
      {report ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="flag">Awaiting authorized review</Pill>
            <span className="text-sm text-muted-foreground">Automatic activation is disabled.</span>
          </div>
          <p className="font-medium">{report.prior.label} ({report.prior.source_version ?? "unversioned"}) → {report.current.label} ({report.current.source_version ?? "unversioned"})</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Text changed" value={report.changes.substantive_text_changed ? "Yes" : "No"} />
            <Stat label="Effective date changed" value={report.changes.effective_date_changed ? "Yes" : "No"} />
            <Stat label="Supersession declared" value={report.changes.supersession_declared ? "Yes" : "No"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4"><p className="font-medium">Requirements added</p><p className="mt-2 text-sm text-muted-foreground">{report.changes.requirements_added.join(", ") || "None"}</p></div>
            <div className="rounded-md border p-4"><p className="font-medium">Requirements removed</p><p className="mt-2 text-sm text-muted-foreground">{report.changes.requirements_removed.join(", ") || "None"}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">{Object.entries(report.impacted_counts).map(([kind, count]) => <Stat key={kind} label={kind} value={count} />)}</div>
          <p className="text-xs text-muted-foreground">{report.changes.limitations.join(" ")}</p>
          <p className="break-all text-xs text-muted-foreground">Report {report.report_id} · SHA-256 {report.report_sha256}</p>
        </div>
      ) : null}
    </Panel>
  );
}
