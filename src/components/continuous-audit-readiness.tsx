import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ListChecks, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meter, Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Deduction = {
  deduction_id: string;
  deduction_code: string;
  points: number;
  entity_type: string;
  entity_id: string;
  property_id: string | null;
  program_code: string | null;
  due_date: string | null;
  title: string;
  explanation: string;
  remediation: string;
  source_table: string;
};

type RemediationQueueItem = {
  queue_order: number;
  deduction_id: string;
  points_recovered: number;
  title: string;
  remediation: string;
  entity_type: string;
  entity_id: string;
  property_id: string | null;
  program_code: string | null;
  due_date: string | null;
  source_table: string;
};

type ReadinessResult = {
  as_of: string;
  score: number;
  total_deduction: number;
  method: "deterministic-v1";
  deductions: Deduction[];
  get_me_to_100: RemediationQueueItem[];
};

export function ContinuousAuditReadiness() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [showQueue, setShowQueue] = useState(false);
  // Generated database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const readiness = useQuery({
    queryKey: ["continuous-audit-readiness", asOf],
    queryFn: async () => {
      const { data, error } = await client.rpc("audit_readiness_score", { _as_of: asOf });
      if (error) throw error;
      return data as ReadinessResult;
    },
  });
  const result = readiness.data;
  const score = result?.score ?? 0;

  return (
    <Panel
      title="Continuous Audit Readiness"
      description="A deterministic score where every deducted point maps to a concrete compliance record."
      actions={
        <Button size="sm" onClick={() => setShowQueue((value) => !value)} disabled={!result}>
          <Target className="size-4" /> Get me to 100
        </Button>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-semibold tabular-nums">{score}</p>
          <p className="text-sm text-muted-foreground">out of 100 · {result?.method ?? "deterministic-v1"}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="readiness-as-of">Score as of</Label>
          <Input id="readiness-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <Meter value={score} tone={score === 100 ? "seal" : score >= 70 ? "flag" : "reject"} />
      </div>

      {readiness.isError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Readiness could not be calculated. CertivoIQ did not substitute an estimated score.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {(result?.deductions ?? []).map((item) => (
            <div key={item.deduction_id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                <Pill tone={item.points >= 10 ? "reject" : "flag"}>−{item.points} points</Pill>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.explanation}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{item.source_table} · {item.entity_id}</span>
                {item.program_code ? <span>Program {item.program_code}</span> : null}
                {item.due_date ? <span>Due {item.due_date}</span> : null}
              </div>
            </div>
          ))}
          {result?.deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No concrete deductions were present at this date.</p>
          ) : null}
        </div>
      )}

      {showQueue && result ? (
        <div className="mt-5 rounded-lg border border-primary/25 bg-primary/5 p-4">
          <p className="flex items-center gap-2 font-medium">
            <ListChecks className="size-4" /> Exact remediation queue
          </p>
          <ol className="mt-3 space-y-3">
            {result.get_me_to_100.map((item) => (
              <li key={item.deduction_id} className="flex gap-3 text-sm">
                <span className="font-semibold tabular-nums">{item.queue_order}.</span>
                <div>
                  <p className="font-medium">
                    {item.title} <ArrowRight className="inline size-3" /> recover {item.points_recovered} points
                  </p>
                  <p className="text-muted-foreground">{item.remediation}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Panel>
  );
}
