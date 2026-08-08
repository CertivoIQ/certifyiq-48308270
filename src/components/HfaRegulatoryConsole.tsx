import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Inbox,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { Panel, Pill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { IQText } from "@/components/iq-text";
import {
  CORRECTION_STATUS_LABEL,
  CORRECTION_STATUS_TONE,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  daysUntil,
  type HfaSubmission,
} from "@/lib/hfaRegulatoryTypes";
import {
  acceptSubmission,
  dispositionCorrection,
  getAgencySubmission,
  getSubmissionEvidenceManifest,
  listAgencyInbox,
  listMyAgencies,
  requestCorrection,
  respondToCorrection,
  startAgencyReview,
} from "@/lib/hfa-regulatory.functions";

/**
 * Regulator-facing workspace. An agency sees only packages an owner explicitly
 * submitted to it. CertivoIQ is an independent compliance platform and implies
 * no endorsement, certification or partnership with any government agency.
 */

function IndependenceNotice() {
  return (
    <p className="rounded-md border border-border bg-muted/40 px-4 py-2 text-[12px] text-muted-foreground">
      <Lock className="mr-1.5 inline size-3.5" />
      Access is limited to packages explicitly submitted to your agency under an active grant.
      CertivoIQ is an independent platform and is not endorsed by, certified by or partnered with any
      housing agency.
    </p>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ overview */

export function AgencyOverview() {
  const fetchAgencies = useServerFn(listMyAgencies);
  const fetchInbox = useServerFn(listAgencyInbox);

  const agencies = useQuery({ queryKey: ["hfa-agencies"], queryFn: () => fetchAgencies({}) });
  const inbox = useQuery({ queryKey: ["hfa-inbox"], queryFn: () => fetchInbox({}) });

  const rows = inbox.data ?? [];
  const counts = useMemo(() => {
    const by = (s: HfaSubmission["status"]) => rows.filter((r) => r.status === s).length;
    return {
      awaiting: by("submitted"),
      inReview: by("in_review"),
      corrections: by("correction_required"),
      accepted: by("accepted"),
    };
  }, [rows]);

  if (agencies.isLoading) return <ConsoleLoading />;

  if (!agencies.data?.length) return <NoAgencyMembership />;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-2xl">
          <IQText>Agency Regulatory Console</IQText>
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {agencies.data.map((m) => m.agency.name).join(" · ")}
        </p>
        <IndependenceNotice />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Awaiting first review" value={String(counts.awaiting)} />
        <Stat label="In review" value={String(counts.inReview)} />
        <Stat label="Corrections outstanding" value={String(counts.corrections)} tone="flag" />
        <Stat label="Accepted" value={String(counts.accepted)} tone="seal" />
      </div>

      <AgencySubmissions />
    </div>
  );
}

/* -------------------------------------------------------------------- inbox */

export function AgencySubmissions() {
  const fetchInbox = useServerFn(listAgencyInbox);
  const inbox = useQuery({ queryKey: ["hfa-inbox"], queryFn: () => fetchInbox({}) });
  const rows = inbox.data ?? [];

  return (
    <Panel
      title="Submission inbox"
      description="Packages explicitly submitted to your agency."
      bodyClassName="p-0"
    >
      {inbox.isLoading ? (
        <div className="p-6 text-[13px] text-muted-foreground">
          <Loader2 className="mr-2 inline size-4 animate-spin" />
          Loading submissions…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-muted-foreground">
          <Inbox className="mx-auto mb-2 size-6 opacity-60" />
          No submissions have been shared with your agency yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5">Property</th>
                <th className="px-5 py-2.5">Program</th>
                <th className="px-5 py-2.5">Period</th>
                <th className="px-5 py-2.5">Readiness</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Submitted</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 font-medium">{s.propertyName ?? s.propertyId}</td>
                  <td className="px-5 py-3">{s.program}</td>
                  <td className="px-5 py-3">{s.reportingPeriod}</td>
                  <td className="px-5 py-3">
                    {s.readinessScore === null ? "—" : `${s.readinessScore}%`}
                  </td>
                  <td className="px-5 py-3">
                    <Pill tone={SUBMISSION_STATUS_TONE[s.status]}>
                      {SUBMISSION_STATUS_LABEL[s.status]}
                    </Pill>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{fmt(s.submittedAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/agency/submissions/$submissionId" params={{ submissionId: s.id }}>
                        Open
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- detail */

export function AgencySubmissionDetail({ submissionId }: { submissionId: string }) {
  const queryClient = useQueryClient();
  const loadDetail = useServerFn(getAgencySubmission);
  const loadManifest = useServerFn(getSubmissionEvidenceManifest);
  const startReview = useServerFn(startAgencyReview);
  const openCorrection = useServerFn(requestCorrection);
  const disposition = useServerFn(dispositionCorrection);
  const accept = useServerFn(acceptSubmission);
  const ownerRespond = useServerFn(respondToCorrection);

  const detail = useQuery({
    queryKey: ["hfa-submission", submissionId],
    queryFn: () => loadDetail({ data: { submissionId } }),
    retry: false,
  });

  const [findingRef, setFindingRef] = useState("");
  const [title, setTitle] = useState("");
  const [detailText, setDetailText] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [response, setResponse] = useState("");
  const [manifest, setManifest] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["hfa-submission", submissionId] });
    void queryClient.invalidateQueries({ queryKey: ["hfa-inbox"] });
    void queryClient.invalidateQueries({ queryKey: ["hfa-owner-submissions"] });
  };

  const handle = (result: unknown, ok: string) => {
    const err = (result as { error?: string } | null)?.error;
    if (err) toast.error(err);
    else toast.success(ok);
    invalidate();
  };

  const reviewMutation = useMutation({
    mutationFn: () => startReview({ data: { submissionId } }),
    onSuccess: (r) => handle(r, "Review started."),
    onError: (e: Error) => toast.error(e.message),
  });

  const correctionMutation = useMutation({
    mutationFn: () =>
      openCorrection({ data: { submissionId, findingRef, title, detail: detailText, dueAt } }),
    onSuccess: (r) => {
      handle(r, "Correction requested.");
      setFindingRef("");
      setTitle("");
      setDetailText("");
      setDueAt("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { submissionId } }),
    onSuccess: (r) => handle(r, "Submission accepted."),
    onError: (e: Error) => toast.error(e.message),
  });

  const manifestMutation = useMutation({
    mutationFn: () => loadManifest({ data: { submissionId } }),
    onSuccess: (r) => {
      const err = (r as { error?: string }).error;
      if (err) {
        toast.error(err);
        return;
      }
      setManifest(JSON.stringify(r, null, 2));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) return <ConsoleLoading />;
  if (detail.isError || !detail.data)
    return (
      <Panel title="Not available">
        <p className="text-[13px] text-muted-foreground">
          This submission is not shared with your agency, or the grant has been revoked.
        </p>
      </Panel>
    );

  const { submission, isOwner, cases, evidence, auditEvents } = detail.data;
  const canReview = !isOwner;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/agency">
            <ArrowLeft className="size-4" /> Inbox
          </Link>
        </Button>
        <Pill tone={SUBMISSION_STATUS_TONE[submission.status]}>
          {SUBMISSION_STATUS_LABEL[submission.status]}
        </Pill>
      </div>

      <Panel
        title={submission.propertyName ?? submission.propertyId}
        description={`${submission.program} · ${submission.reportingPeriod}`}
        actions={
          canReview ? (
            <div className="flex flex-wrap gap-2">
              {(submission.status === "submitted" || submission.status === "correction_required") && (
                <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate()}>
                  <FileSearch className="size-4" /> Start review
                </Button>
              )}
              {submission.status !== "accepted" && (
                <Button size="sm" onClick={() => acceptMutation.mutate()}>
                  <CheckCircle2 className="size-4" /> Accept
                </Button>
              )}
            </div>
          ) : null
        }
      >
        <dl className="grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Agency</dt>
            <dd>{submission.agencyName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Readiness at submission</dt>
            <dd>{submission.readinessScore === null ? "—" : `${submission.readinessScore}%`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Submitted</dt>
            <dd>{fmt(submission.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Accepted</dt>
            <dd>{fmt(submission.acceptedAt)}</dd>
          </div>
        </dl>

        {submission.preflight?.unableToDetermine && (
          <p className="mt-4 rounded-md border border-flag/40 bg-flag-soft px-4 py-2 text-[12.5px]">
            <AlertTriangle className="mr-1.5 inline size-3.5" />
            The controlling state rule pack was not validated when this package was prepared, so the
            engine reported <strong>unable to determine</strong> rather than a Pass/Fail result.
          </p>
        )}
      </Panel>

      <Panel
        title="Evidence manifest"
        description="Immutable record of the inputs, rule versions and engine build behind this package."
        actions={
          <Button size="sm" variant="outline" onClick={() => manifestMutation.mutate()}>
            <ShieldCheck className="size-4" /> Retrieve manifest
          </Button>
        }
      >
        {manifest ? (
          <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11.5px] leading-relaxed">
            {manifest}
          </pre>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Retrieval is authorized server-side and recorded as an audit event.
          </p>
        )}
      </Panel>

      <Panel title="Correction cases" bodyClassName="space-y-4">
        {cases.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No corrections have been requested.</p>
        )}
        {cases.map((c) => {
          const due = daysUntil(c.dueAt);
          const files = evidence.filter((e) => e.correctionCaseId === c.id);
          return (
            <div key={c.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[14px] font-medium">{c.title}</p>
                  <p className="text-[12px] text-muted-foreground">
                    Finding {c.findingRef} · due {fmt(c.dueAt)}{" "}
                    {c.status !== "accepted" && (due < 0 ? `(${Math.abs(due)}d overdue)` : `(${due}d left)`)}
                  </p>
                </div>
                <Pill tone={CORRECTION_STATUS_TONE[c.status]}>{CORRECTION_STATUS_LABEL[c.status]}</Pill>
              </div>
              {c.detail && <p className="mt-2 text-[13px]">{c.detail}</p>}
              {c.ownerResponse && (
                <p className="mt-3 rounded-md bg-muted/50 p-3 text-[13px]">
                  <span className="font-medium">Owner response:</span> {c.ownerResponse}
                </p>
              )}
              {files.length > 0 && (
                <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
                  {files.map((f) => (
                    <li key={f.id}>
                      {f.documentLabel ?? f.documentRef} · sha256 {f.sha256.slice(0, 12)}…
                    </li>
                  ))}
                </ul>
              )}
              {c.disposition && (
                <p className="mt-3 text-[13px]">
                  <span className="font-medium">Agency disposition:</span> {c.disposition}
                </p>
              )}

              {isOwner && (c.status === "open" || c.status === "reopened") && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor={`resp-${c.id}`}>Corrective action taken</Label>
                  <Textarea
                    id={`resp-${c.id}`}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      ownerRespond({ data: { caseId: c.id, response } }).then((r) => {
                        handle(r, "Response submitted.");
                        setResponse("");
                      }, (e: Error) => toast.error(e.message))
                    }
                  >
                    Submit response
                  </Button>
                </div>
              )}

              {canReview && c.status !== "accepted" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      disposition({
                        data: { caseId: c.id, disposition: "Corrective action accepted.", accept: true },
                      }).then((r) => handle(r, "Correction closed."), (e: Error) => toast.error(e.message))
                    }
                  >
                    Accept correction
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      disposition({
                        data: {
                          caseId: c.id,
                          disposition: "Response insufficient; case reopened.",
                          accept: false,
                        },
                      }).then((r) => handle(r, "Correction reopened."), (e: Error) => toast.error(e.message))
                    }
                  >
                    Reopen
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {canReview && submission.status !== "accepted" && (
          <div className="rounded-md border border-dashed border-border p-4">
            <p className="mb-3 text-[13px] font-medium">Request a correction</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="finding-ref">Finding reference</Label>
                <Input id="finding-ref" value={findingRef} onChange={(e) => setFindingRef(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due-at">Response due</Label>
                <Input id="due-at" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="corr-title">Summary</Label>
                <Input id="corr-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="corr-detail">Required corrective action</Label>
                <Textarea
                  id="corr-detail"
                  rows={3}
                  value={detailText}
                  onChange={(e) => setDetailText(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-3" size="sm" onClick={() => correctionMutation.mutate()}>
              <ClipboardCheck className="size-4" /> Send correction request
            </Button>
          </div>
        )}
      </Panel>

      <Panel title="Audit history" description="Append-only. Views, exports and decisions are recorded.">
        <ul className="space-y-2 text-[12.5px]">
          {auditEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5">
              <span className="font-mono">{e.action}</span>
              <span className="text-muted-foreground">
                {e.actorKind} · {new Date(e.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function ConsoleLoading() {
  return (
    <div className="p-8 text-[13px] text-muted-foreground">
      <Loader2 className="mr-2 inline size-4 animate-spin" />
      Loading regulatory console…
    </div>
  );
}

function NoAgencyMembership() {
  return (
    <Panel title="Agency access required">
      <p className="text-[13px] text-muted-foreground">
        Your account is not a member of a housing agency workspace. Owners manage their agency packages
        from <Link className="underline" to="/submissions">My submissions</Link>.
      </p>
    </Panel>
  );
}

export { IndependenceNotice, fmt as formatConsoleDate };
