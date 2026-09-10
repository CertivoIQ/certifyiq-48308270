import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Network, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type ImpactItem = {
  node_id: string;
  node_kind: string;
  canonical_key: string;
  label: string;
  graph_distance: number;
};
type ImpactReport = {
  analysis_id: string;
  calculated_at: string;
  source_label: string;
  source_version: string | null;
  validation_status: string;
  analysis_status: "analysis_only";
  requires_authorized_review: true;
  automatic_activation: false;
  impacted_counts: Record<string, number>;
  drill_down: ImpactItem[];
  analysis_sha256: string;
};

export function ComplianceImpactAnalysis() {
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ImpactReport | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const analysis = useMutation({
    mutationFn: async () => {
      if (!sourceNodeId.trim()) throw new Error("Select a validated regulatory source node");
      const { data, error } = await client.rpc("calculate_compliance_impact", {
        _source_node_id: sourceNodeId.trim(),
        _as_of: asOf,
      });
      if (error) throw error;
      return data as ImpactReport;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success("Impact analysis preserved", { description: "No regulatory change was activated." });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Impact analysis failed closed"),
  });

  return (
    <Panel
      title="Compliance Impact Analysis"
      description="Calculate the tenant scope affected by a validated regulatory source change without activating it."
      actions={<Button size="sm" onClick={() => analysis.mutate()} disabled={analysis.isPending}><Search className="size-4" /> Analyze impact</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
        <div className="space-y-2">
          <Label htmlFor="impact-source-node">Validated source node ID</Label>
          <Input id="impact-source-node" value={sourceNodeId} onChange={(event) => setSourceNodeId(event.target.value)} placeholder="Compliance Graph source UUID" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="impact-as-of">Effective scope as of</Label>
          <Input id="impact-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </div>
      </div>
      {report ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="seal">{report.validation_status}</Pill>
            <Pill tone="flag">Analysis only</Pill>
            <span className="text-sm text-muted-foreground">Authorized review required; automatic activation is disabled.</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {Object.entries(report.impacted_counts).map(([kind, count]) => <Stat key={kind} label={kind} value={count} />)}
          </div>
          <div>
            <p className="flex items-center gap-2 font-medium"><Network className="size-4" /> Affected records</p>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {report.drill_down.map((item) => (
                <div key={item.node_id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><p className="font-medium">{item.label}</p><Pill tone="neutral">{item.node_kind}</Pill></div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{item.canonical_key} · graph distance {item.graph_distance}</p>
                </div>
              ))}
              {!report.drill_down.length ? <p className="text-sm text-muted-foreground">No effective downstream records were linked.</p> : null}
            </div>
          </div>
          <p className="break-all text-xs text-muted-foreground">Analysis {report.analysis_id} · SHA-256 {report.analysis_sha256}</p>
        </div>
      ) : null}
    </Panel>
  );
}
