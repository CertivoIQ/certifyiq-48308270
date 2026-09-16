import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { StateSourceImportPanel } from "@/components/state-source-import-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill, Stat, type Tone } from "@/components/ui-kit";
import { useCrmStaffAuthority } from "@/hooks/use-crm-staff-authority";
import { supabase } from "@/integrations/supabase/client";

const VALIDATION_STATUSES = new Set([
  "active",
  "unresolved",
  "queued_for_agent_verification",
  "captured_unvalidated",
  "verified",
  "blocked",
  "rejected",
  "blocked_or_rejected",
  "all",
]);

export const Route = createFileRoute("/_authenticated/state-rule-validation")({
  validateSearch: (search: Record<string, unknown>) => {
    const requestedState = typeof search['state'] === "string" ? search['state'].toUpperCase() : "";
    const requestedStatus = typeof search['status'] === "string" ? search['status'] : "";
    return {
      state: /^(?:[A-Z]{2}|ALL)$/.test(requestedState) ? requestedState : undefined,
      status: VALIDATION_STATUSES.has(requestedStatus) ? requestedStatus : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "State & Federal Rule Validation — CertivoIQ" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StateRuleValidationWorkspace,
});

type Pack = {
  id: string;
  state_code: string;
  status: string;
  source_candidate_count: number;
  blocked_source_count: number;
  compliance_activation_allowed: boolean;
  validated_on: string | null;
  updated_at: string;
};

type ActivationReadiness = {
  pack_candidate_id: string;
  state_code: string;
  inventory_generated_at: string;
  pack_status: string;
  sources_ready: boolean;
  activation_recorded: boolean;
  first_reviewer_count: number;
  viewer_is_first_reviewer: boolean;
  viewer_can_activate: boolean;
  validated_on: string | null;
  activated_on: string | null;
};

type SourceCandidate = {
  id: string;
  state_code: string;
  scope: string;
  authority_name: string;
  official_domain: string;
  program: string;
  source_type: string;
  source_url: string;
  candidate_status: string;
  agent_verification_status: string;
  exact_bytes_captured: boolean;
  compliance_activation_allowed: boolean;
  source_sha256: string | null;
  retrieved_at: string | null;
  verification_evidence: Record<string, unknown>;
  updated_at: string;
};

type Draft = {
  sha256: string;
  retrievedAt: string;
  notes: string;
  effectiveDate: string;
  supersessionNotes: string;
};

const EMPTY_DRAFT: Draft = {
  sha256: "",
  retrievedAt: "",
  notes: "",
  effectiveDate: "",
  supersessionNotes: "",
};

type NewSourceDraft = {
  stateCode: string;
  scope: string;
  authorityName: string;
  officialDomain: string;
  program: string;
  sourceType: string;
  sourceUrl: string;
  candidateStatus: string;
};

const EMPTY_NEW_SOURCE: NewSourceDraft = {
  stateCode: "",
  scope: "STATEWIDE",
  authorityName: "",
  officialDomain: "",
  program: "LIHTC",
  sourceType: "",
  sourceUrl: "",
  candidateStatus: "PENDING_EXACT_BYTES_AND_HASHES",
};

function normalizeIdentifier(value: string) {
  return value
    .toUpperCase()
    .trimStart()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}

function officialDomainFor(sourceUrl: string) {
  try {
    return new URL(sourceUrl.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function officialSourcePageFor(source: SourceCandidate) {
  if (
    source.official_domain === "ahfa.atl1.cdn.digitaloceanspaces.com" &&
    source.source_url.includes("/multifamily/compliance/")
  ) {
    return "https://www.ahfa.com/programs/rental-housing/compliance";
  }
  return source.source_url;
}

function messageForError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function toneFor(status: string): Tone {
  if (status === "verified" || status === "active") return "seal";
  if (status === "blocked" || status === "rejected") return "reject";
  return "flag";
}

function labelFor(status: string) {
  return status.replaceAll("_", " ");
}

const SOURCE_COLUMNS =
  "id,state_code,scope,authority_name,official_domain,program,source_type,source_url,candidate_status,agent_verification_status,exact_bytes_captured,compliance_activation_allowed,source_sha256,retrieved_at,verification_evidence,updated_at";
export const SOURCE_PAGE_SIZE = 1000;

export function isRejectedSource(source: SourceCandidate) {
  return (
    source.agent_verification_status === "rejected" &&
    source.candidate_status !== "EXCLUDED_REDUNDANT_SOURCE"
  );
}

export function isUnresolvedSource(source: SourceCandidate) {
  if (source.agent_verification_status === "rejected") return false;
  if (source.agent_verification_status !== "verified") return true;
  return !source.exact_bytes_captured || !source.source_sha256 || !source.retrieved_at;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadAllSourceCandidates(client: any) {
  const rows: SourceCandidate[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * SOURCE_PAGE_SIZE;
    const { data, error } = await client
      .from("state_rule_source_candidates")
      .select(SOURCE_COLUMNS)
      .order("state_code")
      .order("authority_name")
      .range(from, from + SOURCE_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as SourceCandidate[];
    rows.push(...batch);
    if (batch.length < SOURCE_PAGE_SIZE) return rows;
  }
}

async function loadValidationQueue() {
  // Generated database types intentionally lag controlled launch migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const [packResult, sources, activationResult] = await Promise.all([
    client
      .from("state_rule_pack_candidates")
      .select("id,state_code,status,source_candidate_count,blocked_source_count,compliance_activation_allowed,validated_on,updated_at")
      .order("state_code"),
    loadAllSourceCandidates(client),
    client.rpc("state_rule_pack_activation_readiness"),
  ]);
  if (packResult.error) throw packResult.error;
  if (activationResult.error) throw activationResult.error;
  return {
    packs: (packResult.data ?? []) as Pack[],
    sources,
    activations: (activationResult.data ?? []) as ActivationReadiness[],
  };
}

function SourceReviewCard({
  source,
  draft,
  onDraft,
  onDecision,
  activation,
  onActivate,
  onResolvePack,
  activationBusy,
  busy,
  inheritedByState,
}: {
  source: SourceCandidate;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onDecision: (decision: "captured_unvalidated" | "verified" | "blocked" | "rejected") => void;
  activation?: ActivationReadiness | undefined;
  onActivate: (pack: ActivationReadiness) => void;
  onResolvePack: (pack: ActivationReadiness) => void;
  activationBusy: boolean;
  busy: boolean;
  inheritedByState?: string | undefined;
}) {
  const excludedRedundant =
    source.agent_verification_status === "rejected" &&
    source.candidate_status === "EXCLUDED_REDUNDANT_SOURCE";
  const requiresReplacement =
    !excludedRedundant && ["blocked", "rejected"].includes(source.agent_verification_status);
  return (
    <Panel bodyClassName="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{source.state_code === "US" ? "FEDERAL" : source.state_code}</span>
            <Pill tone={excludedRedundant ? "seal" : toneFor(source.agent_verification_status)}>
              {excludedRedundant ? "Excluded redundant source" : labelFor(source.agent_verification_status)}
            </Pill>
            <Pill>{source.program}</Pill>
            <Pill>{source.scope.replaceAll("_", " ")}</Pill>
          </div>
          <h2 className="mt-2 font-display text-lg">{source.authority_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {source.source_type.replaceAll("_", " ")} · {source.official_domain}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              className="inline-flex items-center gap-1.5 break-all text-sm text-primary underline underline-offset-4"
              href={officialSourcePageFor(source)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Open official source <ExternalLink className="size-3.5 shrink-0" />
            </a>
            {officialSourcePageFor(source) !== source.source_url ? (
              <a
                className="inline-flex items-center gap-1.5 break-all text-sm text-primary underline underline-offset-4"
                href={source.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Download exact file <ExternalLink className="size-3.5 shrink-0" />
              </a>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Intake condition: {source.candidate_status.replaceAll("_", " ")}
          </p>
          {source.scope === "FEDERAL_SHARED" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              One controlled federal source shared by all 50 state rule packs
              {inheritedByState ? `; inherited by ${inheritedByState}.` : "."}
            </p>
          ) : null}
          {requiresReplacement ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-reject">
              <AlertTriangle className="size-4" /> This source blocks pack completion until resolved.
            </p>
          ) : null}
        </div>
        <div className="w-full xl:max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`hash-${source.id}`}>Exact-file SHA-256</Label>
              <Input
                id={`hash-${source.id}`}
                className="font-mono text-xs"
                value={draft.sha256}
                maxLength={64}
                placeholder="64 lowercase hexadecimal characters"
                onChange={(event) => onDraft({ ...draft, sha256: event.target.value.toLowerCase().trim() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`retrieved-${source.id}`}>Retrieved at</Label>
              <Input
                id={`retrieved-${source.id}`}
                type="datetime-local"
                value={draft.retrievedAt}
                onChange={(event) => onDraft({ ...draft, retrievedAt: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`effective-${source.id}`}>Effective date, if confirmed</Label>
              <Input
                id={`effective-${source.id}`}
                type="date"
                value={draft.effectiveDate}
                onChange={(event) => onDraft({ ...draft, effectiveDate: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`supersession-${source.id}`}>Supersession review</Label>
              <Input
                id={`supersession-${source.id}`}
                value={draft.supersessionNotes}
                maxLength={1000}
                placeholder="Current version, supersedes…, or no supersession found"
                onChange={(event) => onDraft({ ...draft, supersessionNotes: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`notes-${source.id}`}>Review notes</Label>
              <Textarea
                id={`notes-${source.id}`}
                rows={3}
                maxLength={4000}
                value={draft['notes']}
                placeholder="Record what was checked and why this decision is supportable. Minimum 10 characters."
                onChange={(event) => onDraft({ ...draft, notes: event.target.value })}
              />
              {source.agent_verification_status === "verified" && activation ? (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {activation.activation_recorded ? (
                    <Pill tone="seal">State pack active</Pill>
                  ) : !activation.sources_ready ? (
                    <Button type="button" variant="outline" onClick={() => onResolvePack(activation)}>
                      <FileSearch className="size-4" />
                      {`Validate ${activation.state_code} state pack`}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={!activation.viewer_can_activate || activationBusy}
                      onClick={() => onActivate(activation)}
                    >
                      <ShieldCheck className="size-4" />
                      {activationBusy ? "Activating…" : `Activate ${activation.state_code} state pack`}
                    </Button>
                  )}
                  {!activation.activation_recorded && !activation.sources_ready ? (
                    <p className="text-xs text-muted-foreground">
                      Activation stays closed until every required state source and the inherited federal baseline are verified.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {source.agent_verification_status === "verified" ? (
            <div className="mt-4 rounded-md border border-seal/30 bg-seal-soft p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-seal">
                <CheckCircle2 className="size-4" /> Source validation complete
              </p>
              <p className="mt-1 text-muted-foreground">
                This source no longer requires validation. State-pack activation is a separate action.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecision("captured_unvalidated")}>Save capture</Button>
                <Button size="sm" disabled={busy} onClick={() => onDecision("verified")}><CheckCircle2 className="size-4" /> Verify source</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecision("blocked")}>Mark blocked</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => onDecision("rejected")}>Reject source</Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Every decision is appended to the audit history.</p>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function StateRuleValidationWorkspace() {
  const { canManageStaff, isCrmAdmin, loading } = useCrmStaffAuthority();
  const routeSearch = Route.useSearch();
  const queryClient = useQueryClient();
  const [stateCode, setStateCode] = useState(() => routeSearch.state ?? "ALL");
  const [status, setStatus] = useState(() => routeSearch.status ?? "active");
  const [search, setSearch] = useState("");
  const [packView, setPackView] = useState<"all" | "readiness" | "active" | null>(null);
  const [showPendingOverview, setShowPendingOverview] = useState(true);
  const [showRejectedQueue, setShowRejectedQueue] = useState(false);
  const [rejectedSelection, setRejectedSelection] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const recordsRef = useRef<HTMLDivElement>(null);
  const focusRecords = () => requestAnimationFrame(() => {
    recordsRef.current?.scrollIntoView({ block: "start" });
    recordsRef.current?.focus({ preventScroll: true });
  });
  const openSources = (nextStatus: string, nextState = "ALL") => {
    setPackView(null);
    setShowPendingOverview(false);
    setShowRejectedQueue(false);
    setStateCode(nextState);
    setStatus(nextStatus);
    setSearch("");
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `${window.location.pathname}?state=${nextState}&status=${nextStatus}`);
    }
    focusRecords();
  };
  const openPacks = (view: "all" | "readiness" | "active") => {
    setPackView(view);
    setShowRejectedQueue(false);
    setSearch("");
    focusRecords();
  };
  const openRejectedQueue = () => {
    setPackView(null);
    setShowPendingOverview(false);
    setShowRejectedQueue(true);
    setSearch("");
    focusRecords();
  };
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [showNewSource, setShowNewSource] = useState(false);
  const [newSource, setNewSource] = useState<NewSourceDraft>(EMPTY_NEW_SOURCE);

  const query = useQuery({
    queryKey: ["state-rule-validation-queue"],
    enabled: canManageStaff,
    queryFn: loadValidationQueue,
    refetchInterval: 30_000,
  });

  const review = useMutation({
    mutationFn: async ({ source, decision }: { source: SourceCandidate; decision: string }) => {
      const draft = drafts[source.id] ?? EMPTY_DRAFT;
      if (["blocked", "rejected"].includes(decision)) {
        const confirmed = window.confirm(`${decision === "rejected" ? "Reject" : "Block"} this official-source candidate? The state pack will remain fail-closed.`);
        if (!confirmed) throw new Error("Decision cancelled");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.rpc("review_state_rule_source_candidate", {
        p_candidate_id: source.id,
        p_decision: decision,
        p_source_sha256: draft.sha256 || null,
        p_retrieved_at: draft.retrievedAt ? new Date(draft.retrievedAt).toISOString() : null,
        p_notes: draft['notes'],
        p_effective_date: draft.effectiveDate || null,
        p_supersession_notes: draft.supersessionNotes || null,
      });
      if (error) throw error;
      return data as { source_status: string; pack_status: string; compliance_activation_allowed: boolean; validated_on: string | null };
    },
    onSuccess: (result, variables) => {
      toast.success(`${variables.source.state_code} source ${labelFor(result.source_status)}`);
      queryClient.setQueryData(
        ["state-rule-validation-queue"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (current: any) => {
          if (!current?.sources) return current;
          return {
            ...current,
            sources: current.sources.map((source: SourceCandidate) =>
              source.id === variables.source.id
                ? { ...source, agent_verification_status: result.source_status }
                : source,
            ),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Decision cancelled") return;
      toast.error(messageForError(error, "Source review could not be recorded"));
    },
  });

  const rejectedWorkflow = useMutation({
    mutationFn: async ({ action, items, reason }: { action: "return" | "finalize"; items: SourceCandidate[]; reason: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const results: { id: string; label: string; ok: boolean; message?: string }[] = [];
      for (const source of items) {
        const label = `${source.state_code} · ${source.authority_name}`;
        const { error } =
          action === "return"
            ? await client.rpc("return_state_rule_source_to_validation", {
                p_candidate_id: source.id,
                p_notes: reason,
                p_expected_updated_at: source.updated_at,
              })
            : await client.rpc("finalize_state_rule_source_rejection", {
                p_candidate_id: source.id,
                p_reason: reason,
                p_expected_updated_at: source.updated_at,
              });
        results.push({ id: source.id, label, ok: !error, ...(error ? { message: error.message } : {}) });
      }
      return { action, results };
    },
    onSuccess: ({ action, results }) => {
      const succeeded = results.filter((result) => result.ok);
      const failed = results.filter((result) => !result.ok);
      if (succeeded.length) {
        toast.success(action === "return" ? `${succeeded.length} source record${succeeded.length === 1 ? "" : "s"} returned to pending validation` : `${succeeded.length} rejected source record${succeeded.length === 1 ? "" : "s"} permanently deleted`);
      }
      failed.forEach((result) => toast.error(`${result.label}: ${result.message ?? "The action could not be completed."}`));
      setRejectedSelection((current) => current.filter((id) => failed.some((result) => result.id === id)));
      if (succeeded.length && !failed.length) setRejectionReason("");
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
    onError: (error) => toast.error(messageForError(error, "The rejected-source action could not be completed")),
  });

  const runRejectedAction = (action: "return" | "finalize") => {
    const items = rejectedSources.filter((source) => rejectedSelection.includes(source.id));
    const reason = rejectionReason.trim();
    if (!items.length) {
      toast.error("Select at least one rejected source record.");
      return;
    }
    if (reason.length < 10) {
      toast.error("A written reason of at least 10 characters is required.");
      return;
    }
    const names = items.map((source) => `${source.state_code} · ${source.authority_name}`).join("\n");
    const confirmed = action === "return"
      ? window.confirm(`Return ${items.length} source record${items.length === 1 ? "" : "s"} to pending validation?\n\n${names}`)
      : window.confirm(`PERMANENTLY DELETE ${items.length} rejected source record${items.length === 1 ? "" : "s"}?\n\n${names}\n\nThis is irreversible.`);
    if (!confirmed) return;
    rejectedWorkflow.mutate({ action, items, reason });
  };

  const activatePack = useMutation({
    mutationFn: async (pack: ActivationReadiness) => {
      const confirmed = window.confirm(`Activate the ${pack.state_code} state rule pack?`);
      if (!confirmed) throw new Error("Activation cancelled");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.rpc("activate_state_rule_pack", {
        p_pack_candidate_id: pack.pack_candidate_id,
        p_notes: "Authorized state-pack activation completed in the State Rule Validation workspace.",
      });
      if (error) throw error;
      return data as { state_code: string; validated_on: string; pack_status: string };
    },
    onSuccess: (result) => {
      toast.success(`${result.state_code} state pack activated`);
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["governance-tasks"] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Activation cancelled") return;
      toast.error(messageForError(error, "State pack could not be activated"));
    },
  });

  const createSource = useMutation({
    mutationFn: async (source: NewSourceDraft) => {
      if (!source.stateCode) throw new Error("Select a state");
      if (!source.authorityName.trim()) throw new Error("Enter the issuing authority");
      if (!source.sourceType.trim()) throw new Error("Enter a source type");
      if (!source.sourceUrl.trim()) throw new Error("Enter the exact official file URL");
      const officialDomain = officialDomainFor(source.sourceUrl);
      if (!officialDomain) throw new Error("Enter a valid HTTPS official file URL");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.rpc("create_state_rule_source_candidate", {
        p_state_code: source.stateCode,
        p_scope: source.scope,
        p_authority_name: source.authorityName.trim(),
        p_official_domain: officialDomain,
        p_program: source.program,
        p_source_type: source.sourceType,
        p_source_url: source.sourceUrl.trim(),
        p_candidate_status: source.candidateStatus,
      });
      if (error) throw error;
      return data as { candidate_id: string; state_code: string; source_candidate_count: number };
    },
    onSuccess: (result) => {
      toast.success(`${result.state_code} source record created`);
      setNewSource(EMPTY_NEW_SOURCE);
      setShowNewSource(false);
      setStateCode(result.state_code);
      setStatus("active");
      setPackView(null);
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
    onError: (error) => toast.error(messageForError(error, "Source record could not be created")),
  });

  const packs = query.data?.packs ?? [];
  const latestPackByState = new Map<string, Pack>();
  for (const pack of packs) {
    if (pack.state_code === "US") continue;
    const current = latestPackByState.get(pack.state_code);
    if (!current || pack.updated_at > current.updated_at) latestPackByState.set(pack.state_code, pack);
  }
  const statePacks = [...latestPackByState.values()].sort((a, b) => a.state_code.localeCompare(b.state_code));
  const currentPackIds = new Set(statePacks.map((pack) => pack.id));
  const selectedPack = latestPackByState.get(stateCode);
  const activatedPacks = statePacks.filter((pack) => pack.compliance_activation_allowed).length;
  const allActivations = query.data?.activations ?? [];
  const activations = allActivations.filter((row) => currentPackIds.has(row.pack_candidate_id));
  const activationByPackId = new Map(activations.map((row) => [row.pack_candidate_id, row]));
  const activationForState = (code: string) => {
    const pack = latestPackByState.get(code);
    return pack ? activationByPackId.get(pack.id) : undefined;
  };
  const selectedActivation = stateCode === "ALL" || stateCode === "US" ? undefined : activationForState(stateCode);
  const completedSourceActivations = activations.filter((pack) => pack.activation_recorded).length;
  const allSourceActivationsRecorded = statePacks.length > 0 && activations.length === statePacks.length && completedSourceActivations === statePacks.length;
  const pendingActivations = activations.filter((pack) => pack.sources_ready && !pack.activation_recorded);
  const sources = query.data?.sources ?? [];
  const federalSources = sources.filter((source) => source.state_code === "US" || source.scope === "FEDERAL_SHARED");
  const federalSourcesVerified = federalSources.length > 0 && federalSources.every((source) => source.agent_verification_status === "verified");
  const verified = sources.filter((source) => source.agent_verification_status === "verified").length;
  const blocked = sources.filter((source) => source.agent_verification_status === "blocked").length;
  const rejectedSources = sources.filter(isRejectedSource);
  const unresolvedSources = sources.filter(isUnresolvedSource);
  const readinessRows = statePacks.map((pack) => {
    const activation = activationByPackId.get(pack.id);
    const isActive = activation ? activation.activation_recorded : pack.compliance_activation_allowed;
    const isReady = !isActive && !!activation?.sources_ready;
    return { pack, activation, state: isActive ? ("active" as const) : isReady ? ("ready" as const) : ("unresolved" as const) };
  });
  const visiblePacks = statePacks.filter((pack) => packView !== "active" || pack.compliance_activation_allowed);
  const summaryActions = [
    { label: "State packs", value: statePacks.length, hint: "All state candidates", tone: "neutral" as Tone, selected: packView === "all", open: () => openPacks("all") },
    { label: "Agent activation", value: `${pendingActivations.length}/${statePacks.length}`, hint: "Open activation readiness", tone: "flag" as Tone, selected: packView === "readiness", open: () => openPacks("readiness") },
    { label: "Compliance active", value: activatedPacks, hint: "Validated releases", tone: "seal" as Tone, selected: packView === "active", open: () => openPacks("active") },
    { label: "Pending verifications", value: unresolvedSources.length, hint: "Unresolved records blocking readiness", tone: "flag" as Tone, selected: packView === null && status === "unresolved" && stateCode === "ALL" && !search, open: () => openSources("unresolved") },
    { label: "Verified sources", value: verified, hint: "Source review only", tone: "seal" as Tone, selected: packView === null && status === "verified" && stateCode === "ALL" && !search, open: () => openSources("verified") },
    { label: "Blocked", value: blocked, hint: "Review blocked records", tone: "reject" as Tone, selected: packView === null && !showRejectedQueue && status === "blocked" && stateCode === "ALL" && !search, open: () => openSources("blocked") },
    { label: "Rejected sources", value: rejectedSources.length, hint: "Awaiting finalization", tone: "reject" as Tone, selected: showRejectedQueue, open: openRejectedQueue },
  ];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sources.filter((source) => {
      const federalShared = source.state_code === "US" || source.scope === "FEDERAL_SHARED";
      const inheritedFederal = stateCode !== "ALL" && stateCode !== "US" && federalShared;
      if (stateCode !== "ALL" && source.state_code !== stateCode && !inheritedFederal) return false;
      const excludedRedundant = source.agent_verification_status === "rejected" && source.candidate_status === "EXCLUDED_REDUNDANT_SOURCE";
      if (status === "unresolved") {
        if (isRejectedSource(source)) return false;
        if (!isUnresolvedSource(source) && !inheritedFederal) return false;
        if (needle) return [source.state_code, source.authority_name, source.source_type, source.source_url].join(" ").toLowerCase().includes(needle);
        return true;
      }
      if (!inheritedFederal && status === "active" && source.agent_verification_status === "verified") return false;
      if (!inheritedFederal && status === "active" && excludedRedundant) return false;
      if (status !== "rejected" && status !== "blocked_or_rejected" && source.agent_verification_status === "rejected" && !excludedRedundant) return false;
      if (status === "blocked_or_rejected" && !["blocked", "rejected"].includes(source.agent_verification_status)) return false;
      if (!inheritedFederal && status !== "active" && status !== "all" && status !== "blocked_or_rejected" && source.agent_verification_status !== status) return false;
      if (!needle) return true;
      return [source.state_code, source.authority_name, source.source_type, source.source_url].join(" ").toLowerCase().includes(needle);
    });
  }, [search, sources, stateCode, status]);

  return (
    <AppShell title="State & Federal Rule Validation" subtitle="Controlled exact-source review for 50 state packs and shared federal authorities">
      {loading ? (
        <Panel bodyClassName="p-8">Checking validation authority…</Panel>
      ) : !canManageStaff ? (
        <Panel bodyClassName="p-8"><h2 className="font-display text-lg">Manager or Administrator authority required</h2></Panel>
      ) : (
        <>
          {isCrmAdmin ? <StateSourceImportPanel /> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {summaryActions.map((summary) => (
              <button
                key={summary.label}
                type="button"
                aria-label={`View ${summary.label.toLowerCase()}`}
                aria-pressed={summary.selected}
                aria-controls="validation-records"
                disabled={query.isLoading || !!query.error}
                onClick={summary.open}
                className="min-w-0 rounded-lg text-left transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 [&>div]:h-full aria-pressed:ring-2 aria-pressed:ring-primary"
              >
                <Stat label={summary.label} value={query.error || query.isLoading ? "—" : summary.value} hint={summary.hint} tone={summary.tone} />
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-flag/30 bg-flag-soft p-4 text-sm">
            <p className="flex items-start gap-2 font-medium"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> Source validation and Authorized Agent activation are required.</p>
            {selectedPack?.validated_on ? <p className="mt-2 font-medium">Validation date: {selectedPack.validated_on}</p> : null}
            {stateCode === "US" ? <p className="mt-2 text-muted-foreground">Federal source verification {federalSourcesVerified ? "complete" : "still open"}</p> : null}
          </div>

          <div id="validation-records" ref={recordsRef} tabIndex={-1} className="scroll-mt-24 focus:outline-none">
            {packView === "all" || packView === "active" ? (
              <Panel className="mt-4" title={packView === "all" ? "All state packs" : "Compliance-active state packs"} bodyClassName="p-0">
                {visiblePacks.length ? (
                  <ul className="divide-y divide-border">
                    {visiblePacks.map((pack) => (
                      <li key={pack.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{pack.state_code}</span><Pill tone={toneFor(pack.status)}>{labelFor(pack.status)}</Pill></div>
                        <Button variant="outline" size="sm" onClick={() => openSources("all", pack.state_code)}><FileSearch className="size-4" /> View source records</Button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-5 py-8 text-sm text-muted-foreground">No compliance-active state packs.</p>}
              </Panel>
            ) : null}

            {(packView === null && showPendingOverview) || packView === "readiness" ? (
              <Panel className="mt-4" title="State pack activation readiness" bodyClassName="p-0">
                <ul className="divide-y divide-border">
                  {readinessRows.map(({ pack, activation, state }) => (
                    <li key={pack.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div><span className="font-mono font-semibold">{pack.state_code}</span> <Pill tone={state === "active" ? "seal" : state === "ready" ? "flag" : "reject"}>{state === "active" ? "Active" : state === "ready" ? "Ready to activate" : "Unresolved requirements"}</Pill></div>
                      <div className="flex flex-wrap items-center gap-2">
                        {state === "unresolved" ? <Button variant="outline" size="sm" onClick={() => openSources("unresolved", pack.state_code)}><FileSearch className="size-4" /> View unresolved requirements</Button> : <Button variant="outline" size="sm" onClick={() => openSources("all", pack.state_code)}><FileSearch className="size-4" /> View source records</Button>}
                        {state === "ready" && activation?.viewer_can_activate ? <Button size="sm" onClick={() => activatePack.mutate(activation)}><ShieldCheck className="size-4" /> Activate state pack</Button> : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {allSourceActivationsRecorded ? <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">All {completedSourceActivations} current state-pack source snapshots have Authorized Agent activation records.</p> : null}
              </Panel>
            ) : null}

            {packView === null ? <>
              <Panel className="mt-4" title="Queue filters" bodyClassName="p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div><Label htmlFor="state-filter">Source jurisdiction</Label><select id="state-filter" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={stateCode} onChange={(event) => setStateCode(event.target.value)}><option value="ALL">All state and federal sources</option><option value="US">Federal shared — all 50 states</option>{statePacks.map((pack) => <option key={pack.id} value={pack.state_code}>{pack.state_code} — {labelFor(pack.status)}</option>)}</select></div>
                  <div><Label htmlFor="status-filter">Status</Label><select id="status-filter" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">All remaining</option><option value="unresolved">Unresolved requirements</option><option value="queued_for_agent_verification">Queued</option><option value="captured_unvalidated">Captured, unvalidated</option><option value="verified">Verified</option><option value="blocked">Blocked</option><option value="rejected">Rejected</option><option value="blocked_or_rejected">Blocked / rejected</option><option value="all">All history</option></select></div>
                  <div><Label htmlFor="source-search">Search</Label><Input id="source-search" value={search} placeholder="Agency, state, source type, or URL" onChange={(event) => setSearch(event.target.value)} /></div>
                </div>
              </Panel>

              {showRejectedQueue ? (
                <Panel className="mt-4" title="Rejected sources">
                  {!rejectedSources.length ? <p className="text-sm text-muted-foreground">No rejected source records are awaiting finalization.</p> : (
                    <div className="space-y-4">
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {rejectedSources.map((source) => (
                          <li key={source.id} className="flex items-start gap-3 px-4 py-3">
                            <input type="checkbox" checked={rejectedSelection.includes(source.id)} aria-label={`Select ${source.state_code} ${source.authority_name}`} onChange={(event) => setRejectedSelection((current) => event.target.checked ? [...new Set([...current, source.id])] : current.filter((id) => id !== source.id))} />
                            <div><span className="font-mono font-semibold">{source.state_code}</span> <Pill tone="reject">Rejected</Pill><p className="mt-1 text-sm">{source.authority_name}</p></div>
                          </li>
                        ))}
                      </ul>
                      <Textarea value={rejectionReason} rows={3} onChange={(event) => setRejectionReason(event.target.value)} />
                      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => runRejectedAction("return")}>Return to validations</Button><Button variant="destructive" onClick={() => runRejectedAction("finalize")}>Finalize rejection (permanent delete)</Button></div>
                    </div>
                  )}
                </Panel>
              ) : query.error ? (
                <div className="mt-4 rounded-lg border border-reject/30 bg-reject-soft p-4 text-sm text-reject">The validation queue could not be loaded.</div>
              ) : query.isLoading ? (
                <Panel className="mt-4" bodyClassName="p-10">Loading the state-source queue…</Panel>
              ) : !visible.length ? (
                <Panel className="mt-4" bodyClassName="p-10 text-center"><FileSearch className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No source candidates match these filters.</p></Panel>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">Showing {visible.length} source candidate{visible.length === 1 ? "" : "s"}.</p>
                  {visible.map((source) => {
                    const existing = source.verification_evidence ?? {};
                    const draft = drafts[source.id] ?? {
                      sha256: source.source_sha256 ?? "",
                      retrievedAt: source.retrieved_at ? source.retrieved_at.slice(0, 16) : "",
                      notes: typeof existing['notes'] === "string" ? existing['notes'] : "",
                      effectiveDate: typeof existing['effective_date'] === "string" ? existing['effective_date'] : "",
                      supersessionNotes: typeof existing['supersession_notes'] === "string" ? existing['supersession_notes'] : "",
                    };
                    const federalShared = source.state_code === "US" || source.scope === "FEDERAL_SHARED";
                    const cardActivation = federalShared ? selectedActivation : activationForState(source.state_code);
                    return <SourceReviewCard key={source.id} source={source} draft={draft} busy={review.isPending && review.variables?.source.id === source.id} activation={cardActivation} activationBusy={activatePack.isPending && activatePack.variables?.pack_candidate_id === cardActivation?.pack_candidate_id} inheritedByState={source.scope === "FEDERAL_SHARED" && stateCode !== "ALL" && stateCode !== "US" ? stateCode : undefined} onDraft={(next) => setDrafts((current) => ({ ...current, [source.id]: next }))} onDecision={(decision) => review.mutate({ source, decision })} onActivate={(pack) => activatePack.mutate(pack)} onResolvePack={(pack) => openSources("active", pack.state_code)} />;
                  })}
                </div>
              )}
            </> : null}
          </div>
        </>
      )}
    </AppShell>
  );
}
