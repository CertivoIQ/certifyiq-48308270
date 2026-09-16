import { isInternalSegmentUser } from "@/lib/internal-segment-access";
import { useSession } from "@/hooks/use-session";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { CertificationTaskActions } from "@/components/certification-task-actions";
import { Button } from "@/components/ui/button";
import { Panel, Pill, Stat, type Tone } from "@/components/ui-kit";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — CertivoIQ" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TasksWorkspace,
});

type TaskCategory = "approval" | "verification" | "rule_pack" | "incident" | "finding" | "certification";
type TaskDestination =
  | "/pha-nspire-standards"
  | "/rules"
  | "/state-rule-validation"
  | "/crm/operations"
  | "/findings"
  | "/files";
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
  approvalId?: string | undefined;
  approvalType?: string;
  validationStateCode?: string | undefined;
  findingId?: string | undefined;
  caseId?: string | undefined;
  workflowRole?: "employee" | "manager";
  attention?: boolean;
  packCandidateId?: string | undefined;
  activationStateCode?: string | undefined;
  activationReady?: boolean;
  activationBlockedReason?: string;
};

type ActivationReadiness = {
  pack_candidate_id: string;
  state_code: string;
  pack_status: string;
  sources_ready: boolean;
  activation_recorded: boolean;
  first_reviewer_count: number;
  viewer_is_first_reviewer: boolean;
  viewer_can_activate: boolean;
  validated_on: string | null;
  activated_on: string | null;
};

type CertificationWorkflowTask = {
  id: string;
  task_type: "finding_remediation" | "certification_approval";
  title: string;
  description: string;
  status: string;
  active: boolean;
  occurred_at: string;
  destination: "/findings" | "/files";
  action_label: string;
  finding_id: string | null;
  case_id: string | null;
  workflow_role: "employee" | "manager";
  attention: boolean;
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
type RulePackCandidate = {
  id: string;
  state_code: string;
  status: string;
  source_candidate_count: number;
  blocked_source_count: number;
  compliance_activation_allowed: boolean;
  updated_at: string;
};
type RuleSourceCandidate = {
  id: string;
  state_code: string;
  authority_name: string;
  program: string;
  scope: string;
  source_type: string;
  candidate_status: string;
  agent_verification_status: string | null;
  exact_bytes_captured: boolean;
  retrieved_at: string | null;
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
  if (category === "finding") return "Finding";
  if (category === "certification") return "Certification";
  return "Incident";
}

function categoryIcon(category: TaskCategory) {
  if (category === "approval") return <ClipboardCheck className="size-4" />;
  if (category === "verification") return <FileSearch className="size-4" />;
  if (category === "rule_pack") return <ShieldCheck className="size-4" />;
  if (category === "certification") return <CheckCircle2 className="size-4" />;
  return <AlertTriangle className="size-4" />;
}

function taskTone(task: TaskItem): Tone {
  if (!task.active) return "seal";
  if (task.attention) return "reject";
  return "flag";
}

export type SummaryFilter = "all" | "approval" | "verification" | "exceptions";

// Verification-required work is every active verification or rule-pack row, not only
// rows that carry a pack candidate. Selection is for review organisation; activation
// eligibility is decided separately by authoritative backend readiness.
export function isSelectableTask(task: TaskItem) {
  return task.active && (task.category === "verification" || task.category === "rule_pack");
}

export function summaryLabel(filter: SummaryFilter) {
  if (filter === "approval") return "approval and certification work";
  if (filter === "verification") return "verification-required work";
  if (filter === "exceptions") return "exceptions";
  return "all active tasks";
}

export function matchesSummaryFilter(task: TaskItem, filter: SummaryFilter) {
  if (filter === "all") return true;
  if (filter === "approval") return task.category === "approval" || task.category === "certification";
  if (filter === "verification") return task.category === "verification" || task.category === "rule_pack";
  return task.attention === true;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

type TaskSourceError = { code?: string; message?: string } | null;

function isMissingRelationError(error: TaskSourceError) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|table .* schema cache/i.test(error.message ?? "")
  );
}

async function loadTasks(includeGovernanceTasks: boolean, includeInternalTasks: boolean): Promise<TaskItem[]> {
  // Generated Supabase types lag the controlled governance tables until schema types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: workflowData, error: workflowError } = await client.rpc("certification_task_queue");
  if (workflowError) throw workflowError;

  const workflowTasks: TaskItem[] = ((workflowData ?? []) as CertificationWorkflowTask[]).map((task) => ({
    id: task.id,
    category: task.task_type === "finding_remediation" ? "finding" : "certification",
    title: task.title,
    description: task.description,
    status: task.status,
    active: task.active,
    occurredAt: task.occurred_at,
    destination: task.destination,
    actionLabel: task.action_label,
    findingId: task.finding_id ?? undefined,
    caseId: task.case_id ?? undefined,
    workflowRole: task.workflow_role,
    attention: task.attention,
  }));

  if (!includeGovernanceTasks) {
    return workflowTasks.sort(
      (left, right) =>
        Number(right.active) - Number(left.active) ||
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }

  const [
    releaseResult,
    attestationResult,
    packResult,
    packCandidateResult,
    sourceCandidateResult,
    approvalResult,
    incidentResult,
    sourceResult,
  ] = await Promise.all([
      includeInternalTasks ? client
        .from("pha_nspire_standard_releases")
        .select("id,source_version,status,imported_standard_count,imported_deficiency_count,created_at,updated_at,activated_at")
        .order("created_at", { ascending: false })
        .limit(50) : Promise.resolve({ data: [], error: null }),
      includeInternalTasks ? client
        .from("pha_nspire_release_attestations")
        .select("release_id,verifier_id") : Promise.resolve({ data: [], error: null }),
      client
        .from("state_rule_pack_releases")
        .select("id,state_code,version,status,validated_rule_count,approved_at,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100),
      client
        .from("state_rule_pack_candidates")
        .select("id,state_code,status,source_candidate_count,blocked_source_count,compliance_activation_allowed,updated_at")
        .neq("state_code", "US")
        .order("state_code", { ascending: true })
        .limit(100),
      client
        .from("state_rule_source_candidates")
        .select("id,state_code,authority_name,program,scope,source_type,candidate_status,agent_verification_status,exact_bytes_captured,retrieved_at,updated_at")
        .neq("candidate_status", "EXCLUDED_REDUNDANT_SOURCE")
        .order("state_code", { ascending: true })
        .limit(250),
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

  const nspireResults = [releaseResult, attestationResult];
  const requiredResults = [
    packResult,
    packCandidateResult,
    sourceCandidateResult,
    approvalResult,
    incidentResult,
    sourceResult,
  ];
  const failed = [...requiredResults, ...nspireResults].find(
    (result) => result.error && !isMissingRelationError(result.error),
  );
  if (failed?.error) throw failed.error;

  // Some deployments do not include the optional PHA module yet. Keep that gap visible
  // as an active exception instead of failing the entire governance queue or treating
  // the unavailable source as complete.
  const nspireSourceUnavailable = nspireResults.some((result) =>
    isMissingRelationError(result.error),
  );
  const releases = (nspireSourceUnavailable ? [] : releaseResult.data ?? []) as NspireRelease[];
  const attestations = (nspireSourceUnavailable ? [] : attestationResult.data ?? []) as NspireAttestation[];
  const packs = (packResult.data ?? []) as RulePackRelease[];
  const packCandidates = (packCandidateResult.data ?? []) as RulePackCandidate[];
  const sourceCandidates = (sourceCandidateResult.data ?? []) as RuleSourceCandidate[];
  const approvals = (approvalResult.data ?? []) as Approval[];
  const incidents = (incidentResult.data ?? []) as Incident[];
  const sources = (sourceResult.data ?? []) as SourceVersion[];

  // Authoritative activation eligibility. The cached compliance_activation_allowed
  // flag on the candidate row is never used on its own to decide what the user sees.
  const readinessByPack = new Map<string, ActivationReadiness>();
  const readinessResult = await client.rpc("state_rule_pack_activation_readiness");
  if (readinessResult.error && !isMissingRelationError(readinessResult.error)) {
    throw readinessResult.error;
  }
  for (const row of (readinessResult.data ?? []) as ActivationReadiness[]) {
    readinessByPack.set(row.pack_candidate_id, row);
  }

  const attestationCounts = new Map<string, number>();
  for (const attestation of attestations) {
    const key = attestation.release_id;
    attestationCounts.set(key, (attestationCounts.get(key) ?? 0) + 1);
  }

  const tasks: TaskItem[] = [...workflowTasks];

  if (nspireSourceUnavailable) {
    tasks.push({
      id: "source-unavailable:pha-nspire",
      category: "incident",
      title: "Restore NSPIRE task source",
      description:
        "The optional PHA schema is not deployed. NSPIRE controls remain unavailable and are not represented as complete.",
      status: "source_unavailable",
      active: true,
      occurredAt: new Date().toISOString(),
      destination: "/pha-nspire-standards",
      actionLabel: "Open NSPIRE controls",
      attention: true,
    });
  }

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

  for (const candidate of packCandidates) {
    const readiness = readinessByPack.get(candidate.id);
    const awaitingActivation = candidate.status === "awaiting_second_verification";
    const activationRecorded = readiness
      ? readiness.activation_recorded
      : candidate.compliance_activation_allowed;
    const active = !activationRecorded;
    const activationReady = Boolean(
      readiness &&
        readiness.sources_ready &&
        readiness.viewer_can_activate &&
        !readiness.activation_recorded,
    );
    const blockedReason = !readiness
      ? "Activation readiness is unavailable for this pack."
      : readiness.activation_recorded
        ? "This state pack is already activated."
        : !readiness.sources_ready
          ? "Every required state and shared federal source must complete verification first."
          : !readiness.viewer_can_activate
            ? readiness.viewer_is_first_reviewer
              ? "A different Administrator must activate a pack you first reviewed — independent Administrator activation required."
              : "Your account is not authorized to activate this state pack."
            : "";
    tasks.push({
      id: `rule-pack-candidate:${candidate.id}`,
      category: "rule_pack",
      title: activationReady
        ? `Activate ${candidate.state_code} state rule pack`
        : `${candidate.state_code} state rule-pack validation`,
      description: activationReady
        ? `${candidate.source_candidate_count} verified source records · ready for authorized activation`
        : `${candidate.source_candidate_count} candidate sources · ${candidate.blocked_source_count} blocked · ${
            awaitingActivation
              ? "independent Administrator activation required"
              : active
                ? blockedReason || "first verification required"
                : "dual-control activation satisfied"
          }`,
      status: candidate.status,
      active,
      occurredAt: candidate.updated_at,
      destination: active ? "/state-rule-validation" : "/rules",
      actionLabel: activationReady
        ? "Activate state pack"
        : active
          ? "Validate sources"
          : "View rules",
      validationStateCode: active ? candidate.state_code : undefined,
      packCandidateId: candidate.id,
      activationStateCode: candidate.state_code,
      activationReady,
      activationBlockedReason: blockedReason,
      attention: candidate.blocked_source_count > 0,
    });
  }

  for (const candidate of sourceCandidates) {
    const status = candidate.agent_verification_status ?? candidate.candidate_status;

    // Verified source evidence remains available in State Rule Validation history,
    // but it is no longer outstanding governance work and must leave Tasks entirely.
    if (status === "verified") continue;

    tasks.push({
      id: `rule-source-candidate:${candidate.id}`,
      category: "verification",
      title: `Verify ${candidate.state_code} · ${candidate.authority_name}`,
      description: `${candidate.program} · ${candidate.scope} · ${candidate.source_type} · exact bytes ${candidate.exact_bytes_captured ? "captured" : "required"}`,
      status,
      active: true,
      occurredAt: candidate.updated_at ?? candidate.retrieved_at ?? new Date().toISOString(),
      destination: "/state-rule-validation",
      actionLabel: "Verify source",
      validationStateCode: candidate.state_code,
      attention:
        ["blocked", "failed", "conflicting"].includes(candidate.candidate_status) ||
        ["rejected", "conflicting"].includes(candidate.agent_verification_status ?? ""),
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
      validationStateCode: active ? pack.state_code : undefined,
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

export function TaskList({
  tasks,
  onCompleted,
  selectedIds,
  onToggleSelect,
  onActivate,
  activationBusy,
}: {
  tasks: TaskItem[];
  onCompleted: () => void;
  selectedIds: string[];
  onToggleSelect: (task: TaskItem) => void;
  onActivate: (tasks: TaskItem[]) => void;
  activationBusy: boolean;
}) {
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
      {tasks.map((task) => {
        const selectable = isSelectableTask(task);
        const selected = selectedIds.includes(task.id);
        const bodyClick = selectable
          ? (event: React.MouseEvent<HTMLDivElement>) => {
              const target = event.target as HTMLElement;
              if (target.closest("a,button,input,textarea,label,[role='checkbox']")) return;
              onToggleSelect(task);
            }
          : undefined;

        return (
          <li key={task.id} className="px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {selectable ? (
                  <Checkbox
                    id={`select-${task.id}`}
                    className="mt-1 shrink-0"
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(task)}
                    aria-label={
                      task.packCandidateId
                        ? `Select ${task.activationStateCode ?? ""} state rule pack`
                        : `Select verification task ${task.title}`
                    }
                  />
                ) : null}
                <div className="min-w-0" onClick={bodyClick}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={task.attention ? "text-reject" : "text-muted-foreground"}>
                      {categoryIcon(task.category)}
                    </span>
                    <h3 className="font-medium capitalize">
                      {selectable ? (
                        <label htmlFor={`select-${task.id}`} className="cursor-pointer">
                          {task.title}
                        </label>
                      ) : (
                        task.title
                      )}
                    </h3>
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
                  {task.findingId || task.caseId ? (
                    <CertificationTaskActions
                      findingId={task.findingId}
                      caseId={task.caseId}
                      active={task.active}
                      onCompleted={onCompleted}
                    />
                  ) : null}
                </div>
              </div>
              {task.active && (task.findingId || task.caseId) ? null : task.activationReady ? (
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={activationBusy}
                  onClick={() => onActivate([task])}
                >
                  Activate {task.activationStateCode} state pack
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild className="shrink-0">
                  {task.validationStateCode ? (
                    <Link
                      to="/state-rule-validation"
                      search={{
                        state: task.validationStateCode,
                        // Outstanding verification work lands on the unresolved requirements,
                        // never on a stale "active" filter that can render empty.
                        status: isSelectableTask(task) ? "unresolved" : "active",
                      }}
                    >
                      {task.actionLabel}
                    </Link>
                  ) : (
                    <Link to={task.destination}>{task.actionLabel}</Link>
                  )}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TasksWorkspace() {
  const { user } = useSession();
  const { isStaff, loading } = useIsStaff();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"active" | "history">("active");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingActivation, setPendingActivation] = useState<TaskItem[] | null>(null);
  const query = useQuery({
    queryKey: ["role-aware-tasks", user?.id, isStaff, isInternalSegmentUser(user)],
    enabled: !loading,
    queryFn: () => loadTasks(isStaff, isInternalSegmentUser(user)),
    refetchInterval: 30_000,
  });

  const queryData = query.data;
  const allTasks = useMemo(() => queryData ?? [], [queryData]);
  const activeTasks = allTasks.filter((task) => task.active);
  const history = allTasks.filter((task) => !task.active);
  const visibleTasks =
    view === "active" ? activeTasks.filter((task) => matchesSummaryFilter(task, summaryFilter)) : history;
  const awaitingApproval = activeTasks.filter((task) => matchesSummaryFilter(task, "approval")).length;
  const verifications = activeTasks.filter((task) => matchesSummaryFilter(task, "verification")).length;
  const exceptions = activeTasks.filter((task) => matchesSummaryFilter(task, "exceptions")).length;

  const openSummary = (filter: SummaryFilter) => {
    setView("active");
    setSummaryFilter(filter);
  };
  const openHistory = () => {
    setView("history");
    setSummaryFilter("all");
  };

  const summaryCards: { label: string; filter: SummaryFilter; value: number; hint: string; tone?: Tone }[] = [
    {
      label: "Active tasks",
      filter: "all",
      value: activeTasks.length,
      hint: "Cleared when the underlying control completes",
      tone: query.error ? "reject" : activeTasks.length ? "flag" : "seal",
    },
    {
      label: "Awaiting approval",
      filter: "approval",
      value: awaitingApproval,
      hint: "Separate approver controls remain enforced",
    },
    {
      label: "Verification required",
      filter: "verification",
      value: verifications,
      hint: "Sources and rule packs",
    },
    {
      label: "Exceptions",
      filter: "exceptions",
      value: exceptions,
      hint: "Blocked, conflicting, or open incidents",
      tone: query.error || exceptions ? "reject" : "seal",
    },
  ];

  const selectedTasks = useMemo(
    () => allTasks.filter((task) => selectedIds.includes(task.id)),
    [allTasks, selectedIds],
  );
  // Only rows carrying a pack candidate can ever reach the activation RPC.
  const selectedPacks = useMemo(
    () => selectedTasks.filter((task) => task.packCandidateId),
    [selectedTasks],
  );
  const selectedReady = selectedPacks.filter((task) => task.activationReady === true);
  const selectedNotReady = selectedPacks.filter((task) => task.activationReady !== true);
  const selectedVerificationCount = selectedTasks.filter(isSelectableTask).length;

  const toggleSelect = (task: TaskItem) => {
    setSelectedIds((current) =>
      current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id],
    );
  };

  const activation = useMutation({
    mutationFn: async (packs: TaskItem[]) => {
      // Generated database types intentionally lag controlled launch migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const results: { state: string; ok: boolean; message?: string }[] = [];
      for (const pack of packs) {
        const state = pack.activationStateCode ?? "state";
        try {
          const { error } = await client.rpc("activate_state_rule_pack", {
            p_pack_candidate_id: pack.packCandidateId,
            p_notes:
              "Authorized state-pack activation confirmed by the responsible Administrator in the CertivoIQ Tasks workspace.",
          });
          if (error) throw error;
          results.push({ state, ok: true });
        } catch (error) {
          results.push({
            state,
            ok: false,
            message:
              error instanceof Error && error.message
                ? error.message
                : "Activation was refused by the authorization controls.",
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      for (const result of results) {
        if (result.ok) toast.success(`${result.state} state pack activated`);
        else toast.error(`${result.state} was not activated`, { description: result.message });
      }
      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !results.some(
              (result) =>
                result.ok &&
                allTasks.some((task) => task.id === id && task.activationStateCode === result.state),
            ),
        ),
      );
    },
    onError: () => {
      toast.error("Activation could not be completed. No control state was changed.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["role-aware-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["governance-tasks"] });
    },
  });

  const requestActivation = (packs: TaskItem[]) => {
    // Ordinary verification selections can never reach activation: a row must carry a
    // pack candidate and authoritative readiness.
    const ready = packs.filter((pack) => Boolean(pack.packCandidateId) && pack.activationReady === true);
    if (!ready.length) return;
    setPendingActivation(ready);
  };


  return (
    <AppShell
      title="Tasks"
      subtitle="Role-aware work for finding remediation, certification approval, governance controls, and audit filing"
    >
      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Checking task authority…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <button
                key={card.label}
                type="button"
                aria-label={`View ${card.label.toLowerCase()}`}
                aria-pressed={view === "active" && summaryFilter === card.filter}
                aria-controls="task-records"
                disabled={query.isLoading || !!query.error}
                onClick={() => openSummary(card.filter)}
                className="min-w-0 rounded-lg text-left transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 [&>div]:h-full aria-pressed:ring-2 aria-pressed:ring-primary"
              >
                <Stat
                  label={card.label}
                  value={query.error ? "—" : card.value}
                  hint={card.hint}
                  {...(card.tone ? { tone: card.tone } : {})}
                />
              </button>
            ))}
          </div>

          {query.error ? (
            <div className="mt-4 rounded-lg border border-reject/30 bg-reject-soft p-4 text-sm text-reject">
              Tasks could not be loaded. No control state was changed.
            </div>
          ) : null}

          <div id="task-records">
          <Panel
            className="mt-4"
            title={view === "active" ? "Outstanding tasks" : "Completed history"}
            description={
              view === "active"
                ? summaryFilter === "all"
                  ? "Items leave this queue automatically when their authoritative workflow reaches a completed state."
                  : `Filtered to ${summaryLabel(summaryFilter)}. Select the summary card again or Active to clear the filter.`
                : "Completed and superseded controls remain available as an audit trail."
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!selectedReady.length || activation.isPending}
                  aria-disabled={!selectedReady.length || activation.isPending}
                  title={
                    selectedReady.length
                      ? undefined
                      : "Select at least one state pack that backend readiness confirms you can activate."
                  }
                  onClick={() => requestActivation(selectedPacks)}
                >
                  <ShieldCheck className="size-4" /> Activate selected state packs
                  {selectedPacks.length
                    ? ` (${selectedReady.length} ready${selectedNotReady.length ? `, ${selectedNotReady.length} not ready` : ""})`
                    : ""}
                </Button>
                {selectedIds.length ? (
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
                    Clear selection
                  </Button>
                ) : null}
                <Button size="sm" variant={view === "active" ? "default" : "outline"} onClick={() => openSummary("all")}>
                  <Clock3 className="size-4" /> Active ({query.error ? "—" : activeTasks.length})
                </Button>
                <Button size="sm" variant={view === "history" ? "default" : "outline"} onClick={openHistory}>
                  <CheckCircle2 className="size-4" /> History ({query.error ? "—" : history.length})
                </Button>
              </div>
            }
            bodyClassName="p-0"
          >
            {selectedIds.length ? (
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-sm"
                role="status"
                aria-label="Task selection summary"
              >
                <span className="font-medium">{selectedVerificationCount} verification-required selected</span>
                <span className="text-muted-foreground">{selectedPacks.length} state packs selected</span>
                <span className="text-muted-foreground">{selectedReady.length} activation-ready</span>
                {selectedPacks.length && !selectedReady.length ? (
                  <span className="text-muted-foreground">
                    None of the selected state packs are activation-ready — complete source verification and
                    independent Administrator separation first.
                  </span>
                ) : null}
              </div>
            ) : null}
            {query.isLoading ? (
              <div className="px-5 py-10 text-sm text-muted-foreground">Loading role-aware tasks…</div>
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
              <TaskList
                tasks={visibleTasks}
                onCompleted={() => void query.refetch()}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onActivate={requestActivation}
                activationBusy={activation.isPending}
              />
            )}
          </Panel>
          </div>

          <AlertDialog
            open={Boolean(pendingActivation)}
            onOpenChange={(open) => {
              if (!open) setPendingActivation(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Activate {pendingActivation?.length ?? 0} state rule pack
                  {(pendingActivation?.length ?? 0) === 1 ? "" : "s"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This records an authorized activation for{" "}
                  {(pendingActivation ?? []).map((pack) => pack.activationStateCode).join(", ")}. The
                  database re-checks every readiness and reviewer-separation rule before any pack becomes
                  active.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const packs = pendingActivation ?? [];
                    setPendingActivation(null);
                    if (packs.length) activation.mutate(packs);
                  }}
                >
                  Confirm activation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </AppShell>
  );
}
