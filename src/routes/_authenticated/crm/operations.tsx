import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, DollarSign, ShieldCheck, Workflow } from "lucide-react";

import { CrmShell } from "@/components/crm/crm-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/crm/operations")({
  head: () => ({
    meta: [
      { title: "Autonomous Operations — CertivoIQ" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OperationsControlCenter,
});

type JobRow = {
  id: string;
  job_type: string;
  worker: string;
  risk_tier: string;
  status: string;
  correlation_id: string;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  last_error: { message?: string } | null;
};

type ApprovalRow = {
  id: string;
  action_type: string;
  status: string;
  requested_at: string;
  expires_at: string;
  snapshot_sha256: string;
};

type IncidentRow = {
  id: string;
  severity: string;
  status: string;
  summary: string;
  last_seen_at: string;
};

type CostRow = { amount: number; occurred_at: string };
type CommunicationRow = {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  created_at: string;
};

async function readRows<T>(table: string, orderColumn: string): Promise<T[]> {
  const query = supabase.from(table as never).select("*").order(orderColumn, { ascending: false }).limit(100);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

function riskTone(risk: string): "neutral" | "warning" | "danger" | "seal" {
  if (risk === "tier_4_human_approval") return "danger";
  if (risk === "tier_3_reversible") return "warning";
  if (risk === "tier_2_prepare") return "seal";
  return "neutral";
}

function OperationsControlCenter() {
  const { isStaff, loading, email } = useIsStaff();
  const operations = useQuery({
    queryKey: ["crm", "operations-control-center"],
    enabled: isStaff,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [jobs, approvals, incidents, costs, communications] = await Promise.all([
        readRows<JobRow>("operations_jobs", "scheduled_at"),
        readRows<ApprovalRow>("operations_approvals", "requested_at"),
        readRows<IncidentRow>("operations_incidents", "last_seen_at"),
        readRows<CostRow>("operations_cost_events", "occurred_at"),
        readRows<CommunicationRow>("operations_communications", "created_at"),
      ]);
      return { jobs, approvals, incidents, costs, communications };
    },
  });

  const data = operations.data ?? {
    jobs: [],
    approvals: [],
    incidents: [],
    costs: [],
    communications: [],
  };
  const today = new Date().toISOString().slice(0, 10);
  const spendToday = data.costs
    .filter((row) => row.occurred_at.startsWith(today))
    .reduce((total, row) => total + Number(row.amount), 0);

  return (
    <CrmShell email={email} isStaff={isStaff} loading={loading}>
      <section className="overflow-hidden rounded-2xl border border-amber-700/20 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 p-6 text-stone-950 shadow-xl shadow-amber-950/10 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-800">
              Supervised autonomous operations
            </p>
            <h2 className="mt-2 max-w-3xl font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
              CertivoIQ Operations Control Center
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-stone-800">
              Routine observation and preparation may run automatically. Compliance authority,
              rule activation, bulk communications, billing, customer access, and production
              deployment always require human final approval.
            </p>
          </div>
          <ShieldCheck className="size-12" aria-hidden="true" />
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Queued or running" value={String(data.jobs.filter((j) => ["queued", "running", "retry_wait"].includes(j.status)).length)} hint="Bounded retries and leases" />
        <Stat label="Awaiting approval" value={String(data.approvals.filter((a) => a.status === "pending").length)} hint="Separate approver required" />
        <Stat label="Open incidents" value={String(data.incidents.filter((i) => i.status !== "resolved").length)} hint="Quarantine before escalation" />
        <Stat label="Failed or quarantined" value={String(data.jobs.filter((j) => ["failed", "quarantined"].includes(j.status)).length)} hint="No silent continuation" />
        <Stat label="Spend today" value={`$${spendToday.toFixed(2)}`} hint="Budget hard stops apply" />
      </div>

      {operations.error && (
        <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          Operations data is unavailable. Confirm that the control-plane migration has been applied.
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Jobs" description="Recent supervised work with risk and correlation identity" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {data.jobs.map((job) => (
              <li key={job.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Workflow className="size-4 text-amber-600" />
                  <span className="font-medium">{job.job_type}</span>
                  <Pill tone={riskTone(job.risk_tier)}>{job.risk_tier.replaceAll("_", " ")}</Pill>
                  <Pill tone={job.status === "completed" ? "seal" : job.status === "quarantined" ? "danger" : "neutral"}>{job.status}</Pill>
                </div>
                <p className="cite mt-1">{job.worker} · correlation {job.correlation_id}</p>
                <p className="mt-1 text-xs text-muted-foreground">Attempt {job.attempts} of {job.max_attempts} · scheduled {new Date(job.scheduled_at).toLocaleString()}</p>
              </li>
            ))}
            {!data.jobs.length && <li className="px-5 py-8 text-sm text-muted-foreground">No operational jobs have been created. Autonomous workers are not active until later controlled batches.</li>}
          </ul>
        </Panel>

        <Panel title="Human approvals" description="Immutable snapshots; requesters cannot approve their own Tier 4 action" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {data.approvals.map((approval) => (
              <li key={approval.id} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  {approval.status === "approved" ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Clock3 className="size-4 text-amber-600" />}
                  <span className="font-medium">{approval.action_type}</span>
                  <Pill tone={approval.status === "pending" ? "warning" : approval.status === "approved" ? "seal" : "danger"}>{approval.status}</Pill>
                </div>
                <p className="cite mt-1">Snapshot {approval.snapshot_sha256.slice(0, 16)}…</p>
                <p className="mt-1 text-xs text-muted-foreground">Expires {new Date(approval.expires_at).toLocaleString()}</p>
              </li>
            ))}
            {!data.approvals.length && <li className="px-5 py-8 text-sm text-muted-foreground">No approvals are waiting.</li>}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Incidents and quarantine" description="Repeated or unsafe failures stop instead of continuing" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {data.incidents.map((incident) => (
              <li key={incident.id} className="flex gap-3 px-5 py-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                <div><p className="font-medium">{incident.summary}</p><p className="cite">{incident.severity} · {incident.status} · {new Date(incident.last_seen_at).toLocaleString()}</p></div>
              </li>
            ))}
            {!data.incidents.length && <li className="px-5 py-8 text-sm text-muted-foreground">No incidents are open.</li>}
          </ul>
        </Panel>

        <Panel title="Communications" description="Platform-user campaigns remain drafts until approved" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {data.communications.map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex items-center gap-2"><span className="font-medium">{item.subject ?? item.channel}</span><Pill tone={item.status === "sent" ? "seal" : item.status === "draft" ? "neutral" : "warning"}>{item.status}</Pill></div>
                <p className="cite mt-1">{item.channel} · {new Date(item.created_at).toLocaleString()}</p>
              </li>
            ))}
            {!data.communications.length && <li className="px-5 py-8 text-sm text-muted-foreground">No regulatory communication drafts exist.</li>}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-center gap-2 font-semibold"><DollarSign className="size-4" />Cost and authority safeguard</div>
        <p className="mt-1">When a budget limit or validation gate is reached, work pauses. CertivoIQ never lowers compliance accuracy, removes evidence, or bypasses human authority to reduce cost.</p>
      </div>
    </CrmShell>
  );
}
