import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill, Stat, type Tone } from "@/components/ui-kit";
import { useCrmStaffAuthority } from "@/hooks/use-crm-staff-authority";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/state-rule-validation")({
  head: () => ({
    meta: [
      { title: "State Rule Validation — CertivoIQ" },
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
  updated_at: string;
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

function toneFor(status: string): Tone {
  if (status === "verified") return "seal";
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
  const [packResult, sourceResult] = await Promise.all([
    client
      .from("state_rule_pack_candidates")
      .select("id,state_code,status,source_candidate_count,blocked_source_count,compliance_activation_allowed,updated_at")
      .order("state_code"),
    client
      .from("state_rule_source_candidates")
      .select("id,state_code,scope,authority_name,official_domain,program,source_type,source_url,candidate_status,agent_verification_status,exact_bytes_captured,compliance_activation_allowed,source_sha256,retrieved_at,verification_evidence,updated_at")
      .order("state_code")
      .order("authority_name"),
  ]);
  if (packResult.error) throw packResult.error;
  if (sourceResult.error) throw sourceResult.error;
  return {
    packs: (packResult.data ?? []) as Pack[],
    sources: (sourceResult.data ?? []) as SourceCandidate[],
  };
}

function SourceReviewCard({
  source,
  draft,
  onDraft,
  onDecision,
  busy,
}: {
  source: SourceCandidate;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onDecision: (decision: "captured_unvalidated" | "verified" | "blocked" | "rejected") => void;
  busy: boolean;
}) {
  const requiresReplacement = ["blocked", "rejected"].includes(source.agent_verification_status);
  return (
    <Panel bodyClassName="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{source.state_code}</span>
            <Pill tone={toneFor(source.agent_verification_status)}>
              {labelFor(source.agent_verification_status)}
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
                value={draft.notes}
                placeholder="Record what was checked and why this decision is supportable. Minimum 10 characters."
                onChange={(event) => onDraft({ ...draft, notes: event.target.value })}
              />
            </div>
          </div>
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
            Every decision is appended to the audit history. Verification never activates compliance rules.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function StateRuleValidationWorkspace() {
  const { canManageStaff, loading } = useCrmStaffAuthority();
  const queryClient = useQueryClient();
  const [stateCode, setStateCode] = useState("ALL");
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

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
        p_notes: draft.notes,
        p_effective_date: draft.effectiveDate || null,
        p_supersession_notes: draft.supersessionNotes || null,
      });
      if (error) throw error;
      return data as { source_status: string; pack_status: string };
    },
    onSuccess: (result, variables) => {
      toast.success(`${variables.source.state_code} source ${labelFor(result.source_status)}`, {
        description: `Pack status: ${labelFor(result.pack_status)}. Compliance activation remains disabled.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Decision cancelled") return;
      toast.error(error instanceof Error ? error.message : "Source review could not be recorded");
    },
  });

  const packs = query.data?.packs ?? [];
  const sources = query.data?.sources ?? [];
  const verified = sources.filter((source) => source.agent_verification_status === "verified").length;
  const blocked = sources.filter((source) => ["blocked", "rejected"].includes(source.agent_verification_status)).length;
  const active = sources.length - verified;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sources.filter((source) => {
      if (stateCode !== "ALL" && source.state_code !== stateCode) return false;
      if (status === "active" && source.agent_verification_status === "verified") return false;
      if (status !== "active" && status !== "all" && source.agent_verification_status !== status) return false;
      if (!needle) return true;
      return [source.state_code, source.authority_name, source.source_type, source.source_url]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [search, sources, stateCode, status]);

  return (
    <AppShell
      title="State Rule Validation"
      subtitle="Controlled exact-source review for the nationwide state rule-pack queue"
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="State packs" value={query.error ? "—" : packs.length} hint="Fail-closed candidates" />
            <Stat label="Source candidates" value={query.error ? "—" : sources.length} hint="Official-source queue" />
            <Stat label="Remaining" value={query.error ? "—" : active} hint="Includes blocked items" tone={active ? "flag" : "seal"} />
            <Stat label="Verified sources" value={query.error ? "—" : verified} hint="Source review only" tone={verified ? "seal" : "flag"} />
            <Stat label="Blocked / rejected" value={query.error ? "—" : blocked} hint="Must be resolved" tone={blocked ? "reject" : "seal"} />
          </div>

          <div className="mt-4 rounded-lg border border-flag/30 bg-flag-soft p-4 text-sm">
            <p className="flex items-start gap-2 font-medium">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Source verification is not rule-pack activation.
            </p>
            <p className="mt-1 text-muted-foreground">
              Deterministic rules, fixtures, expected results, supersession controls, and independent approval remain required before release.
            </p>
          </div>

          <Panel className="mt-4" title="Queue filters" bodyClassName="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="state-filter">State</Label>
                <select
                  id="state-filter"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={stateCode}
                  onChange={(event) => setStateCode(event.target.value)}
                >
                  <option value="ALL">All states</option>
                  {packs.map((pack) => (
                    <option key={pack.id} value={pack.state_code}>
                      {pack.state_code} — {labelFor(pack.status)}
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
                  notes: typeof existing.notes === "string" ? existing.notes : "",
                  effectiveDate: typeof existing.effective_date === "string" ? existing.effective_date : "",
                  supersessionNotes: typeof existing.supersession_notes === "string" ? existing.supersession_notes : "",
                };
                return (
                  <SourceReviewCard
                    key={source.id}
                    source={source}
                    draft={draft}
                    busy={review.isPending && review.variables?.source.id === source.id}
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

