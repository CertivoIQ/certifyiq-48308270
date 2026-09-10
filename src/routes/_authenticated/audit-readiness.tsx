import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  ListChecks,
  Plus,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuditReplayTimeline } from "@/components/audit-replay-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meter, Panel, Pill, Stat, type Tone } from "@/components/ui-kit";
import { useSession } from "@/hooks/use-session";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/audit-readiness")({
  head: () => ({
    meta: [
      { title: "Affordable Housing Audit Readiness — CertivoIQ" },
      {
        name: "description",
        content:
          "Prepare evidence, findings remediation, program records, and approval and final-review history for affordable housing audits.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditReadinessWorkspace,
});

type ChecklistItem = {
  id: string;
  category: string;
  label: string;
  description: string;
  required: boolean;
  confirmed: boolean;
  confirmed_at?: string | null;
};

type MockAuditRun = {
  id: string;
  user_id: string;
  scope: "property" | "portfolio" | "organization";
  jurisdiction: string;
  framework: "federal" | "state" | "custom";
  status: "queued" | "running" | "completed" | "failed";
  readiness_score: number | null;
  critical_count: number;
  major_count: number;
  minor_count: number;
  findings: unknown[];
  evidence_manifest: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type AuditReviewConfirmation = {
  id: string;
  audit_run_id: string;
  user_id: string;
  responsible_party_name: string;
  responsible_party_position: string;
  signature_text: string;
  attestation: string;
  confirmation_snapshot: {
    package_gate?: Record<string, unknown>;
    [key: string]: unknown;
  };
  confirmed_at: string;
  created_at: string;
};

type Finding = {
  id: string;
  rule_id: string;
  rule_version: string;
  rule_pack_id: string;
  rule_pack_version: string;
  jurisdiction: string;
  status: string;
  severity: string;
  explanation: string;
  evidence_refs: unknown[];
  review_state: string;
  created_at: string;
};

type Remediation = {
  id: string;
  finding_ref: string;
  rule_id: string;
  citation: string;
  severity: string;
  status: string;
  remediation_plan: string;
  due_at: string | null;
  evidence_refs: unknown[];
  verified_by: string | null;
  closed_by: string | null;
  created_at: string;
};

type EvidenceManifest = {
  id: string;
  review_id: string;
  property_id: string | null;
  certification_id: string | null;
  outcome: string;
  engine_build: string;
  manifest_sha256: string;
  created_at: string;
};

type AssuranceCase = {
  id: string;
  property_key: string;
  event_date: string;
  applicable_program_codes: string[];
  regulatory_status: string;
  audit_status: string;
  assurance_status: string;
  engine_build: string;
  manifest_sha256: string;
  created_at: string;
};

type ImportItem = {
  id: string;
  status: string;
  sha256: string | null;
  original_file_name: string;
  created_at: string;
};

const CORE_REQUIREMENTS: ChecklistItem[] = [
  {
    id: "program-inventory",
    category: "Program and authority records",
    label: "Applicable program inventory",
    description: "Confirm every federal, state, local, and project funding layer for the audit scope.",
    required: true,
    confirmed: false,
  },
  {
    id: "regulatory-agreements",
    category: "Program and authority records",
    label: "Regulatory agreements and recorded restrictions",
    description: "Include extended-use, HOME, HUD, RD, bond, state, local, and project-specific authority.",
    required: true,
    confirmed: false,
  },
  {
    id: "current-limits",
    category: "Program and authority records",
    label: "Current income, rent, and utility-allowance limits",
    description: "Bind each version and effective date to the certifications it governs.",
    required: true,
    confirmed: false,
  },
  {
    id: "owner-certifications",
    category: "Property and annual records",
    label: "Annual owner certifications and agency reports",
    description: "Include required owner certifications, occupancy reports, and monitoring submissions.",
    required: true,
    confirmed: false,
  },
  {
    id: "unit-history",
    category: "Property and annual records",
    label: "Unit, vacancy, transfer, and occupancy history",
    description: "Reconcile unit status, move-ins, transfers, vacancies, and applicable set-asides.",
    required: true,
    confirmed: false,
  },
  {
    id: "charges-and-leases",
    category: "Property and annual records",
    label: "Leases, riders, tenant charges, and fees",
    description: "Confirm program-required lease language and permitted tenant charges.",
    required: true,
    confirmed: false,
  },
  {
    id: "inspection-records",
    category: "Property and annual records",
    label: "Inspection, violation, common-area, and correction records",
    description: "Include inspection findings, health and safety items, and documented corrections.",
    required: true,
    confirmed: false,
  },
  {
    id: "tenant-certifications",
    category: "Tenant-file sample",
    label: "TICs, recertifications, interims, and signed forms",
    description: "Confirm the certification history and required signatures for every sampled household.",
    required: true,
    confirmed: false,
  },
  {
    id: "income-assets",
    category: "Tenant-file sample",
    label: "Income, asset, student, and household verification",
    description: "Retain the source pages and validation status used for each deterministic calculation.",
    required: true,
    confirmed: false,
  },
  {
    id: "evidence-lineage",
    category: "Defensible audit package",
    label: "Evidence manifests and exact document hashes",
    description: "Link documents to extracted evidence, rule versions, calculations, and findings.",
    required: true,
    confirmed: false,
  },
  {
    id: "findings-remediation",
    category: "Defensible audit package",
    label: "Findings, corrective actions, and closure evidence",
    description: "Document the correction path, verification, closure, and separation of duties.",
    required: true,
    confirmed: false,
  },
  {
    id: "final-review-history",
    category: "Defensible audit package",
    label: "Final approvals, exceptions, and review history",
    description: "Preserve reviewer identity and the disposition of unresolved or unusual issues.",
    required: true,
    confirmed: false,
  },
];

const PROGRAM_REQUIREMENTS: Record<string, ChecklistItem[]> = {
  lihtc: [
    {
      id: "lihtc-student-rule",
      category: "LIHTC",
      label: "Student-status determinations and exceptions",
      description: "Include full-time student evidence and the cited exception when applicable.",
      required: true,
      confirmed: false,
    },
    {
      id: "lihtc-set-aside",
      category: "LIHTC",
      label: "Applicable fraction, set-aside, and next-available-unit support",
      description: "Reconcile building and unit designations with household occupancy history.",
      required: true,
      confirmed: false,
    },
  ],
  home: [
    {
      id: "home-designations",
      category: "HOME",
      label: "HOME-assisted unit designations and affordability periods",
      description: "Confirm fixed/floating designations and the controlling affordability requirements.",
      required: true,
      confirmed: false,
    },
  ],
  rural_development: [
    {
      id: "rd-occupancy",
      category: "USDA Rural Development",
      label: "RD occupancy, certification, and servicing records",
      description: "Include current RD forms, occupancy reviews, and applicable HB-2-3560 authority.",
      required: true,
      confirmed: false,
    },
  ],
  section8_pbra: [
    {
      id: "hud-eiv-hotma",
      category: "HUD / HOTMA",
      label: "EIV, HOTMA, safe-harbor, and HUD certification evidence",
      description: "Retain reconciliation, exclusions, deductions, hardship, and required verification evidence.",
      required: true,
      confirmed: false,
    },
  ],
  section202_8: [
    {
      id: "hud-eiv-hotma",
      category: "HUD / HOTMA",
      label: "EIV, HOTMA, safe-harbor, and HUD certification evidence",
      description: "Retain reconciliation, exclusions, deductions, hardship, and required verification evidence.",
      required: true,
      confirmed: false,
    },
  ],
  section202_811_prac: [
    {
      id: "hud-eiv-hotma",
      category: "HUD / HOTMA",
      label: "EIV, HOTMA, safe-harbor, and HUD certification evidence",
      description: "Retain reconciliation, exclusions, deductions, hardship, and required verification evidence.",
      required: true,
      confirmed: false,
    },
  ],
  section811_pra: [
    {
      id: "hud-eiv-hotma",
      category: "HUD / HOTMA",
      label: "EIV, HOTMA, safe-harbor, and HUD certification evidence",
      description: "Retain reconciliation, exclusions, deductions, hardship, and required verification evidence.",
      required: true,
      confirmed: false,
    },
  ],
};

function buildChecklist(programs: string[]) {
  const byId = new Map(CORE_REQUIREMENTS.map((item) => [item.id, { ...item }]));
  for (const program of programs) {
    for (const item of PROGRAM_REQUIREMENTS[program] ?? []) {
      if (!byId.has(item.id)) byId.set(item.id, { ...item });
    }
  }
  return [...byId.values()];
}

function checklistFrom(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChecklistItem => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ChecklistItem>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.category === "string" &&
      typeof candidate.label === "string" &&
      typeof candidate.description === "string" &&
      typeof candidate.required === "boolean" &&
      typeof candidate.confirmed === "boolean"
    );
  });
}

function openFinding(finding: Finding) {
  return !["closed", "resolved", "approved"].includes(finding.status.toLowerCase());
}

function openRemediation(action: Remediation) {
  return action.status.toUpperCase() !== "CLOSED";
}

function toneForScore(score: number, blocked: boolean): Tone {
  if (blocked) return "reject";
  if (score === 100) return "seal";
  if (score > 0) return "flag";
  return "neutral";
}

async function loadAuditWorkspace() {
  // Database types intentionally lag controlled audit-readiness migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const results = await Promise.all([
    client.from("mock_audit_runs").select("*").order("created_at", { ascending: false }),
    client
      .from("audit_review_confirmations")
      .select("id,audit_run_id,user_id,responsible_party_name,responsible_party_position,signature_text,attestation,confirmation_snapshot,confirmed_at,created_at")
      .order("confirmed_at", { ascending: false }),
    client
      .from("evidence_manifests")
      .select("id,review_id,property_id,certification_id,outcome,engine_build,manifest_sha256,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    client
      .from("compliance_findings")
      .select("id,rule_id,rule_version,rule_pack_id,rule_pack_version,jurisdiction,status,severity,explanation,evidence_refs,review_state,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    client
      .from("compliance_assurance_cases")
      .select("id,property_key,event_date,applicable_program_codes,regulatory_status,audit_status,assurance_status,engine_build,manifest_sha256,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    client
      .from("compliance_remediation_actions")
      .select("id,finding_ref,rule_id,citation,severity,status,remediation_plan,due_at,evidence_refs,verified_by,closed_by,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    client
      .from("certification_import_items")
      .select("id,status,sha256,original_file_name,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  return {
    runs: (results[0].data ?? []) as MockAuditRun[],
    confirmations: (results[1].data ?? []) as AuditReviewConfirmation[],
    manifests: (results[2].data ?? []) as EvidenceManifest[],
    findings: (results[3].data ?? []) as Finding[],
    cases: (results[4].data ?? []) as AssuranceCase[],
    remediations: (results[5].data ?? []) as Remediation[],
    imports: (results[6].data ?? []) as ImportItem[],
  };
}

function AuditReadinessWorkspace() {
  const { session } = useSession();
  const { profile } = useWorkspaceProfile();
  const queryClient = useQueryClient();
  const [showStart, setShowStart] = useState(false);
  const [scope, setScope] = useState<MockAuditRun["scope"]>("organization");
  const [jurisdiction, setJurisdiction] = useState("MULTI_STATE");
  const [framework, setFramework] = useState<MockAuditRun["framework"]>("custom");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [responsiblePartyName, setResponsiblePartyName] = useState("");
  const [responsiblePartyPosition, setResponsiblePartyPosition] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [attestationAccepted, setAttestationAccepted] = useState(false);

  const query = useQuery({
    queryKey: ["audit-readiness-workspace"],
    enabled: Boolean(session?.user.id),
    queryFn: loadAuditWorkspace,
    refetchInterval: 30_000,
  });

  const runs = query.data?.runs ?? [];
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const checklist = checklistFrom(selectedRun?.evidence_manifest);
  const requiredItems = checklist.filter((item) => item.required);
  const confirmedItems = requiredItems.filter((item) => item.confirmed);
  const score = requiredItems.length
    ? Math.round((confirmedItems.length / requiredItems.length) * 100)
    : 0;

  const findings = query.data?.findings ?? [];
  const remediations = query.data?.remediations ?? [];
  const openFindings = findings.filter(openFinding);
  const criticalFindings = openFindings.filter((finding) => finding.severity.toLowerCase() === "critical");
  const openActions = remediations.filter(openRemediation);
  const overdueActions = openActions.filter(
    (action) => action.due_at && new Date(action.due_at).valueOf() < Date.now(),
  );
  const blocked = criticalFindings.length > 0;
  const selectedConfirmation =
    query.data?.confirmations.find((confirmation) => confirmation.audit_run_id === selectedRun?.id) ?? null;
  const pendingFinalReview =
    Boolean(selectedRun) &&
    !selectedConfirmation &&
    score === 100 &&
    !blocked &&
    openActions.length === 0 &&
    (query.data?.manifests.length ?? 0) > 0;
  const finalReviewConfirmed = Boolean(selectedConfirmation);

  const createRun = useMutation({
    mutationFn: async () => {
      const userId = session?.user.id;
      if (!userId) throw new Error("Sign in to start audit preparation");
      if (!jurisdiction.trim()) throw new Error("Enter the audit jurisdiction");
      const evidenceManifest = buildChecklist(profile.selected_programs);
      // Database types intentionally lag controlled audit-readiness migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("mock_audit_runs")
        .insert({
          user_id: userId,
          scope,
          jurisdiction: jurisdiction.trim().toUpperCase(),
          framework,
          status: "running",
          readiness_score: 0,
          critical_count: criticalFindings.length,
          major_count: openFindings.filter((finding) => finding.severity.toLowerCase() === "major").length,
          minor_count: openFindings.filter((finding) => finding.severity.toLowerCase() === "minor").length,
          findings: [],
          evidence_manifest: evidenceManifest,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as MockAuditRun;
    },
    onSuccess: (run) => {
      setSelectedRunId(run.id);
      setShowStart(false);
      toast.success("Audit preparation started", {
        description: "The checklist is program-aware and remains subject to final compliance review.",
      });
      void queryClient.invalidateQueries({ queryKey: ["audit-readiness-workspace"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Audit preparation could not be started");
    },
  });

  const updateChecklist = useMutation({
    mutationFn: async ({ run, itemId }: { run: MockAuditRun; itemId: string }) => {
      const current = checklistFrom(run.evidence_manifest);
      const next = current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              confirmed: !item.confirmed,
              confirmed_at: !item.confirmed ? new Date().toISOString() : null,
            }
          : item,
      );
      const required = next.filter((item) => item.required);
      const nextScore = required.length
        ? Math.round((required.filter((item) => item.confirmed).length / required.length) * 100)
        : 0;
      // Database types intentionally lag controlled audit-readiness migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client
        .from("mock_audit_runs")
        .update({
          evidence_manifest: next,
          readiness_score: nextScore,
          status: "running",
          critical_count: criticalFindings.length,
          major_count: openFindings.filter((finding) => finding.severity.toLowerCase() === "major").length,
          minor_count: openFindings.filter((finding) => finding.severity.toLowerCase() === "minor").length,
          completed_at: null,
        })
        .eq("id", run.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-readiness-workspace"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Checklist item could not be updated");
    },
  });

  const confirmFinalReview = useMutation({
    mutationFn: async () => {
      const userId = session?.user.id;
      if (!userId || !selectedRun) throw new Error("Select an audit-preparation run");
      if (!pendingFinalReview) throw new Error("Complete every preparation gate before final review");
      if (responsiblePartyName.trim().length < 2) throw new Error("Enter the responsible party's full name");
      if (responsiblePartyPosition.trim().length < 2) throw new Error("Enter the responsible party's position");
      if (signatureText.trim().length < 2) throw new Error("Enter the responsible party's signature");
      if (!attestationAccepted) throw new Error("Accept the final-review confirmation statement");

      // Database types intentionally lag controlled audit-readiness migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("audit_review_confirmations").insert({
        audit_run_id: selectedRun.id,
        user_id: userId,
        responsible_party_name: responsiblePartyName.trim(),
        responsible_party_position: responsiblePartyPosition.trim(),
        signature_text: signatureText.trim(),
        attestation:
          "I confirm that I reviewed this audit-preparation package and that the information recorded is accurate to the best of my knowledge. This confirmation does not guarantee an agency outcome.",
        confirmation_snapshot: {
          audit_run: {
            id: selectedRun.id,
            jurisdiction: selectedRun.jurisdiction,
            scope: selectedRun.scope,
            framework: selectedRun.framework,
            readiness_score: score,
          },
          checklist,
          package_gate: {
            required_items_confirmed: score === 100,
            critical_open_findings: criticalFindings.length,
            open_remediation_actions: openActions.length,
            evidence_manifest_count: query.data?.manifests.length ?? 0,
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAttestationAccepted(false);
      toast.success("Final review confirmed", {
        description: "The signed confirmation record is now locked.",
      });
      void queryClient.invalidateQueries({ queryKey: ["audit-readiness-workspace"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Final review could not be confirmed");
    },
  });

  const exportPackage = () => {
    if (!selectedRun) return;
    const payload = {
      package_type: "CERTIVOIQ_AFFORDABLE_HOUSING_AUDIT_PREPARATION",
      generated_at: new Date().toISOString(),
      disclaimer:
        "Preparation status is not an agency determination or a guarantee of audit outcome. Final compliance review remains required.",
      audit_run: {
        ...selectedRun,
        readiness_score: score,
        evidence_manifest: checklist,
      },
      package_gate: {
        pending_final_review: pendingFinalReview,
        final_review_confirmed: finalReviewConfirmed,
        critical_open_findings: criticalFindings.length,
        open_remediation_actions: openActions.length,
        evidence_manifest_count: query.data?.manifests.length ?? 0,
      },
      final_review_confirmation: selectedConfirmation,
      controlled_evidence_manifests: query.data?.manifests ?? [],
      assurance_cases: query.data?.cases ?? [],
      findings,
      remediation_actions: remediations,
      certification_imports: query.data?.imports ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `certivoiq-audit-package-${selectedRun.jurisdiction.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const groupedChecklist = useMemo(() => {
    const grouped = new Map<string, ChecklistItem[]>();
    for (const item of checklist) {
      const items = grouped.get(item.category) ?? [];
      items.push(item);
      grouped.set(item.category, items);
    }
    return [...grouped.entries()];
  }, [checklist]);

  return (
    <AppShell
      title="Audit Readiness"
      subtitle="Prepare affordable-housing evidence before the auditor asks for it"
      actions={
        <div className="flex flex-wrap gap-2">
          {selectedRun ? (
            <>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> Print summary
              </Button>
              <Button size="sm" variant="outline" onClick={exportPackage}>
                <Download className="size-4" /> Export package
              </Button>
            </>
          ) : null}
          <Button size="sm" onClick={() => setShowStart((current) => !current)}>
            <Plus className="size-4" /> Start preparation
          </Button>
        </div>
      }
    >
      <AuditReplayTimeline />

      <div className="rounded-lg border border-flag/30 bg-flag-soft p-4 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Audit preparation supports—not replaces—an authorized compliance reviewer.
        </p>
        <p className="mt-1 text-muted-foreground">
          Progress reflects confirmed package items and controlled evidence. It does not predict or guarantee an agency audit outcome.
        </p>
      </div>

      {showStart ? (
        <Panel
          className="mt-4"
          title="Start an audit-preparation run"
          description="The checklist expands automatically for the programs configured in your workspace."
        >
          <form
            className="grid gap-4 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              createRun.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="audit-scope">Scope</Label>
              <select
                id="audit-scope"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={scope}
                onChange={(event) => setScope(event.target.value as MockAuditRun["scope"])}
              >
                <option value="organization">Organization</option>
                <option value="portfolio">Portfolio</option>
                <option value="property">Property</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-jurisdiction">Jurisdiction</Label>
              <Input
                id="audit-jurisdiction"
                value={jurisdiction}
                maxLength={40}
                placeholder="MULTI_STATE, TN, FL…"
                onChange={(event) => setJurisdiction(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-framework">Framework</Label>
              <select
                id="audit-framework"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={framework}
                onChange={(event) => setFramework(event.target.value as MockAuditRun["framework"])}
              >
                <option value="custom">Layered programs</option>
                <option value="federal">Federal</option>
                <option value="state">State</option>
              </select>
            </div>
            <div className="md:col-span-3 flex items-center gap-3">
              <Button type="submit" disabled={createRun.isPending}>
                {createRun.isPending ? "Starting…" : "Create readiness checklist"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Configured programs: {profile.selected_programs.length
                  ? profile.selected_programs.map((program) => program.replaceAll("_", " ").toUpperCase()).join(" · ")
                  : "core affordable-housing controls"}
              </p>
            </div>
          </form>
        </Panel>
      ) : null}

      {query.error ? (
        <div className="mt-4 rounded-lg border border-reject/30 bg-reject-soft p-4 text-sm text-reject">
          Audit-readiness data could not be loaded. No preparation status was changed.
        </div>
      ) : query.isLoading ? (
        <Panel className="mt-4" bodyClassName="p-10">Loading audit-readiness controls…</Panel>
      ) : !selectedRun ? (
        <Panel className="mt-4" bodyClassName="p-10 text-center">
          <ListChecks className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-display text-lg">Start before the audit notice arrives</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Build a program-aware document request list, connect findings to corrections, and preserve the evidence trail your reviewer will need.
          </p>
          <Button className="mt-5" onClick={() => setShowStart(true)}>
            <Plus className="size-4" /> Start audit preparation
          </Button>
        </Panel>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Preparation progress"
              value={`${score}%`}
              hint={finalReviewConfirmed ? "Final review confirmed" : pendingFinalReview ? "Pending final review" : "Confirmed required items"}
              tone={toneForScore(score, blocked)}
            />
            <Stat
              label="Checklist"
              value={`${confirmedItems.length}/${requiredItems.length}`}
              hint="Required items confirmed"
              tone={score === 100 ? "seal" : "flag"}
            />
            <Stat
              label="Open findings"
              value={openFindings.length}
              hint={criticalFindings.length ? `${criticalFindings.length} critical` : "No open critical findings"}
              tone={criticalFindings.length ? "reject" : openFindings.length ? "flag" : "seal"}
            />
            <Stat
              label="Remediation"
              value={openActions.length}
              hint={overdueActions.length ? `${overdueActions.length} overdue` : "Open corrective actions"}
              tone={overdueActions.length ? "reject" : openActions.length ? "flag" : "seal"}
            />
            <Stat
              label="Evidence manifests"
              value={query.data?.manifests.length ?? 0}
              hint="Hash-controlled review records"
              tone={(query.data?.manifests.length ?? 0) ? "seal" : "flag"}
            />
          </div>

          <Panel
            className="mt-4"
            title={
              finalReviewConfirmed
                ? "Final review confirmed"
                : pendingFinalReview
                  ? "Pending final review"
                  : blocked
                    ? "Preparation blocked"
                    : "Preparation in progress"
            }
            description={`${selectedRun.jurisdiction} · ${selectedRun.scope.replaceAll("_", " ")} · ${selectedRun.framework.replaceAll("_", " ")}`}
            actions={
              <Pill tone={finalReviewConfirmed ? "seal" : pendingFinalReview ? "flag" : blocked ? "reject" : "flag"}>
                {finalReviewConfirmed
                  ? "FINAL REVIEW CONFIRMED"
                  : pendingFinalReview
                    ? "PENDING FINAL REVIEW"
                    : blocked
                      ? "CRITICAL FINDING OPEN"
                      : "NOT YET COMPLETE"}
              </Pill>
            }
          >
            <Meter value={score} tone={toneForScore(score, blocked)} />
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {[
                {
                  label: "Required package items confirmed",
                  passed: score === 100,
                  detail: `${confirmedItems.length} of ${requiredItems.length}`,
                },
                {
                  label: "No unresolved critical findings",
                  passed: criticalFindings.length === 0,
                  detail: `${criticalFindings.length} open`,
                },
                {
                  label: "Corrective actions closed",
                  passed: openActions.length === 0,
                  detail: `${openActions.length} open`,
                },
                {
                  label: "Controlled evidence manifest present",
                  passed: (query.data?.manifests.length ?? 0) > 0,
                  detail: `${query.data?.manifests.length ?? 0} manifests`,
                },
              ].map((gate) => (
                <div key={gate.label} className="flex items-center gap-3 rounded-md border border-border p-3">
                  {gate.passed ? (
                    <CheckCircle2 className="size-5 shrink-0 text-seal" />
                  ) : (
                    <Clock3 className="size-5 shrink-0 text-flag" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{gate.label}</p>
                    <p className="text-xs text-muted-foreground">{gate.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {pendingFinalReview ? (
            <Panel
              className="mt-4"
              title="Final review confirmation"
              description="A responsible party must sign before this preparation run can be completed."
            >
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  confirmFinalReview.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="responsible-party-name">Responsible party name</Label>
                  <Input
                    id="responsible-party-name"
                    value={responsiblePartyName}
                    maxLength={200}
                    onChange={(event) => setResponsiblePartyName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="responsible-party-position">Position</Label>
                  <Input
                    id="responsible-party-position"
                    value={responsiblePartyPosition}
                    maxLength={200}
                    placeholder="Compliance Director"
                    onChange={(event) => setResponsiblePartyPosition(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="responsible-party-signature">Signature</Label>
                  <Input
                    id="responsible-party-signature"
                    value={signatureText}
                    maxLength={200}
                    placeholder="Type the responsible party's signature"
                    onChange={(event) => setSignatureText(event.target.value)}
                    required
                  />
                </div>
                <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={attestationAccepted}
                    onChange={(event) => setAttestationAccepted(event.target.checked)}
                  />
                  <span>
                    I confirm that I reviewed this audit-preparation package and that the information recorded is
                    accurate to the best of my knowledge. This confirmation does not guarantee an agency outcome.
                  </span>
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={confirmFinalReview.isPending}>
                    {confirmFinalReview.isPending ? "Recording…" : "Confirm final review"}
                  </Button>
                </div>
              </form>
            </Panel>
          ) : selectedConfirmation ? (
            <Panel
              className="mt-4"
              title="Signed final review confirmation"
              description="This confirmation is append-only and the preparation run is locked."
            >
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Responsible party</p>
                  <p className="font-medium">{selectedConfirmation.responsible_party_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="font-medium">{selectedConfirmation.responsible_party_position}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Signature</p>
                  <p className="font-serif text-lg italic">{selectedConfirmation.signature_text}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                  <p className="font-medium">{new Date(selectedConfirmation.confirmed_at).toLocaleString()}</p>
                </div>
              </div>
            </Panel>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <Panel
              title="Affordable-housing audit checklist"
              description="Confirm an item only after the supporting record is present and reviewable."
            >
              <div className="space-y-5">
                {groupedChecklist.map(([category, items]) => (
                  <div key={category}>
                    <h3 className="cite text-xs uppercase tracking-[0.14em]">{category}</h3>
                    <div className="mt-2 space-y-2">
                      {items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/35"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-primary"
                            checked={item.confirmed}
                            disabled={updateChecklist.isPending || finalReviewConfirmed}
                            onChange={() => updateChecklist.mutate({ run: selectedRun, itemId: item.id })}
                          />
                          <span>
                            <span className="block text-sm font-medium">{item.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="Package contents" description="Live, access-controlled records visible to this workspace.">
                <div className="space-y-2">
                  {[
                    ["Certification files", query.data?.imports.length ?? 0],
                    ["Evidence manifests", query.data?.manifests.length ?? 0],
                    ["Assurance cases", query.data?.cases.length ?? 0],
                    ["Compliance findings", findings.length],
                    ["Corrective actions", remediations.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm">
                      <span>{label}</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/files"><FileCheck2 className="size-4" /> Certification files</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/findings"><AlertTriangle className="size-4" /> Findings</Link>
                  </Button>
                </div>
              </Panel>

              <Panel title="Preparation history" description="Prior readiness snapshots remain available for comparison.">
                <div className="space-y-2">
                  {runs.slice(0, 8).map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-muted/35"
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <span>
                        <span className="block font-medium">{run.jurisdiction}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.created_at).toLocaleDateString()} · {run.scope}
                        </span>
                      </span>
                      <Pill tone={(run.readiness_score ?? 0) === 100 ? "seal" : "flag"}>
                        {Math.round(run.readiness_score ?? 0)}%
                      </Pill>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <Panel
            className="mt-4"
            title="Findings and corrective-action gate"
            description="Critical findings and open remediation prevent a pending-final-review status."
          >
            {!openFindings.length && !openActions.length ? (
              <div className="flex items-center gap-3 rounded-md border border-seal/25 bg-seal-soft p-4">
                <CheckCircle2 className="size-5 text-seal" />
                <p className="text-sm">No open findings or corrective actions are currently visible to this workspace.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openFindings.slice(0, 10).map((finding) => (
                  <div key={finding.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={finding.severity.toLowerCase() === "critical" ? "reject" : "flag"}>
                        {finding.severity.toUpperCase()}
                      </Pill>
                      <span className="font-mono text-xs">{finding.rule_id} · {finding.rule_version}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{finding.jurisdiction}</span>
                    </div>
                    <p className="mt-2 text-sm">{finding.explanation}</p>
                  </div>
                ))}
                {openActions.slice(0, 10).map((action) => (
                  <div key={action.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={action.due_at && new Date(action.due_at).valueOf() < Date.now() ? "reject" : "flag"}>
                        {action.status}
                      </Pill>
                      <span className="font-mono text-xs">{action.finding_ref} · {action.rule_id}</span>
                    </div>
                    <p className="mt-2 text-sm">{action.remediation_plan}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {action.citation}{action.due_at ? ` · Due ${new Date(action.due_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}
