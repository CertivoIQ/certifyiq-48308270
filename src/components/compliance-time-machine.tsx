import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, GitCompareArrows } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Readiness = {
  status: "Available" | "Unavailable";
  score?: number;
  calculated_at?: string;
  reason?: string;
};
type HistoricalState = {
  as_of: string;
  historical_basis: string;
  readiness: Readiness;
  counts: {
    open_findings: number;
    unresolved_corrections: number;
    applicable_rules: number;
    exposed_programs: number;
  };
  open_findings: Array<{
    finding_id: string;
    property_id: string | null;
    rule_version: string | null;
    source_version: string | null;
    engine_version: string | null;
  }>;
  applicable_rules: Array<{
    node_id: string;
    label: string;
    program_code: string | null;
    jurisdiction: string | null;
    rule_version: string | null;
    source_version: string | null;
  }>;
  program_exposure: Array<{ program_code: string; property_count: number }>;
};
type TimeMachineResult = {
  current_state: HistoricalState;
  comparison_state: HistoricalState | null;
  changes: Record<string, number | null> | null;
  notice: string;
};

function endOfDay(value: string) {
  return value + "T23:59:59.999Z";
}

export function ComplianceTimeMachine() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [compareTo, setCompareTo] = useState("");
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const query = useQuery({
    queryKey: ["compliance-time-machine", asOf, compareTo],
    queryFn: async () => {
      const { data, error } = await client.rpc("compliance_time_machine", {
        _as_of: endOfDay(asOf),
        _compare_to: compareTo ? endOfDay(compareTo) : null,
      });
      if (error) throw error;
      return data as TimeMachineResult;
    },
  });
  const state = query.data?.current_state;

  return (
    <Panel
      title="Compliance Time Machine"
      description="Reconstruct posture from stored historical events, effective-dated rules, and snapshots—never from present-day assumptions."
      actions={<Pill tone="seal"><CalendarClock className="size-3.5" /> Stored history</Pill>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="time-machine-as-of">View posture as of</Label>
          <Input id="time-machine-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time-machine-compare">Compare with</Label>
          <Input id="time-machine-compare" type="date" value={compareTo} onChange={(event) => setCompareTo(event.target.value)} />
        </div>
      </div>

      {query.isError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">Historical posture could not be reconstructed. No current-state substitute was used.</p>
      ) : state ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="Readiness" value={state.readiness.status === "Available" ? String(state.readiness.score) : "Unavailable"} />
            <Stat label="Open findings" value={state.counts.open_findings} />
            <Stat label="Open corrections" value={state.counts.unresolved_corrections} />
            <Stat label="Applicable rules" value={state.counts.applicable_rules} />
            <Stat label="Programs exposed" value={state.counts.exposed_programs} />
          </div>
          {state.readiness.status === "Unavailable" ? <p className="text-sm text-muted-foreground">{state.readiness.reason}</p> : null}

          {query.data?.changes ? (
            <div className="rounded-lg border p-4">
              <p className="flex items-center gap-2 font-medium"><GitCompareArrows className="size-4" /> Changes between selected dates</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(query.data.changes).map(([key, value]) => (
                  <Pill key={key} tone={value === null ? "neutral" : value > 0 ? "flag" : "seal"}>
                    {key.replaceAll("_", " ")}: {value === null ? "Unavailable" : value > 0 ? `+${value}` : value}
                  </Pill>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="font-medium">Open findings at this point</p>
              <div className="mt-2 space-y-2">
                {state.open_findings.map((finding) => (
                  <div key={finding.finding_id} className="rounded-md border p-3 text-sm">
                    <p className="font-mono text-xs">{finding.finding_id}</p>
                    <p className="mt-1 text-muted-foreground">
                      Rule {finding.rule_version ?? "Unavailable"} · Source {finding.source_version ?? "Unavailable"} · Engine {finding.engine_version ?? "Unavailable"}
                    </p>
                  </div>
                ))}
                {!state.open_findings.length ? <p className="text-sm text-muted-foreground">No open finding events existed at this point.</p> : null}
              </div>
            </div>
            <div>
              <p className="font-medium">Applicable rule versions</p>
              <div className="mt-2 space-y-2">
                {state.applicable_rules.map((rule) => (
                  <div key={rule.node_id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{rule.label}</p>
                    <p className="text-muted-foreground">{rule.program_code ?? "Program unavailable"} · {rule.jurisdiction ?? "Jurisdiction unavailable"}</p>
                    <p className="font-mono text-xs">Rule {rule.rule_version ?? "Unavailable"} · Source {rule.source_version ?? "Unavailable"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{query.data?.notice}</p>
        </div>
      ) : null}
    </Panel>
  );
}
