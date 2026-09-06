import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill, Stat, type Tone } from "@/components/ui-kit";
import { useCrmStaffAuthority } from "@/hooks/use-crm-staff-authority";
import { supabase } from "@/integrations/supabase/client";

const VALIDATION_STATUSES = new Set([
  "active",
  "queued_for_agent_verification",
  "captured_unvalidated",
  "verified",
  "blocked",
  "rejected",
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

async function loadValidationQueue() {
  // Generated database types intentionally lag controlled launch migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const [packResult, sourceResult, activationResult] = await Promise.all([
    client
      .from("state_rule_pack_candidates")
      .select("id,state_code,status,source_candidate_count,blocked_source_count,compliance_activation_allowed,validated_on,updated_at")
      .order("state_code"),
    client
      .from("state_rule_source_candidates")
      .select("id,state_code,scope,authority_name,official_domain,program,source_type,source_url,candidate_status,agent_verification_status,exact_bytes_captured,compliance_activation_allowed,source_sha256,retrieved_at,verification_evidence,updated_at")
      .order("state_code")
      .order("authority_name"),
    client.rpc("state_rule_pack_activation_readiness"),
  ]);
  if (packResult.error) throw packResult.error;
  if (sourceResult.error) throw sourceResult.error;
  if (activationResult.error) throw activationResult.error;
  return {
    packs: (packResult.data ?? []) as Pack[],
    sources: (sourceResult.data ?? []) as SourceCandidate[],
    activations: (activationResult.data ?? []) as ActivationReadiness[],
  };
}

function SourceReviewCard({
  source,
  draft,
  onDraft,
  onDecision,
  busy,
  inheritedByState,
}: {
  source: SourceCandidate;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onDecision: (decision: "captured_unvalidated" | "verified" | "blocked" | "rejected") => void;
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
          <a
            className="mt-2 inline-flex items-center gap-1.5 break-all text-sm text-primary underline underline-offset-4"
            href={source.source_url}
            target="_blank"
            rel="noreferrer"
          >
            Open official source <ExternalLink className="size-3.5 shrink-0" />
          </a>
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
            </div>
          </div>
          {source.agent_verification_status === "verified" ? (
            <div className="mt-4 rounded-md border border-seal/30 bg-seal-soft p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-seal">
                <CheckCircle2 className="size-4" /> First verification complete
              </p>
              <p className="mt-1 text-muted-foreground">
                This source no longer requires verification. State-pack activation is a separate action
                that must be completed by a different Administrator.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecision("captured_unvalidated")}>
                  Save capture
                </Button>
                <Button size="sm" disabled={busy} onClick={() => onDecision("verified")}>
                  <CheckCircle2 className="size-4" /> Verify source
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecision("blocked")}>
                  Mark blocked
                </Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => onDecision("rejected")}>
                  Reject source
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Every decision is appended to the audit history. Source verification never activates a pack by itself.
              </p>
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
        const confirmed = window.confirm(
          `${decision === "rejected" ? "Reject" : "Block"} this official-source candidate? The state pack will remain fail-closed.`,
        );
        if (!confirmed) throw new Error("Decision cancelled");
      }
      // Generated database types intentionally lag controlled launch migrations.
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
      return data as {
        source_status: string;
        pack_status: string;
        compliance_activation_allowed: boolean;
        validated_on: string | null;
      };
    },
    onSuccess: (result, variables) => {
      toast.success(`${variables.source.state_code} source ${labelFor(result.source_status)}`, {
        description: result.compliance_activation_allowed
          ? `Pack activated automatically. Validation date: ${result.validated_on ?? "recorded"}.`
          : `Pack status: ${labelFor(result.pack_status)}. Activation remains closed until the full pack passes.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Decision cancelled") return;
      toast.error(messageForError(error, "Source review could not be recorded"));
    },
  });

  const activatePack = useMutation({
    mutationFn: async (pack: ActivationReadiness) => {
      const confirmed = window.confirm(
        `Activate the ${pack.state_code} state rule pack? This records your independent second validation.`,
      );
      if (!confirmed) throw new Error("Activation cancelled");
      // Generated database types intentionally lag controlled launch migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.rpc("activate_state_rule_pack", {
        p_pack_candidate_id: pack.pack_candidate_id,
        p_notes: "Independent second validation completed in the State Rule Validation workspace.",
      });
      if (error) throw error;
      return data as { state_code: string; validated_on: string; pack_status: string };
    },
    onSuccess: (result) => {
      toast.success(`${result.state_code} state pack activated`, {
        description: `Independent activation recorded for ${result.validated_on}.`,
      });
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
      // Generated database types intentionally lag controlled launch migrations.
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
      toast.success(`${result.state_code} source record created`, {
        description: "The exact-file source is queued for independent validation and remains fail-closed.",
      });
      setNewSource(EMPTY_NEW_SOURCE);
      setShowNewSource(false);
      setStateCode(result.state_code);
      setStatus("active");
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
    onError: (error) => {
      toast.error(messageForError(error, "Source record could not be created"));
    },
  });

  const packs = query.data?.packs ?? [];
  const statePacks = packs.filter((pack) => pack.state_code !== "US");
  const selectedPack = statePacks.find((pack) => pack.state_code === stateCode);
  const activatedPacks = statePacks.filter((pack) => pack.compliance_activation_allowed).length;
  const activations = query.data?.activations ?? [];
  const completedSourceActivations = activations.filter((pack) => pack.activation_recorded).length;
  const allSourceActivationsRecorded =
    statePacks.length > 0 &&
    activations.length === statePacks.length &&
    completedSourceActivations === statePacks.length;
  const pendingActivations = activations.filter(
    (pack) => pack.sources_ready && !pack.activation_recorded,
  );
  const sources = query.data?.sources ?? [];
  const federalSources = sources.filter(
    (source) => source.state_code === "US" || source.scope === "FEDERAL_SHARED",
  );
  const federalSourcesVerified =
    federalSources.length > 0 &&
    federalSources.every((source) => source.agent_verification_status === "verified");
  const verified = sources.filter((source) => source.agent_verification_status === "verified").length;
  const blocked = sources.filter((source) => ["blocked", "rejected"].includes(source.agent_verification_status)).length;
  const active = sources.length - verified;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sources.filter((source) => {
      const federalShared = source.state_code === "US" || source.scope === "FEDERAL_SHARED";
      const inheritedFederal =
        stateCode !== "ALL" && stateCode !== "US" && federalShared;
      if (stateCode !== "ALL" && source.state_code !== stateCode && !inheritedFederal) return false;
      const excludedRedundant =
        source.agent_verification_status === "rejected" &&
        source.candidate_status === "EXCLUDED_REDUNDANT_SOURCE";
      // A selected state always shows its inherited federal baseline, even when
      // the "All remaining" queue filter would normally hide a completed source.
      if (!inheritedFederal && status === "active" && source.agent_verification_status === "verified") {
        return false;
      }
      if (!inheritedFederal && status === "active" && excludedRedundant) return false;
      if (
        !inheritedFederal &&
        status !== "active" &&
        status !== "all" &&
        source.agent_verification_status !== status
      ) return false;
      if (!needle) return true;
      return [source.state_code, source.authority_name, source.source_type, source.source_url]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [search, sources, stateCode, status]);

  return (
    <AppShell
      title="State & Federal Rule Validation"
      subtitle="Controlled exact-source review for 50 state packs and shared federal authorities"
    >
      {loading ? (
        <Panel bodyClassName="p-8">Checking validation authority…</Panel>
      ) : !canManageStaff ? (
        <Panel bodyClassName="p-8">
          <h2 className="font-display text-lg">Manager or Administrator authority required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Employees cannot view or decide state-source validation records.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Stat label="State packs" value={query.error ? "—" : statePacks.length} hint="Exactly 50 state candidates" />
            <Stat label="Second validation" value={query.error ? "—" : `${completedSourceActivations}/${statePacks.length}`} hint="State-pack source stage" tone={allSourceActivationsRecorded ? "seal" : "flag"} />
            <Stat label="Compliance active" value={query.error ? "—" : activatedPacks} hint="Validated release required" tone={activatedPacks ? "seal" : "flag"} />
            <Stat label="Remaining" value={query.error ? "—" : active} hint="Includes blocked items" tone={active ? "flag" : "seal"} />
            <Stat label="Verified sources" value={query.error ? "—" : verified} hint="Source review only" tone={verified ? "seal" : "flag"} />
            <Stat label="Blocked / rejected" value={query.error ? "—" : blocked} hint="Must be resolved" tone={blocked ? "reject" : "seal"} />
          </div>

          <div className="mt-4 rounded-lg border border-flag/30 bg-flag-soft p-4 text-sm">
            <p className="flex items-start gap-2 font-medium">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Two independent validation stages are required.
            </p>
            <p className="mt-1 text-muted-foreground">
              First, every required state source and the shared federal baseline must be verified. Then a different
              Administrator must activate the state pack. Reviewer and activator emails remain hidden from operational
              screens and are available only through controlled reporting.
            </p>
            {selectedPack?.validated_on ? (
              <p className="mt-2 font-medium">Validation date: {selectedPack.validated_on}</p>
            ) : null}
            {stateCode === "US" ? (
              <div className="mt-3 rounded-md border border-seal/30 bg-background/70 p-3">
                <p className="font-medium text-seal">
                  Federal source verification {federalSourcesVerified ? "complete" : "still open"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  The shared federal baseline is inherited by all 50 state packs and is not activated as a standalone pack.
                  Use each state pack's second-validation record, then complete the separate deterministic release gate.
                </p>
              </div>
            ) : null}
          </div>

          <Panel
            className="mt-4"
            title="State packs awaiting independent activation"
            description="These packs completed first verification and require a different Administrator to activate them."
            bodyClassName="p-0"
          >
            {pendingActivations.length ? (
              <ul className="divide-y divide-border">
                {pendingActivations.map((pack) => (
                  <li key={pack.pack_candidate_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{pack.state_code}</span>
                        <Pill tone="flag">Awaiting second validation</Pill>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {pack.first_reviewer_count} first-stage reviewer{pack.first_reviewer_count === 1 ? "" : "s"} recorded.
                        {pack.viewer_is_first_reviewer
                          ? " A different Administrator must activate this pack."
                          : " You are eligible to complete the independent activation."}
                      </p>
                    </div>
                    {pack.viewer_can_activate ? (
                      <Button
                        size="sm"
                        disabled={activatePack.isPending}
                        onClick={() => activatePack.mutate(pack)}
                      >
                        <ShieldCheck className="size-4" /> Activate state pack
                      </Button>
                    ) : (
                      <Pill>Different Administrator required</Pill>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                {allSourceActivationsRecorded ? (
                  <>
                    <p className="font-medium text-foreground">Independent state-pack activation is already complete.</p>
                    <p className="mt-1">
                      All {completedSourceActivations} current state-pack source snapshots have second-verification records.
                      The shared federal baseline has no separate activation button. Compliance remains fail-closed until
                      the deterministic release gate is completed.
                    </p>
                  </>
                ) : (
                  "No state packs are awaiting independent activation."
                )}
              </div>
            )}
          </Panel>

          {isCrmAdmin ? (
            <Panel
              className="mt-4"
              title="Exact-file source records"
              description="Split mutable landing pages and document collections into independently hashable source records."
              actions={
                <Button
                  size="sm"
                  variant={showNewSource ? "outline" : "default"}
                  onClick={() => setShowNewSource((current) => !current)}
                >
                  <Plus className="size-4" />
                  {showNewSource ? "Cancel" : "Add source record"}
                </Button>
              }
              bodyClassName={showNewSource ? "p-5" : "hidden"}
            >
              {showNewSource ? (
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createSource.mutate(newSource);
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="new-source-state">State</Label>
                    <select
                      id="new-source-state"
                      required
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={newSource.stateCode}
                      onChange={(event) =>
                        setNewSource((current) => ({ ...current, stateCode: event.target.value }))
                      }
                    >
                      <option value="">Select a state</option>
                      {statePacks.map((pack) => (
                        <option key={pack.id} value={pack.state_code}>
                          {pack.state_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-source-scope">Scope</Label>
                    <Input
                      id="new-source-scope"
                      required
                      maxLength={100}
                      value={newSource.scope}
                      onChange={(event) =>
                        setNewSource((current) => ({
                          ...current,
                          scope: normalizeIdentifier(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="new-source-authority">Issuing authority</Label>
                    <Input
                      id="new-source-authority"
                      required
                      maxLength={250}
                      placeholder="Arizona Department of Housing"
                      value={newSource.authorityName}
                      onChange={(event) =>
                        setNewSource((current) => ({ ...current, authorityName: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-source-domain">Official domain</Label>
                    <Input
                      id="new-source-domain"
                      readOnly
                      maxLength={253}
                      placeholder="Derived from the official file URL"
                      value={newSource.officialDomain}
                    />
                    <p className="text-xs text-muted-foreground">
                      Automatically derived from the exact official file URL.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-source-program">Program</Label>
                    <Input
                      id="new-source-program"
                      required
                      maxLength={100}
                      value={newSource.program}
                      onChange={(event) =>
                        setNewSource((current) => ({
                          ...current,
                          program: normalizeIdentifier(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-source-type">Source type</Label>
                    <Input
                      id="new-source-type"
                      required
                      maxLength={150}
                      placeholder="COMPLIANCE_MANUAL"
                      value={newSource.sourceType}
                      onChange={(event) =>
                        setNewSource((current) => ({
                          ...current,
                          sourceType: normalizeIdentifier(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-source-condition">Intake condition</Label>
                    <Input
                      id="new-source-condition"
                      required
                      maxLength={150}
                      value={newSource.candidateStatus}
                      onChange={(event) =>
                        setNewSource((current) => ({
                          ...current,
                          candidateStatus: normalizeIdentifier(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="new-source-url">Exact official file URL</Label>
                    <Input
                      id="new-source-url"
                      type="url"
                      required
                      maxLength={2000}
                      placeholder="https://housing.az.gov/.../document.pdf"
                      value={newSource.sourceUrl}
                      onChange={(event) => {
                        const sourceUrl = event.target.value;
                        setNewSource((current) => ({
                          ...current,
                          sourceUrl,
                          officialDomain: officialDomainFor(sourceUrl),
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the direct PDF, spreadsheet, ZIP, or other immutable official file—not a landing page.
                    </p>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={createSource.isPending}>
                      {createSource.isPending ? "Creating…" : "Create validation record"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      A new record returns the pack to validation until every required source passes.
                    </p>
                  </div>
                </form>
              ) : null}
            </Panel>
          ) : null}

          <Panel className="mt-4" title="Queue filters" bodyClassName="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="state-filter">Source jurisdiction</Label>
                <select
                  id="state-filter"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={stateCode}
                  onChange={(event) => setStateCode(event.target.value)}
                >
                  <option value="ALL">All state and federal sources</option>
                  <option value="US">Federal shared — all 50 states</option>
                  {statePacks.map((pack) => (
                    <option key={pack.id} value={pack.state_code}>
                      {pack.state_code} — {labelFor(pack['status'])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status-filter">Status</Label>
                <select
                  id="status-filter"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="active">All remaining</option>
                  <option value="queued_for_agent_verification">Queued</option>
                  <option value="captured_unvalidated">Captured, unvalidated</option>
                  <option value="verified">Verified</option>
                  <option value="blocked">Blocked</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All history</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source-search">Search</Label>
                <Input
                  id="source-search"
                  value={search}
                  placeholder="Agency, state, source type, or URL"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </Panel>

          {query.error ? (
            <div className="mt-4 rounded-lg border border-reject/30 bg-reject-soft p-4 text-sm text-reject">
              The validation queue could not be loaded. No source status was changed.
            </div>
          ) : query.isLoading ? (
            <Panel className="mt-4" bodyClassName="p-10">Loading the state-source queue…</Panel>
          ) : !visible.length ? (
            <Panel className="mt-4" bodyClassName="p-10 text-center">
              <FileSearch className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No source candidates match these filters.</p>
            </Panel>
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
                return (
                  <SourceReviewCard
                    key={source.id}
                    source={source}
                    draft={draft}
                    busy={review.isPending && review.variables?.source.id === source.id}
                    inheritedByState={
                      source.scope === "FEDERAL_SHARED" && stateCode !== "ALL" && stateCode !== "US"
                        ? stateCode
                        : undefined
                    }
                    onDraft={(next) => setDrafts((current) => ({ ...current, [source.id]: next }))}
                    onDecision={(decision) => review.mutate({ source, decision })}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

