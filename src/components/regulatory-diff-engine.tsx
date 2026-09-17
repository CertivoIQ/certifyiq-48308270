import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GitCompareArrows } from "lucide-react";
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
type DiffReport = {
  report_id: string;
  source_family: string;
  diff_status: string;
  automatic_activation: false;
  prior: { label: string; source_version: string | null };
  current: { label: string; source_version: string | null };
  changes: {
    exact_source_bytes_changed?: boolean;
    prior_sha256?: string | null;
    current_sha256?: string | null;
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

function familyLabel(nodes: SourceNode[]) {
  const node = nodes[0];
  if (!node) return "Unknown source family";
  return [node.jurisdiction, node.authority_name ?? node.label, node.source_type, node.program_code].filter(Boolean).join(" · ");
}
function versionLabel(node: SourceNode) {
  const sha = node.source_sha256 ? node.source_sha256.slice(0, 10) : "no-sha";
  return [node.source_version ?? "unversioned", node.effective_from ? `effective ${node.effective_from}` : null, `SHA ${sha}…`].filter(Boolean).join(" · ");
}

function BooleanSummary({ label, value }: { label: string; value: boolean | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ? "Yes" : "No"}</p>
    </div>
  );
}

export function RegulatoryDiffEngine() {
  const [family, setFamily] = useState("");
  const [priorId, setPriorId] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<DiffReport | null>(null);
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
  const families = useMemo(() => {
    const grouped = new Map<string, SourceNode[]>();
    for (const node of nodes) {
      if (!node.source_family) continue;
      const group = grouped.get(node.source_family) ?? [];
      group.push(node);
      grouped.set(node.source_family, group);
    }
    return [...grouped.entries()]
      .map(([key, values]) => ({ key, values: [...values].sort((a, b) => (a.effective_from ?? "").localeCompare(b.effective_from ?? "")), label: familyLabel(values) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes]);
  const versions = families.find((entry) => entry.key === family)?.values ?? [];
  const selectedPrior = versions.find((node) => node.id === priorId) ?? null;
  const selectedCurrent = versions.find((node) => node.id === currentId) ?? null;
  const hasPair = versions.length >= 2;

  const comparison = useMutation({
    mutationFn: async () => {
      if (!family) throw new Error("Select a validated source family");
      if (!priorId || !currentId) throw new Error("Select both validated source versions");
      if (priorId === currentId) throw new Error("Prior and current versions must be different");
      const { data, error } = await client.rpc("compare_regulatory_source_versions", {
        _prior_source_node_id: priorId,
        _current_source_node_id: currentId,
        _as_of: asOf,
      });
      if (error) throw error;
      return data as DiffReport;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success("Regulatory diff preserved", { description: "Authorized review is required before any activation." });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Regulatory comparison failed closed"),
  });

  const selectFamily = (value: string) => {
    setFamily(value);
    setPriorId("");
    setCurrentId("");
    setReport(null);
  };

  return (
    <Panel
      title="Regulatory Diff Engine"
      description="Compare validated versions of the same regulatory source family using exact source identity and structured changes."
      actions={<Button size="sm" onClick={() => comparison.mutate()} disabled={comparison.isPending || !hasPair || !priorId || !currentId || priorId === currentId}><GitCompareArrows className="size-4" /> Compare versions</Button>}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="diff-family">Validated source family</Label>
          <select id="diff-family" value={family} onChange={(event) => selectFamily(event.target.value)} disabled={catalog.isLoading || catalog.isError || families.length === 0} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">{catalog.isLoading ? "Loading validated sources…" : "Select a source family"}</option>
            {families.map((entry) => <option key={entry.key} value={entry.key}>{entry.label} · {entry.values.length} version{entry.values.length === 1 ? "" : "s"}</option>)}
          </select>
          {catalog.isError ? <p className="text-sm text-destructive">Validated sources could not be loaded. Comparison remains unavailable.</p> : null}
        </div>

        {family ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
            <div className="space-y-2">
              <Label htmlFor="diff-prior">Prior validated version</Label>
              <select id="diff-prior" value={priorId} onChange={(event) => { setPriorId(event.target.value); setReport(null); }} disabled={!hasPair} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select prior version</option>
                {versions.map((node) => <option key={node.id} value={node.id}>{versionLabel(node)}</option>)}
              </select>
              {selectedPrior ? <p className="break-all font-mono text-xs text-muted-foreground">Graph node {selectedPrior.id}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="diff-current">Current validated version</Label>
              <select id="diff-current" value={currentId} onChange={(event) => { setCurrentId(event.target.value); setReport(null); }} disabled={!hasPair} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select current version</option>
                {versions.map((node) => <option key={node.id} value={node.id}>{versionLabel(node)}</option>)}
              </select>
              {selectedCurrent ? <p className="break-all font-mono text-xs text-muted-foreground">Graph node {selectedCurrent.id}</p> : null}
            </div>
            <div className="space-y-2"><Label htmlFor="diff-as-of">Impact as of</Label><Input id="diff-as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          </div>
        ) : null}
        {family && !hasPair ? <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">This validated source family currently has only one captured version, so there is no prior/current comparison pair yet.</p> : null}
        <p className="text-xs text-muted-foreground">The Diff Engine compares exact validated source versions and preserves an analysis report. It does not activate, approve, or legally interpret a source change.</p>
      </div>

      {report ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="flag">Awaiting authorized review</Pill>
            <span className="text-sm text-muted-foreground">Automatic activation is disabled.</span>
          </div>
          <p className="font-medium">{report.prior.label} ({report.prior.source_version ?? "unversioned"}) → {report.current.label} ({report.current.source_version ?? "unversioned"})</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <BooleanSummary label="Exact bytes changed" value={report.changes.exact_source_bytes_changed} />
            <BooleanSummary label="Text changed" value={report.changes.substantive_text_changed} />
            <BooleanSummary label="Effective date changed" value={report.changes.effective_date_changed} />
            <BooleanSummary label="Supersession declared" value={report.changes.supersession_declared} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4"><p className="font-medium">Requirements added</p><p className="mt-2 text-sm text-muted-foreground">{report.changes.requirements_added.join(", ") || "None explicitly captured"}</p></div>
            <div className="rounded-md border p-4"><p className="font-medium">Requirements removed</p><p className="mt-2 text-sm text-muted-foreground">{report.changes.requirements_removed.join(", ") || "None explicitly captured"}</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">{Object.entries(report.impacted_counts).map(([kind, count]) => <Stat key={kind} label={kind} value={count} />)}</div>
          <p className="text-xs text-muted-foreground">{report.changes.limitations.join(" ")}</p>
          <p className="break-all text-xs text-muted-foreground">Report {report.report_id} · SHA-256 {report.report_sha256}</p>
        </div>
      ) : null}
    </Panel>
  );
}
