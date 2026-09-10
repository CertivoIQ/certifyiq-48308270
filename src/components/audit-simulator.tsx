import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileSearch, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

const MODES = [
  ["lihtc_monitoring", "LIHTC monitoring"],
  ["hud_mor", "HUD MOR"],
  ["home_monitoring", "HOME monitoring"],
  ["hcv_pbv_review", "HCV/PBV review"],
  ["investor_review", "Investor review"],
  ["internal_qa_review", "Internal QA review"],
] as const;

type Classification =
  | "Confirmed Deficiency"
  | "Potential Exposure"
  | "Missing Evidence"
  | "Unable to Determine";

type SimulationOutcome = {
  classification: Classification;
  classification_basis: string;
  deduction_id?: string;
  title: string;
  explanation: string;
  remediation: string;
  source_table: string | null;
  entity_id: string | null;
  program_code?: string | null;
};

type SimulationReport = {
  report_id: string;
  report_sha256: string;
  generated_at: string;
  as_of: string;
  simulation_mode_label: string;
  method: string;
  supported_criteria: string[];
  sampling_basis: string;
  limitations: string;
  summary: Record<Classification, number>;
  outcomes: SimulationOutcome[];
};

function commaSeparated(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toneFor(classification: Classification) {
  if (classification === "Confirmed Deficiency") return "reject" as const;
  if (classification === "Potential Exposure" || classification === "Missing Evidence") return "flag" as const;
  return "neutral" as const;
}

export function AuditSimulator() {
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("lihtc_monitoring");
  const [propertyIds, setPropertyIds] = useState("");
  const [programCodes, setProgramCodes] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<SimulationReport | null>(null);
  // Generated database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc("run_audit_simulation", {
        _mode: mode,
        _property_ids: commaSeparated(propertyIds),
        _program_codes: commaSeparated(programCodes),
        _as_of: asOf,
      });
      if (error) throw error;
      return data as SimulationReport;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success("Simulation report generated", {
        description: "The immutable report uses supported structured criteria only.",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Simulation could not be generated");
    },
  });

  return (
    <Panel
      title="Audit Simulator"
      description="Run a conservative simulated review without fabricated sampling rules or predictions about auditor discretion."
      actions={
        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
          <Play className="size-4" /> {run.isPending ? "Running…" : "Run simulation"}
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="simulation-mode">Review mode</Label>
          <select
            id="simulation-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="simulation-properties">Property IDs</Label>
          <Input
            id="simulation-properties"
            value={propertyIds}
            onChange={(event) => setPropertyIds(event.target.value)}
            placeholder="Optional, comma separated"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="simulation-programs">Program codes</Label>
          <Input
            id="simulation-programs"
            value={programCodes}
            onChange={(event) => setProgramCodes(event.target.value)}
            placeholder="Optional, comma separated"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="simulation-as-of">As of</Label>
          <Input id="simulation-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </div>
      </div>

      {report ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium"><FileSearch className="size-4" /> {report.simulation_mode_label}</p>
              <Pill tone="seal">Immutable report</Pill>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{report.sampling_basis}</p>
            <p className="mt-1 text-sm text-muted-foreground">{report.limitations}</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
              {(Object.entries(report.summary) as [Classification, number][]).map(([label, count]) => (
                <div key={label} className="rounded-md bg-muted p-2">
                  <p className="font-semibold tabular-nums">{count}</p><p className="text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium">Supported criteria</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.supported_criteria.map((criterion) => <Pill key={criterion} tone="neutral">{criterion}</Pill>)}
            </div>
          </div>

          <div className="space-y-3">
            {report.outcomes.map((outcome, index) => (
              <div key={outcome.deduction_id ?? `outcome-${index}`} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{outcome.title}</p>
                  <Pill tone={toneFor(outcome.classification)}>{outcome.classification}</Pill>
                </div>
                <p className="mt-2 text-sm">{outcome.explanation}</p>
                <p className="mt-1 text-sm text-muted-foreground">{outcome.classification_basis}</p>
                <p className="mt-2 text-sm"><span className="font-medium">Next action:</span> {outcome.remediation}</p>
                {outcome.source_table && outcome.entity_id ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {outcome.source_table} · {outcome.entity_id}{outcome.program_code ? ` · ${outcome.program_code}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="break-all text-xs text-muted-foreground">
            Report {report.report_id} · SHA-256 {report.report_sha256}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
