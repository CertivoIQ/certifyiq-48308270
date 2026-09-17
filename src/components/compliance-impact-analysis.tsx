import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Network, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type SourceNode = {
  id: string;
  label: string;
  node_kind: string;
  jurisdiction: string | null;
  program_code: string | null;
  source_version: string | null;
  effective_from: string | null;
  source_family: string | null;
  source_sha256: string | null;
  source_url: string | null;
  source_type: string | null;
  authority_name: string | null;
};
type SourceCatalog = { nodes: SourceNode[]; node_id_field: string };
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

function sourceLabel(node: SourceNode) {
  const sha = node.source_sha256 ? node.source_sha256.slice(0, 10) : "no-sha";
  return [node.jurisdiction, node.authority_name ?? node.label, node.source_type, node.source_version ?? node.effective_from, `SHA ${sha}…`]
    .filter(Boolean)
    .join(" · ");
}

export function ComplianceImpactAnalysis() {
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ImpactReport | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const catalog = useQuery({
    queryKey: ["validated-regulatory-source-catalog"],
    queryFn: async () => {
      const { data, error } = await client.rpc("validated_regulatory_source_catalog", {});
      if (error) throw error;
      return data as SourceCatalog;
    },
  });
  const nodes = catalog.data?.nodes ?? [];
  const filteredNodes = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const matches = query ? nodes.filter((node) => sourceLabel(node).toLowerCase().includes(query)) : nodes;
    return matches.slice(0, 300);
  }, [nodes, searchText]);
  const selectedNode = nodes.find((node) => node.id === sourceNodeId) ?? null;

  const analysis = useMutation({
    mutationFn: async () => {
      if (!sourceNodeId) throw new Error("Select a validated regulatory source");
      const { data, error } = await client.rpc("calculate_compliance_impact", {
        _source_node_id: sourceNodeId,
        _as_of: asOf,
      });
      if (error) throw error;
      return data as ImpactReport;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success("Impact analysis preserved", { description: "No regulatory source or rule was activated." });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Impact analysis failed closed"),
  });

  return (
    <Panel
      title="Compliance Impact Analysis"
      description="Calculate the tenant scope affected by a validated regulatory source change without activating it."
      actions={<Button size="sm" onClick={() => analysis.mutate()} disabled={analysis.isPending || !sourceNodeId}><Search className="size-4" /> Analyze impact</Button>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
        <div className="space-y-2">
          <Label htmlFor="impact-source-search">Validated source</Label>
          <Input id="impact-source-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search state, authority, source type, or version" />
          <select
            id="impact-source-node"
            value={sourceNodeId}
            onChange={(event) => { setSourceNodeId(event.target.value); setReport(null); }}
            disabled={catalog.isLoading || catalog.isError || nodes.length === 0}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            aria-label="Validated regulatory source"
          >
            <option value="">{catalog.isLoading ? "Loading validated sources…" : "Select a validated source"}</option>
            {filteredNodes.map((node) => <option key={node.id} value={node.id}>{sourceLabel(node)}</option>)}
          </select>
          {catalog.isError ? <p className="text-sm text-destructive">Validated sources could not be loaded. Analysis remains unavailable.</p> : null}
          {!catalog.isLoading && !catalog.isError && nodes.length === 0 ? <p className="text-sm text-muted-foreground">No validated Compliance Graph sources are available yet.</p> : null}
          {searchText && filteredNodes.length === 300 ? <p className="text-xs text-muted-foreground">Showing the first 300 matching validated sources. Refine the search to narrow the list.</p> : null}
          {selectedNode ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Compliance Graph node ID:</strong> <span className="font-mono break-all">{selectedNode.id}</span></p>
              <p className="mt-1">Exact SHA-256: <span className="font-mono break-all">{selectedNode.source_sha256 ?? "unavailable"}</span></p>
              <p className="mt-1">This internal node ID is selected automatically from the validated source catalog.</p>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="impact-as-of">Effective scope as of</Label>
          <Input id="impact-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Impact Analysis is read-only analysis. It does not activate, approve, or reinterpret a regulatory source or rule.</p>
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
