/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Cite, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/findings")({
  head: () => ({
    meta: [
      { title: "Findings & Corrections — CertivoIQ" },
      {
        name: "description",
        content:
          "Live compliance findings from your reviewed certifications, each cited to a versioned rule with evidence references and resolution controls.",
      },
      { property: "og:title", content: "Findings & Corrections — CertivoIQ" },
      {
        property: "og:description",
        content:
          "Open findings, critical exposure, resolved corrections and reviewed profiles from your own certification review records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/findings" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/findings" }],
  }),
  component: FindingsPage,
});

type FindingRow = {
  id: string;
  item_id: string | null;
  rule_id: string | null;
  rule_version: string | null;
  rule_pack_id: string | null;
  rule_pack_version: string | null;
  jurisdiction: string | null;
  status: string | null;
  severity: string | null;
  explanation: string | null;
  blocking_reasons: any;
  evidence_refs: any;
  engine_build: string | null;
  review_state: string | null;
  created_at: string;
  updated_at: string | null;
};

type ItemRow = {
  id: string;
  original_file_name: string | null;
  status: string | null;
  extracted_data: any;
  created_at: string;
  processed_at: string | null;
};

type ReviewedProfile = {
  itemId: string;
  fileName: string;
  propertyName: string | null;
  unitNumber: string | null;
  householdName: string | null;
  certificationType: string | null;
  effectiveDate: string | null;
  programs: string[];
  reviewedAt: string | null;
  findingCount: number;
  openCount: number;
};

const RESOLVED_REVIEW_STATES = new Set(["approved", "resolved", "closed", "accepted"]);

function pick(source: any, keys: string[]): string | null {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function pickPrograms(source: any): string[] {
  if (!source || typeof source !== "object") return [];
  for (const key of ["program_codes", "programs", "programCodes"]) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string" && !!entry.trim());
    }
    if (typeof value === "string" && value.trim()) {
      return value.split(/[,;]\s*/).filter(Boolean);
    }
  }
  return [];
}

function profileFor(item: ItemRow, findings: FindingRow[]): ReviewedProfile {
  const data = item.extracted_data ?? {};
  const nested = (data.household ?? data.profile ?? {}) as any;
  const open = findings.filter((finding) => isOpenFinding(finding)).length;
  return {
    itemId: item.id,
    fileName: item.original_file_name ?? "Certification file",
    propertyName: pick(data, ["property_name", "propertyName", "property"]) ?? pick(nested, ["property_name"]),
    unitNumber: pick(data, ["unit_number", "unitNumber", "unit"]) ?? pick(nested, ["unit_number"]),
    householdName:
      pick(data, ["household_name", "householdName", "primary_applicant_name", "head_of_household", "tenant_name"]) ??
      pick(nested, ["household_name", "primary_applicant_name", "name"]),
    certificationType: pick(data, ["certification_type", "certificationType", "tic_type", "type"]),
    effectiveDate: pick(data, [
      "certification_effective_date",
      "effective_date",
      "effectiveDate",
      "certification_date",
    ]),
    programs: pickPrograms(data),
    reviewedAt: item.processed_at ?? null,
    findingCount: findings.length,
    openCount: open,
  };
}

export function isOpenFinding(finding: FindingRow): boolean {
  const reviewState = (finding.review_state ?? "").toLowerCase();
  if (RESOLVED_REVIEW_STATES.has(reviewState)) return false;
  const status = (finding.status ?? "").toUpperCase();
  return status === "FAIL" || status === "UNABLE_TO_DETERMINE" || status === "UNABLE TO DETERMINE";
}

export function isCriticalFinding(finding: FindingRow): boolean {
  return (finding.severity ?? "").toLowerCase() === "critical";
}

function severityTone(severity: string | null) {
  const value = (severity ?? "").toLowerCase();
  if (value === "critical") return "reject" as const;
  if (value === "major" || value === "moderate") return "flag" as const;
  return "neutral" as const;
}

function statusTone(finding: FindingRow) {
  if (!isOpenFinding(finding)) return "seal" as const;
  const status = (finding.status ?? "").toUpperCase();
  if (status === "FAIL") return "reject" as const;
  return "flag" as const;
}

function statusLabelFor(finding: FindingRow): string {
  const status = (finding.status ?? "unknown").toUpperCase().replace(/_/g, " ");
  const review = finding.review_state ? ` · ${finding.review_state.replace(/_/g, " ")}` : "";
  return `${status}${review}`;
}

function listOf(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)));
  }
  if (typeof value === "string") return [value];
  if (typeof value === "object") {
    return Object.entries(value).map(([key, entry]) =>
      `${key}: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`,
    );
  }
  return [String(value)];
}

async function loadFindingsWorkspace() {
  const client = supabase as any;
  const { data: findingRows, error: findingError } = await client
    .from("compliance_findings")
    .select(
      "id,item_id,rule_id,rule_version,rule_pack_id,rule_pack_version,jurisdiction,status,severity,explanation,blocking_reasons,evidence_refs,engine_build,review_state,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (findingError) throw findingError;

  const findings = (findingRows ?? []) as FindingRow[];
  const itemIds = Array.from(new Set(findings.map((finding) => finding.item_id).filter(Boolean))) as string[];

  let items: ItemRow[] = [];
  if (itemIds.length > 0) {
    const { data: itemRows, error: itemError } = await client
      .from("certification_import_items")
      .select("id,original_file_name,status,extracted_data,created_at,processed_at")
      .in("id", itemIds);
    if (itemError) throw itemError;
    items = (itemRows ?? []) as ItemRow[];
  }

  return { findings, items };
}

type ViewMode = "open" | "critical" | "resolved" | "profiles";

function FindingsPage() {
  const { user, ready } = useSession();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const workspace = useQuery({
    queryKey: ["findings-workspace", user?.id],
    enabled: ready && !!user,
    queryFn: loadFindingsWorkspace,
  });

  const findings = workspace.data?.findings ?? [];
  const items = workspace.data?.items ?? [];

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const profiles = useMemo(() => {
    return items
      .map((item) =>
        profileFor(
          item,
          findings.filter((finding) => finding.item_id === item.id),
        ),
      )
      .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""));
  }, [items, findings]);

  const openFindings = findings.filter(isOpenFinding);
  const criticalOpen = openFindings.filter(isCriticalFinding);
  const resolved = findings.filter((finding) => !isOpenFinding(finding));

  const resolveMutation = useMutation({
    mutationFn: async ({ findingId, resolutionNotes }: { findingId: string; resolutionNotes: string }) => {
      const { error } = await (supabase as any).rpc("resolve_certification_finding", {
        _finding_id: findingId,
        _resolution_notes: resolutionNotes,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("Correction resolved and recorded in the audit trail.");
      setNotes((previous) => {
        const next = { ...previous };
        delete next[variables.findingId];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["findings-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["role-aware-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["certification-workflow-cases"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "The correction could not be resolved.");
    },
  });

  const selectView = (next: ViewMode) => {
    setView(next);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const cards: { id: ViewMode; label: string; value: number; tone: "flag" | "reject" | "seal" | "neutral"; hint: string }[] =
    [
      { id: "open", label: "Open findings", value: openFindings.length, tone: "flag", hint: "FAIL and Unable to determine" },
      { id: "critical", label: "Critical open", value: criticalOpen.length, tone: "reject", hint: "Escalate before approval" },
      { id: "resolved", label: "Resolved corrections", value: resolved.length, tone: "seal", hint: "Reviewed and closed" },
      { id: "profiles", label: "Reviewed profiles", value: profiles.length, tone: "neutral", hint: "Certifications with findings" },
    ];

  const visibleFindings =
    view === "open" ? openFindings : view === "critical" ? criticalOpen : view === "resolved" ? resolved : [];

  if (!ready) {
    return (
      <AppShell title="Findings & Corrections" subtitle="Loading your session">
        <p className="text-[13px] text-muted-foreground">Checking your access…</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Findings & Corrections" subtitle="Sign in to view your certification review records">
        <Panel>
          <p className="text-[13px] text-muted-foreground">
            Findings are private to your account. Sign in to see the compliance findings discovered in your reviewed
            certifications.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Findings & Corrections"
      subtitle="Live findings from your reviewed certifications, each tied to a rule version of record"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => selectView(card.id)}
            aria-pressed={view === card.id}
            className={`rounded-lg text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              view === card.id ? "ring-2 ring-ring" : "hover:shadow-md"
            }`}
          >
            <Stat label={card.label} value={workspace.isLoading ? "—" : card.value} tone={card.tone} hint={card.hint} />
          </button>
        ))}
      </div>

      <div ref={listRef} className="mt-5 space-y-3">
        {workspace.isLoading && (
          <Panel>
            <p className="text-[13px] text-muted-foreground">Loading your findings…</p>
          </Panel>
        )}

        {workspace.isError && (
          <Panel>
            <p className="text-[13px] text-reject">
              Your findings could not be loaded.{" "}
              {workspace.error instanceof Error ? workspace.error.message : "Please try again."}
            </p>
            <Button className="mt-3" variant="outline" onClick={() => void workspace.refetch()}>
              Try again
            </Button>
          </Panel>
        )}

        {!workspace.isLoading && !workspace.isError && view === "profiles" && (
          <>
            {profiles.length === 0 && (
              <Panel>
                <p className="text-[13px] text-muted-foreground">
                  No reviewed certification profiles yet. Upload and review a certification to populate this list.
                </p>
              </Panel>
            )}
            {profiles.map((profile) => (
              <Panel key={profile.itemId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-[16px] leading-snug">
                      {profile.householdName ?? "Household not determined"}
                    </h2>
                    <Cite>
                      {[profile.propertyName ?? "Property not determined", profile.unitNumber ? `Unit ${profile.unitNumber}` : null,
                        profile.certificationType, profile.effectiveDate]
                        .filter(Boolean)
                        .join(" · ")}
                    </Cite>
                    <p className="mt-2 font-mono text-[12px] text-muted-foreground">{profile.fileName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {profile.programs.map((program) => (
                      <Pill key={program}>{program}</Pill>
                    ))}
                    <Pill tone={profile.openCount > 0 ? "flag" : "seal"}>
                      {profile.openCount} open / {profile.findingCount} findings
                    </Pill>
                  </div>
                </div>
              </Panel>
            ))}
          </>
        )}

        {!workspace.isLoading && !workspace.isError && view !== "profiles" && (
          <>
            {visibleFindings.length === 0 && (
              <Panel>
                <p className="text-[13px] text-muted-foreground">
                  {view === "resolved"
                    ? "No resolved corrections recorded yet."
                    : view === "critical"
                      ? "No critical open findings."
                      : "No open findings. Reviewed certifications with findings appear here."}
                </p>
              </Panel>
            )}

            {visibleFindings.map((finding) => {
              const item = finding.item_id ? itemsById.get(finding.item_id) : undefined;
              const profile = item ? profileFor(item, []) : null;
              const blocking = listOf(finding.blocking_reasons);
              const evidence = listOf(finding.evidence_refs);
              const canResolve = view !== "resolved" && isOpenFinding(finding);
              const noteValue = notes[finding.id] ?? "";
              const pending = resolveMutation.isPending && resolveMutation.variables?.findingId === finding.id;

              return (
                <Panel key={finding.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12.5px] font-semibold">{finding.rule_id ?? "Rule not recorded"}</span>
                        {finding.rule_version && <Pill>{finding.rule_version}</Pill>}
                        {finding.severity && <Pill tone={severityTone(finding.severity)}>{finding.severity}</Pill>}
                        {finding.jurisdiction && <Pill>{finding.jurisdiction}</Pill>}
                      </div>
                      <p className="mt-2 text-[13.5px] leading-relaxed">
                        {finding.explanation ?? "No explanation recorded."}
                      </p>
                      <Cite>
                        {[
                          profile?.householdName,
                          profile?.unitNumber ? `Unit ${profile.unitNumber}` : null,
                          profile?.propertyName,
                          profile?.fileName,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Certification context not recorded"}
                      </Cite>
                    </div>
                    <Pill tone={statusTone(finding)}>{statusLabelFor(finding)}</Pill>
                  </div>

                  {blocking.length > 0 && (
                    <div className="mt-3">
                      <p className="cite text-[10.5px] uppercase tracking-[0.14em]">Blocking reasons</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[12px] leading-relaxed">
                        {blocking.map((reason, index) => (
                          <li key={`${finding.id}-block-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evidence.length > 0 && (
                    <div className="mt-3">
                      <p className="cite text-[10.5px] uppercase tracking-[0.14em]">Evidence references</p>
                      <ul className="mt-1 space-y-0.5 font-mono text-[12px] leading-relaxed text-muted-foreground">
                        {evidence.map((reference, index) => (
                          <li key={`${finding.id}-evidence-${index}`}>{reference}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-3 font-mono text-[11.5px] text-muted-foreground">
                    {[
                      finding.rule_pack_id ? `Pack ${finding.rule_pack_id}` : null,
                      finding.rule_pack_version,
                      finding.engine_build ? `Engine ${finding.engine_build}` : null,
                      `Recorded ${new Date(finding.created_at).toLocaleString()}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  {canResolve && (
                    <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                      <label
                        htmlFor={`resolution-${finding.id}`}
                        className="block text-[12.5px] font-medium"
                      >
                        Resolution notes
                      </label>
                      <Textarea
                        id={`resolution-${finding.id}`}
                        value={noteValue}
                        onChange={(event) =>
                          setNotes((previous) => ({ ...previous, [finding.id]: event.target.value }))
                        }
                        placeholder="Describe the correction taken and the supporting evidence."
                        className="mt-2"
                        rows={3}
                      />
                      <Button
                        className="mt-3"
                        disabled={pending || !noteValue.trim()}
                        onClick={() =>
                          resolveMutation.mutate({ findingId: finding.id, resolutionNotes: noteValue.trim() })
                        }
                      >
                        {pending ? "Resolving…" : "Resolve correction"}
                      </Button>
                    </div>
                  )}
                </Panel>
              );
            })}
          </>
        )}
      </div>
    </AppShell>
  );
}
