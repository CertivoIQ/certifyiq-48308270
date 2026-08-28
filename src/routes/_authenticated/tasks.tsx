import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSearch,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { OperationsApprovalActions } from "@/components/crm/operations-approval-actions";
import { Button } from "@/components/ui/button";
import { Panel, Pill, Stat, type Tone } from "@/components/ui-kit";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — CertivoIQ" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TasksWorkspace,
});

type TaskCategory = "approval" | "verification" | "rule_pack" | "incident";
type TaskDestination = "/pha-nspire-standards" | "/rules" | "/state-rule-validation" | "/crm/operations";
type TaskItem = {
  id: string;
  category: TaskCategory;
  title: string;
  description: string;
  status: string;
  active: boolean;
  occurredAt: string;
  destination: TaskDestination;
  actionLabel: string;
  approvalId?: string;
  approvalType?: string;
  attention?: boolean;
};

type NspireRelease = {
  id: string;
  source_version: string;
  status: string;
  imported_standard_count: number;
  imported_deficiency_count: number;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
};
type NspireAttestation = { release_id: string; verifier_id: string };
type RulePackRelease = {
  id: string;
  state_code: string;
  version: string;
  status: string;
  validated_rule_count: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};
type Approval = {
  id: string;
  action_type: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
  expires_at: string;
  snapshot_sha256: string;
};
type Incident = {
  id: string;
  severity: string;
  status: string;
  summary: string;
  last_seen_at: string;
  resolved_at: string | null;
};
type SourceVersion = {
  id: string;
  authority: string;
  program: string;
  jurisdiction: string;
  parsing_status: string;
  validation_status: string;
  retrieved_at: string;
};

function categoryLabel(category: TaskCategory) {
  if (category === "approval") return "Approval";
  if (category === "verification") return "Verification";
  if (category === "rule_pack") return "Rule pack";
  return "Incident";
}

function categoryIcon(category: TaskCategory) {
  if (category === "approval") return <ClipboardCheck className="size-4" />;
  if (category === "verification") return <FileSearch className="size-4" />;
  if (category === "rule_pack") return <ShieldCheck className="size-4" />;
  return <AlertTriangle className="size-4" />;
}

function taskTone(task: TaskItem): Tone {
  if (!task.active) return "seal";
  if (task.attention) return "reject";
  return "flag";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

async function loadTasks(): Promise<TaskItem[]> {
  // Generated Supabase types lag the controlled governance tables until schema types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const [releaseResult, attestationResult, packResult, approvalResult, incidentResult, sourceResult] =
    await Promise.all([
      client
        .from("pha_nspire_standard_releases")
        .select("id,source_version,status,imported_standard_count,imported_deficiency_count,created_at,updated_at,activated_at")
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("pha_nspire_release_attestations")
        .select("release_id,verifier_id"),
      client
        .from("state_rule_pack_releases")
        .select("id,state_code,version,status,validated_rule_count,approved_at,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100),
      client
        .from("operations_approvals")
        .select("id,action_type,status,requested_at,decided_at,expires_at,snapshot_sha256")
        .order("requested_at", { ascending: false })
        .limit(100),
      client
        .from("operations_incidents")
        .select("id,severity,status,summary,last_seen_at,resolved_at")
        .order("last_seen_at", { ascending: false })
        .limit(100),
      client
        .from("operations_source_versions")
        .select("id,authority,program,jurisdiction,parsing_status,validation_status,retrieved_at")
        .order("retrieved_at", { ascending: false })
        .limit(100),
    ]);

  const results = [
    releaseResult,
    attestationResult,
    packResult,
    approvalResult,
    incidentResult,
    sourceResult,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const releases = (releaseResult.data ?? []) as NspireRelease[];
  const attestations = (attestationResult.data ?? []) as NspireAttestation[];
  const packs = (packResult.data ?? []) as RulePackRelease[];
  const approvals = (approvalResult.data ?? []) as Approval[];
  const incidents = (incidentResult.data ?? []) as Incident[];
  const sources = (sourceResult.data ?? []) as SourceVersion[];

  const attestationCounts = new Map<string, number>();
  for (const attestation of attestations) {
    const key = attestation.release_id;
    attestationCounts.set(key, (attestationCounts.get(key) ?? 0) + 1);
  }

  const tasks: TaskItem[] = [];

  for (const release of releases) {
    const count = attestationCounts.get(release.id) ?? 0;
    const active = !["current", "superseded"].includes(release.status);
    tasks.push({
      id: `nspire:${release.id}`,
      category: "verification",
      title: active ? "Complete NSPIRE source activation" : `NSPIRE ${release.source_version}`,
      description: `${count}/2 independent attestations · ${release.imported_standard_count} standards · ${release.imported_deficiency_count} actionable rows`,
      status: release.status,
      active,
      occurredAt: release.activated_at ?? release.updated_at ?? release.created_at,
      destination: "/pha-nspire-standards",
      actionLabel: active ? "Review and attest" : "View release",
      attention: release.status === "blocked",
    });
  }

  for (const pack of packs) {
    const active = pack.status !== "validated";
    tasks.push({
      id: `rule-pack:${pack.id}`,
      category: "rule_pack",
      title: `${pack.state_code} rule pack ${pack.version}`,
      description: `${pack.validated_rule_count ?? 0} validated rules · ${active ? "review or approval remains" : "validation and approval complete"}`,
      status: pack.status,
      active,
      occurredAt: pack.approved_at ?? pack.updated_at ?? pack.created_at,
      destination: active ? "/state-rule-validation" : "/rules",
      actionLabel: active ? "Review rule pack" : "View rules",
      attention: pack.status === "suspended",
    });
  }

  for (const approval of approvals) {
    const active = approval.status === "pending";
    tasks.push({
      id: `approval:${approval.id}`,
      category: "approval",
      title: approval.action_type.replaceAll("_", " "),
      description: `Immutable snapshot ${approval.snapshot_sha256.slice(0, 16)}… · expires ${formatDate(approval.expires_at)}`,
      status: approval.status,
      active,
      occurredAt: approval.decided_at ?? approval.requested_at,
      destination: "/crm/operations",
      actionLabel: "Open operations",
      approvalId: active ? approval.id : undefined,
      approvalType: approval.action_type,
      attention: ["expired", "rejected", "revoked"].includes(approval.status),
    });
  }

  for (const source of sources) {
    const active =
      source.parsing_status !== "parsed" ||
      !["validated", "rejected"].includes(source.validation_status);
    tasks.push({
      id: `source:${source.id}`,
      category: "verification",
      title: `Validate ${source.authority} source`,
      description: `${source.program} · ${source.jurisdiction} · parsing ${source.parsing_status} · validation ${source.validation_status}`,
      status: active ? source.validation_status : "complete",
      active,
      occurredAt: source.retrieved_at,
      destination: "/crm/operations",
      actionLabel: active ? "Review source" : "View source",
      attention:
        ["failed", "quarantined"].includes(source.parsing_status) ||
        source.validation_status === "conflicting",
    });
  }

  for (const incident of incidents) {
    const active = !["resolved", "rolled_back"].includes(incident.status);
    tasks.push({
      id: `incident:${incident.id}`,
      category: "incident",
      title: incident.summary,
      description: `${incident.severity} severity · last seen ${formatDate(incident.last_seen_at)}`,
      status: incident.status,
      active,
      occurredAt: incident.resolved_at ?? incident.last_seen_at,
      destination: "/crm/operations",
      actionLabel: active ? "Resolve incident" : "View incident",
      attention: active,
    });
  }

  return tasks.sort(
    (left, right) =>
      Number(right.active) - Number(left.active) ||
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

function TaskList({ tasks }: { tasks: TaskItem[] }) {
  if (!tasks.length) {
    return (
      <div className="px-5 py-12 text-center">
        <CheckCircle2 className="mx-auto size-8 text-seal" />
        <p className="mt-3 font-medium">No outstanding tasks</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New verifications, approvals, and exceptions will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => (
        <li key={task.id} className="px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={task.attention ? "text-reject" : "text-muted-foreground"}>
                  {categoryIcon(task.category)}
                </span>
                <h3 className="font-medium capitalize">{task.title}</h3>
                <Pill tone={taskTone(task)}>{categoryLabel(task.category)}</Pill>
                <Pill tone={taskTone(task)}>{task.status.replaceAll("_", " ")}</Pill>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{task.description}</p>
              <p className="cite mt-1.5">
                {task.active ? "Opened or updated" : "Completed"} {formatDate(task.occurredAt)}
              </p>
              {task.approvalId && task.approvalType ? (
                <OperationsApprovalActions
                  approvalId={task.approvalId}
                  actionType={task.approvalType}
                />
              ) : null}
            </div>
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <Link to={task.destination}>{task.actionLabel}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TasksWorkspace() {
  const { isStaff, loading } = useIsStaff();
  const [view, setView] = useState<"active" | "history">("active");
  const query = useQuery({
    queryKey: ["governance-tasks"],
    enabled: isStaff,
    queryFn: loadTasks,
    refetchInterval: 30_000,
  });

  const allTasks = query.data ?? [];
  const activeTasks = allTasks.filter((task) => task.active);
  const history = allTasks.filter((task) => !task.active);
  const visibleTasks = view === "active" ? activeTasks : history;
  const awaitingApproval = activeTasks.filter((task) => task.category === "approval").length;
  const verifications = activeTasks.filter(
    (task) => task.category === "verification" || task.category === "rule_pack",
  ).length;
  const exceptions = activeTasks.filter((task) => task.attention).length;

  return (
    <AppShell
      title="Tasks"
      subtitle="One queue for required verifications, approvals, rule-pack controls, and operational exceptions"
    >
      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Checking task authority…
        </div>
      ) : !isStaff ? (
        <div className="rounded-lg border border-border bg-card p-8">
          <h2 className="font-display text-lg">Staff authority required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Governance tasks and approval evidence are restricted to authorized CertivoIQ staff.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active tasks" value={query.error ? "—" : activeTasks.length} hint="Cleared when the underlying control completes" tone={query.error ? "reject" : activeTasks.length ? "flag" : "seal"} />
            <Stat label="Awaiting approval" value={query.error ? "—" : awaitingApproval} hint="Separate approver controls remain enforced" />
            <Stat label="Verification required" value={query.error ? "—" : verifications} hint="Sources and rule packs" />
            <Stat label="Exceptions" value={query.error ? "—" : exceptions} hint="Blocked, conflicting, or open incidents" tone={query.error || exceptions ? "reject" : "seal"} />
          </div>

          {query.error ? (
            <div className="mt-4 rounded-lg border border-reject/30 bg-reject-soft p-4 text-sm text-reject">
              Tasks could not be loaded. No control state was changed.
            </div>
          ) : null}

          <Panel
            className="mt-4"
            title={view === "active" ? "Outstanding tasks" : "Completed history"}
            description={
              view === "active"
                ? "Items leave this queue automatically when their authoritative workflow reaches a completed state."
                : "Completed and superseded controls remain available as an audit trail."
            }
            actions={
              <div className="flex gap-2">
                <Button size="sm" variant={view === "active" ? "default" : "outline"} onClick={() => setView("active")}>
                  <Clock3 className="size-4" /> Active ({query.error ? "—" : activeTasks.length})
                </Button>
                <Button size="sm" variant={view === "history" ? "default" : "outline"} onClick={() => setView("history")}>
                  <CheckCircle2 className="size-4" /> History ({query.error ? "—" : history.length})
                </Button>
              </div>
            }
            bodyClassName="p-0"
          >
            {query.isLoading ? (
              <div className="px-5 py-10 text-sm text-muted-foreground">Loading governance tasks…</div>
            ) : query.error ? (
              <div className="px-5 py-10 text-center">
                <AlertTriangle className="mx-auto size-8 text-reject" />
                <p className="mt-3 font-medium">Task sources are unavailable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The queue has not been represented as empty. No control state was changed.
                </p>
                <Button className="mt-4" size="sm" variant="outline" onClick={() => void query.refetch()}>
                  Retry loading tasks
                </Button>
              </div>
            ) : (
              <TaskList tasks={visibleTasks} />
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}
