import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DatabaseZap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type CorpusPolicy = {
  architecture_version: string;
  raw_cross_tenant_access: boolean;
  raw_customer_records_model_training_eligible: boolean;
  model_training_permission: string;
  anonymized_aggregation_permission: string;
  anonymized_aggregation_supported: boolean;
  minimum_aggregate_tenant_count: number;
  record_counts: Record<string, number>;
};
type CorpusSnapshot = {
  as_of: string;
  policy: CorpusPolicy;
  governance_view: string;
  model_training_use: string;
  raw_customer_content_included: boolean;
  service_delivery_counts: Record<string, number>;
  recent_findings: Array<Record<string, unknown>>;
  recent_corrections: Array<Record<string, unknown>>;
};

type DetailView = "policy" | "findings" | "corrections";

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const text = (value: unknown, fallback = "—") => value === null || value === undefined || value === "" ? fallback : String(value);

export function ComplianceCorpusGovernance() {
  const [snapshot, setSnapshot] = useState<CorpusSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>("policy");
  const detailRef = useRef<HTMLDivElement>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const load = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc("compliance_corpus_governance_snapshot", {});
      if (error) throw error;
      return data as CorpusSnapshot;
    },
    onSuccess: (data) => {
      setSnapshot(data);
      setOpen(true);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Corpus governance lookup failed closed"),
  });

  const inspect = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (snapshot) setOpen(true);
    else load.mutate();
  };
  const choose = (view: DetailView) => {
    setDetailView(view);
    setOpen(true);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <Panel
      title="CertivoIQ Compliance Corpus"
      description="Provenance-preserving service-delivery intelligence with strict customer-confidentiality and data-use boundaries."
      actions={
        <Button size="sm" onClick={inspect} disabled={load.isPending} aria-expanded={open}>
          <DatabaseZap className="size-4" /> {load.isPending ? "Inspecting…" : open ? "Close governance" : "Inspect governance"}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Pill tone="seal">Tenant raw data isolated</Pill>
        <Pill tone="neutral">Training: prohibited</Pill>
        <Pill tone="neutral">Aggregation: permission required</Pill>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Raw customer records are never model-training eligible. Governance analytics use structured service-delivery metadata only. Any future anonymized aggregate requires explicit permission and at least 5 contributing tenants.
      </p>

      {open && snapshot ? (
        <div ref={detailRef} className="mt-5 space-y-5 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" /> Governance inspection</p>
              <p className="mt-1 text-xs text-muted-foreground">Snapshot {new Date(snapshot.as_of).toLocaleString()} · {pretty(snapshot.governance_view)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="seal">Raw content included: {snapshot.raw_customer_content_included ? "yes" : "no"}</Pill>
              <Pill tone="neutral">Model training: {snapshot.model_training_use}</Pill>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(snapshot.service_delivery_counts).map(([kind, count]) => {
              const view: DetailView = kind.includes("correction") ? "corrections" : kind.includes("finding") || kind.includes("critical") ? "findings" : "policy";
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => choose(view)}
                  className="cursor-pointer rounded-lg text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Stat label={pretty(kind)} value={count} />
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Corpus governance details">
            {(["policy", "findings", "corrections"] as DetailView[]).map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={detailView === view}
                onClick={() => setDetailView(view)}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${detailView === view ? "border-primary bg-primary/10" : "bg-background hover:bg-muted"}`}
              >
                {pretty(view)}
              </button>
            ))}
          </div>

          {detailView === "policy" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-background p-4">
                <p className="font-medium">Training boundary</p>
                <p className="mt-2 text-sm text-muted-foreground">Model training permission: <strong className="text-foreground">{snapshot.policy.model_training_permission}</strong></p>
                <p className="mt-1 text-sm text-muted-foreground">Raw customer records eligible: <strong className="text-foreground">{snapshot.policy.raw_customer_records_model_training_eligible ? "yes" : "no"}</strong></p>
                <p className="mt-1 text-sm text-muted-foreground">Cross-tenant raw access: <strong className="text-foreground">{snapshot.policy.raw_cross_tenant_access ? "yes" : "no"}</strong></p>
              </div>
              <div className="rounded-md border bg-background p-4">
                <p className="font-medium">Aggregation boundary</p>
                <p className="mt-2 text-sm text-muted-foreground">Permission: <strong className="text-foreground">{snapshot.policy.anonymized_aggregation_permission}</strong></p>
                <p className="mt-1 text-sm text-muted-foreground">Minimum contributing tenants: <strong className="text-foreground">{snapshot.policy.minimum_aggregate_tenant_count}</strong></p>
                <p className="mt-1 text-sm text-muted-foreground">Architecture: <span className="font-mono text-xs">{snapshot.policy.architecture_version}</span></p>
              </div>
            </div>
          ) : null}

          {detailView === "findings" ? (
            <div className="space-y-2">
              <p className="font-medium">Recent structured finding records</p>
              {snapshot.recent_findings.length ? snapshot.recent_findings.map((finding, index) => (
                <div key={text(finding["id"], String(index))} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{text(finding["rule_id"], "Finding")}</p>
                    <div className="flex gap-1.5"><Pill tone={text(finding["severity"]).toLowerCase() === "critical" ? "flag" : "neutral"}>{text(finding["severity"])}</Pill><Pill tone="neutral">{text(finding["status"])}</Pill></div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{text(finding["jurisdiction"])} · rule {text(finding["rule_version"])} · {text(finding["engine_build"])} · review {text(finding["review_state"])}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No structured finding records are available.</p>}
            </div>
          ) : null}

          {detailView === "corrections" ? (
            <div className="space-y-2">
              <p className="font-medium">Recent correction workflow records</p>
              {snapshot.recent_corrections.length ? snapshot.recent_corrections.map((correction, index) => (
                <div key={text(correction["finding_id"], String(index))} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{text(correction["rule_id"], "Correction")}</p>
                    <Pill tone={text(correction["assignment_status"]).toLowerCase() === "resolved" ? "seal" : "flag"}>{text(correction["assignment_status"], text(correction["status"]))}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Finding status {text(correction["finding_status"], text(correction["status"]))} · review {text(correction["review_state"])} · assigned {text(correction["assigned_at"])}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No correction workflow records are available.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
