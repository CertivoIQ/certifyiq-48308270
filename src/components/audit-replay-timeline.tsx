import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, FileClock, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type ReplayEvent = {
  id: number;
  certification_item_id: string;
  event_type: string;
  occurred_at: string;
  rule_version: string | null;
  source_version: string | null;
  calculation_inputs: Record<string, unknown>;
  evidence_state: Record<string, unknown>;
  engine_version: string | null;
  evidence_manifest_id: string | null;
  event_snapshot: Record<string, unknown>;
  event_sha256: string;
};

type CertificationOption = {
  id: string;
  original_file_name: string;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  certification_uploaded: "Certification uploaded",
  documents_uploaded: "Documents uploaded",
  document_classified: "Document classified",
  extraction_completed: "Extraction completed",
  deterministic_rules_executed: "Deterministic rules executed",
  finding_created: "Finding created",
  evidence_added: "Evidence added",
  correction_submitted: "Correction submitted",
  finding_resolved: "Finding resolved",
  reviewer_action: "Reviewer action",
  approval: "Approval",
  evidence_record_finalized: "Evidence Record finalized",
};

function jsonSummary(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length ? keys.join(", ") : "None recorded";
}

export function AuditReplayTimeline() {
  const [selectedId, setSelectedId] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 16));
  // Generated database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const certifications = useQuery({
    queryKey: ["audit-replay-certifications"],
    queryFn: async () => {
      const { data, error } = await client
        .from("certification_import_items")
        .select("id,original_file_name,created_at")
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return (data ?? []) as CertificationOption[];
    },
  });

  const effectiveId = selectedId || certifications.data?.[0]?.id || "";
  const timeline = useQuery({
    queryKey: ["audit-replay", effectiveId, asOf],
    enabled: Boolean(effectiveId && asOf),
    queryFn: async () => {
      const { data, error } = await client
        .from("audit_replay_events")
        .select("id,certification_item_id,event_type,occurred_at,rule_version,source_version,calculation_inputs,evidence_state,engine_version,evidence_manifest_id,event_snapshot,event_sha256")
        .eq("certification_item_id", effectiveId)
        .lte("occurred_at", new Date(asOf).toISOString())
        .order("occurred_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReplayEvent[];
    },
  });

  const events = timeline.data ?? [];
  const versionedCount = useMemo(
    () => events.filter((event) => event.rule_version || event.source_version || event.engine_version).length,
    [events],
  );

  return (
    <Panel
      title="Audit Replay"
      description="Reconstruct the certification review using immutable events and the versions in force at the selected time."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="audit-replay-certification">Certification</Label>
          <select
            id="audit-replay-certification"
            value={effectiveId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {(certifications.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.original_file_name} · {new Date(item.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-replay-as-of">Replay through</Label>
          <Input
            id="audit-replay-as-of"
            type="datetime-local"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill tone="neutral">{events.length} events</Pill>
        <Pill tone="seal">{versionedCount} versioned determinations</Pill>
        <Pill tone="neutral">Read-only</Pill>
      </div>

      {timeline.isError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Audit Replay could not be loaded. No present-day assumptions were substituted.
        </p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No replay events exist at this point in time.
        </p>
      ) : (
        <ol className="mt-5 space-y-4 border-l border-border pl-5">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[1.65rem] top-1 grid size-5 place-items-center rounded-full border bg-background">
                {event.event_type === "evidence_record_finalized" ? (
                  <ShieldCheck className="size-3 text-emerald-600" />
                ) : event.event_type.includes("document") ? (
                  <FileClock className="size-3" />
                ) : (
                  <Clock3 className="size-3" />
                )}
              </span>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.occurred_at).toLocaleString()}
                  </time>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Rule version: {event.rule_version ?? "Not applicable"}</span>
                  <span>Source version: {event.source_version ?? "Not applicable"}</span>
                  <span>Engine version: {event.engine_version ?? "Not applicable"}</span>
                  <span>Evidence: {jsonSummary(event.evidence_state)}</span>
                  <span>Calculation inputs: {jsonSummary(event.calculation_inputs)}</span>
                  <span>Integrity: {event.event_sha256.slice(0, 12)}…</span>
                </div>
                {event.evidence_manifest_id ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Existing Evidence Record {event.evidence_manifest_id}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
