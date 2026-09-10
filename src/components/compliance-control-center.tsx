import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Attention = {
  priority: number;
  attention_type: string;
  record_id: string;
  title: string;
  detail: string;
  property_id: string | null;
  due_date: string | null;
  source_table: string;
};
type ControlCenter = {
  as_of: string;
  method: string;
  readiness_threshold: number;
  summary: {
    portfolio_size: number;
    units: number;
    certifications_in_progress: number;
    audit_readiness: number;
    critical_findings: number;
    overdue_items: number;
    regulatory_changes_requiring_attention: number;
    remediation_approaching_sla: number;
    properties_below_readiness: number;
  };
  needs_attention_today: Attention[];
};

export function ComplianceControlCenter() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [threshold, setThreshold] = useState(80);
  const [report, setReport] = useState<ControlCenter | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const refresh = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc("compliance_control_center", { _as_of: asOf, _readiness_threshold: threshold });
      if (error) throw error;
      return data as ControlCenter;
    },
    onSuccess: setReport,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Control Center failed closed"),
  });

  return (
    <Panel
      title="Compliance Control Center"
      description="What needs your attention today, grounded in structured CertivoIQ data."
      actions={<Button size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCw className="size-4" /> Refresh</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-2"><Label htmlFor="control-as-of">Operational date</Label><Input id="control-as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="control-threshold">Readiness threshold</Label><Input id="control-threshold" type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></div>
      </div>
      {report ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Properties" value={report.summary.portfolio_size} />
            <Stat label="Units" value={report.summary.units} />
            <Stat label="Certifications in progress" value={report.summary.certifications_in_progress} />
            <Stat label="Audit readiness" value={report.summary.audit_readiness} />
            <Stat label="Critical findings" value={report.summary.critical_findings} />
            <Stat label="Overdue items" value={report.summary.overdue_items} />
            <Stat label="Regulatory changes" value={report.summary.regulatory_changes_requiring_attention} />
            <Stat label="Approaching SLA" value={report.summary.remediation_approaching_sla} />
            <Stat label="Properties below threshold" value={report.summary.properties_below_readiness} />
          </div>
          <div>
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> What needs my attention today?</p>
            <div className="mt-2 space-y-2">
              {report.needs_attention_today.map((item) => (
                <div key={item.attention_type + item.record_id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2"><Pill tone={item.priority<=2 ? "flag" : "neutral"}>Priority {item.priority}</Pill><p className="font-medium">{item.title}</p></div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.source_table} · {item.record_id}{item.due_date ? ` · due ${item.due_date}` : ""}</p>
                </div>
              ))}
              {!report.needs_attention_today.length ? <p className="text-sm text-muted-foreground">No structured records require attention for this date.</p> : null}
            </div>
          </div>
        </div>
      ) : <p className="mt-4 text-sm text-muted-foreground">Refresh to load the structured attention queue.</p>}
    </Panel>
  );
}
