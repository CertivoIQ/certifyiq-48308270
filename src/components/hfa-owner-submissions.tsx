import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send, ShieldAlert, Undo2 } from "lucide-react";

import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  runPreflight,
  type PreflightCheck,
} from "@/lib/hfaRegulatoryTypes";
import {
  createOwnerSubmission,
  grantAgencyAccess,
  listAgencyDirectory,
  listOwnerSubmissions,
  revokeAgencyAccess,
} from "@/lib/hfa-regulatory.functions";

/**
 * Owner side of Phase 1: preflight the package, preview the exact snapshot an
 * agency would receive, then grant or revoke access explicitly. Nothing reaches
 * an agency until the owner grants it.
 */

const BASE_CHECKS: PreflightCheck[] = [
  { id: "tic", label: "Tenant income certification is complete and signed", required: true },
  { id: "income", label: "Third-party income verification attached", required: true },
  { id: "assets", label: "Asset documentation attached", required: true },
  { id: "student", label: "Full-time student status documented", required: false },
  { id: "utility", label: "Utility allowance schedule current", required: false },
  { id: "manifest", label: "Evidence manifest generated for the review", required: true },
];

export function OwnerSubmissionsPanel() {
  const queryClient = useQueryClient();
  const fetchSubmissions = useServerFn(listOwnerSubmissions);
  const fetchAgencies = useServerFn(listAgencyDirectory);
  const create = useServerFn(createOwnerSubmission);
  const grant = useServerFn(grantAgencyAccess);
  const revoke = useServerFn(revokeAgencyAccess);

  const submissions = useQuery({
    queryKey: ["hfa-owner-submissions"],
    queryFn: () => fetchSubmissions({}),
  });
  const agencies = useQuery({ queryKey: ["hfa-agency-directory"], queryFn: () => fetchAgencies({}) });

  const [agencyId, setAgencyId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [program, setProgram] = useState("LIHTC");
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [satisfied, setSatisfied] = useState<Record<string, boolean>>({});

  const checks = BASE_CHECKS.map((c) => ({ ...c, satisfied: Boolean(satisfied[c.id]) }));
  const preflight = runPreflight({ checks });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["hfa-owner-submissions"] });

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          agencyId,
          organizationId: "self",
          propertyId,
          propertyName: propertyName || undefined,
          program,
          reportingPeriod,
          preflight,
        },
      }),
    onSuccess: () => {
      toast.success("Draft package created. Review the snapshot, then grant agency access.");
      setPropertyId("");
      setPropertyName("");
      setReportingPeriod("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = submissions.data ?? [];

  return (
    <div className="space-y-5">
      <Panel
        title="Prepare an agency package"
        description="Preflight runs before anything can be shared. Required items must be complete."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="agency">Agency</Label>
            <select
              id="agency"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
            >
              <option value="">Select an agency…</option>
              {(agencies.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.state_code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="program">Program</Label>
            <select
              id="program"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
            >
              {["LIHTC", "SEC8", "HOME", "HOTMA", "BOND", "RD"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property-id">Property reference</Label>
            <Input id="property-id" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property-name">Property name</Label>
            <Input
              id="property-name"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="period">Reporting period</Label>
            <Input
              id="period"
              placeholder="2026 Q1"
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {checks.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={c.satisfied}
                onChange={(e) => setSatisfied((s) => ({ ...s, [c.id]: e.target.checked }))}
              />
              <span>{c.label}</span>
              {c.required && <Pill tone="neutral">Required</Pill>}
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Pill tone={preflight.canSubmit ? "seal" : "flag"}>
            Readiness {preflight.readinessScore}%
          </Pill>
          <Button size="sm" disabled={!agencyId || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create draft package
          </Button>
        </div>

        {preflight.blockers.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12.5px] text-muted-foreground">
            {preflight.blockers.map((b) => (
              <li key={b}>
                <ShieldAlert className="mr-1.5 inline size-3.5" />
                {b}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="My agency packages" bodyClassName="space-y-3">
        {submissions.isLoading && <p className="text-[13px] text-muted-foreground">Loading…</p>}
        {!submissions.isLoading && rows.length === 0 && (
          <p className="text-[13px] text-muted-foreground">You have not prepared any agency packages.</p>
        )}
        {rows.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
            <div>
              <p className="text-[14px] font-medium">{s.propertyName ?? s.propertyId}</p>
              <p className="text-[12px] text-muted-foreground">
                {s.agencyName ?? "Agency"} · {s.program} · {s.reportingPeriod} · readiness{" "}
                {s.readinessScore === null ? "—" : `${s.readinessScore}%`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={SUBMISSION_STATUS_TONE[s.status]}>{SUBMISSION_STATUS_LABEL[s.status]}</Pill>
              <Button asChild size="sm" variant="outline">
                <Link to="/agency/submissions/$submissionId" params={{ submissionId: s.id }}>
                  Preview snapshot
                </Link>
              </Button>
              {s.status === "draft" && (
                <Button
                  size="sm"
                  onClick={() =>
                    grant({ data: { submissionId: s.id } }).then((r) => {
                      const err = (r as { error?: string }).error;
                      if (err) toast.error(err);
                      else toast.success("Access granted to the agency.");
                      invalidate();
                    }, (e: Error) => toast.error(e.message))
                  }
                >
                  <Send className="size-4" /> Grant agency access
                </Button>
              )}
              {(s.status === "submitted" || s.status === "in_review" || s.status === "correction_required") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    revoke({ data: { submissionId: s.id } }).then(() => {
                      toast.success("Grant revoked. The agency can no longer access this package.");
                      invalidate();
                    }, (e: Error) => toast.error(e.message))
                  }
                >
                  <Undo2 className="size-4" /> Revoke
                </Button>
              )}
              {s.status === "accepted" && (
                <Pill tone="seal">
                  <CheckCircle2 className="size-3.5" /> Immutable
                </Pill>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
