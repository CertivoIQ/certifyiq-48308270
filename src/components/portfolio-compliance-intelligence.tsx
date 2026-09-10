import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Trend = Record<string, string | number>;
type PortfolioReport = {
  range: { from: string; to: string };
  method: string;
  benchmarking: { status: "not_enabled"; reason: string };
  summary: {
    certifications: number;
    findings: number;
    findings_per_100_certifications: number;
    open_critical_findings: number;
    average_remediation_hours: number;
    audit_readiness: number;
  };
  finding_categories: Trend[];
  repeat_deficiency_patterns: Trend[];
  property_trends: Trend[];
  program_trends: Trend[];
  reviewer_trends: Trend[];
  recurring_evidence_deficiencies: Trend[];
};

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
function TrendList({ title, rows }: { title: string; rows: Trend[] }) {
  return (
    <div className="rounded-md border p-4">
      <p className="font-medium">{title}</p>
      <div className="mt-2 space-y-2">
        {rows.slice(0, 8).map((row, index) => <pre key={index} className="overflow-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(row)}</pre>)}
        {!rows.length ? <p className="text-sm text-muted-foreground">No structured records in this range.</p> : null}
      </div>
    </div>
  );
}

export function PortfolioComplianceIntelligence() {
  const [fromDate, setFromDate] = useState(() => isoDaysAgo(365));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<PortfolioReport | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const analytics = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc("portfolio_compliance_intelligence", { _from_date: fromDate, _to_date: toDate });
      if (error) throw error;
      return data as PortfolioReport;
    },
    onSuccess: setReport,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Portfolio analytics failed closed"),
  });

  return (
    <Panel
      title="Portfolio Compliance Intelligence"
      description="Explainable portfolio trends calculated only from your structured CertivoIQ records."
      actions={<Button size="sm" onClick={() => analytics.mutate()} disabled={analytics.isPending}><BarChart3 className="size-4" /> Generate analytics</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="analytics-from">From</Label><Input id="analytics-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="analytics-to">Through</Label><Input id="analytics-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
      </div>
      {report ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2"><Pill tone="seal">Tenant scoped</Pill><Pill tone="neutral">Benchmarking not enabled</Pill><span className="text-sm text-muted-foreground">{report.benchmarking.reason}</span></div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Certifications" value={report.summary.certifications} />
            <Stat label="Findings" value={report.summary.findings} />
            <Stat label="Findings / 100" value={report.summary.findings_per_100_certifications} />
            <Stat label="Open critical" value={report.summary.open_critical_findings} />
            <Stat label="Avg remediation hours" value={report.summary.average_remediation_hours} />
            <Stat label="Audit readiness" value={report.summary.audit_readiness} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendList title="Finding categories" rows={report.finding_categories} />
            <TrendList title="Repeat deficiency patterns" rows={report.repeat_deficiency_patterns} />
            <TrendList title="Trend by property" rows={report.property_trends} />
            <TrendList title="Trend by program" rows={report.program_trends} />
            <TrendList title="Trend by reviewer / team" rows={report.reviewer_trends} />
            <TrendList title="Recurring evidence deficiencies" rows={report.recurring_evidence_deficiencies} />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
