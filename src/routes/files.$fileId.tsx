import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, StatusPill, Cite, Meter } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FILES, PROPERTIES, RULES, money, type CertFile, type Finding } from "@/lib/demo-data";
import { verdictFor, correctionSteps, LEVEL_META } from "@/lib/platform-data";
import { coverageForState, isUsableForDetermination } from "@/lib/stateCoverageRegistry";
import { determineReview, OUTCOME_LABEL } from "@/lib/complianceDecisionAndManifest";
import { CheckCircle2, CircleAlert, FileText, ShieldCheck, Stamp } from "lucide-react";

export const Route = createFileRoute("/files/$fileId")({
  loader: ({ params }) => {
    const file = FILES.find((f) => f.id === params.fileId);
    if (!file) throw notFound();
    return { file };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Certification unavailable — CertivoIQ" }, { name: "robots", content: "noindex" }] };
    }
    const f = loaderData.file as CertFile;
    const desc = `${f.certType} for ${f.household} (${f.unit}) — ${f.findings.length} findings across ${f.programs.join(", ")}, effective ${f.effective}.`;
    return {
      meta: [
        { title: `${f.id} — Certification Review — CertivoIQ` },
        { name: "description", content: desc },
        { property: "og:title", content: `${f.id} — Certification Review` },
        { property: "og:description", content: desc },
        { property: "og:url", content: `https://certivoiq.com/files/${params.fileId}` },
      ],
      links: [{ rel: "canonical", href: `https://certivoiq.com/files/${params.fileId}` }],
    };
  },
  notFoundComponent: () => (
    <AppShell title="Certification not found" subtitle="This file is not in the demo dataset">
      <Button asChild>
        <Link to="/files">Back to queue</Link>
      </Button>
    </AppShell>
  ),
  component: FileReview,
});

const SEV = { critical: "reject", major: "flag", minor: "neutral" } as const;

function FindingCard({ finding }: { finding: Finding }) {
  const rule = RULES.find((r) => r.ruleId === finding.ruleId && r.version === finding.ruleVersion);
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-ledger">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] font-semibold">{finding.ruleId}</span>
            <Pill>{finding.ruleVersion}</Pill>
            <Pill tone={SEV[finding.severity]}>{finding.severity}</Pill>
            <Pill>{finding.program}</Pill>
          </div>
          <h3 className="mt-2 font-display text-[16.5px] leading-snug">{finding.title}</h3>
        </div>
        <StatusPill status={finding.status} />
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{finding.detail}</p>

      <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
        <p className="cite text-[10.5px] uppercase tracking-[0.14em]">Evidence</p>
        <p className="mt-1.5 font-mono text-[12px]">
          {finding.evidence.doc} · page {finding.evidence.page} · ¶{finding.evidence.paragraph}
        </p>
        <blockquote className="mt-2.5 border-l-2 border-flag bg-flag-soft/50 py-1.5 pl-3 font-mono text-[12.5px] leading-relaxed">
          {finding.evidence.excerpt}
        </blockquote>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
        <div>
          <dt className="cite text-[10.5px] uppercase tracking-[0.14em]">Citation</dt>
          <dd className="mt-1 font-mono text-[12.5px]">{finding.citation}</dd>
        </div>
        <div>
          <dt className="cite text-[10.5px] uppercase tracking-[0.14em]">Rule version of record</dt>
          <dd className="mt-1 font-mono text-[12.5px]">
            {finding.ruleId} {finding.ruleVersion} · {rule?.authority ?? "HUD"} · eff. {rule?.effective ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <p className="min-w-0 flex-1 text-[13px]">
          <span className="cite text-[10.5px] uppercase tracking-[0.14em]">Recommended remediation</span>
          <span className="mt-1 block text-muted-foreground">{finding.remediation}</span>
        </p>
        <Button size="sm" variant="outline" onClick={() => toast.success(`${finding.id} marked remediated — file re-queued for review`)}>
          Mark remediated
        </Button>
      </div>
    </article>
  );
}

function FileReview() {
  const { file } = Route.useLoaderData() as { file: CertFile };
  const property = PROPERTIES.find((p) => p.id === file.propertyId);
  const [approved, setApproved] = useState(file.status === "approved");
  const blocking = file.findings.filter((f) => f.status !== "approved").length;

  /**
   * Deterministic gate. If the property's state pack is not validated, a
   * state-specific rule could change the outcome, so CertivoIQ returns
   * "Unable to determine" and blocks Pass/Fail and authorized compliance approval.
   */
  const statePack = coverageForState(property?.state ?? "");
  const determination = determineReview({
    fields: [],
    failedRuleIds: file.findings.filter((f) => f.status !== "approved").map((f) => f.ruleId),
    minimumConfidence: 0.85,
    missingRequiredDocumentIds: [],
    unresolvedRuleConflicts: [],
    stateRuleUnvalidated: !isUsableForDetermination(statePack),
  });
  const signOffBlocked = approved || blocking > 0 || !determination.signOffAllowed;

  const rows = [
    { label: "Annual gross income", value: money(file.annualIncome) },
    { label: "Household size", value: String(file.hhSize) },
    { label: "AMI designation", value: file.amiTier },
    { label: "Net family assets", value: money(file.assets) },
    { label: "Total tenant payment", value: `${money(file.ttp)} / mo` },
    { label: "Effective date", value: file.effective },
  ];

  return (
    <AppShell
      title={file.household}
      subtitle={`${file.id} · ${file.certType} · ${file.unit} · ${property?.state ?? ""} rule stack`}
      actions={
        <>
          <Button variant="outline" size="sm">
            Open document set
          </Button>
          <Button
            size="sm"
            disabled={signOffBlocked}
            onClick={() => {
              setApproved(true);
              toast.success("File approval recorded", { description: `${file.id} locked with full audit trail retained.` });
            }}
          >
            <ShieldCheck className="size-4" />
            {approved ? "Approval recorded" : "Record approval"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Tabs defaultValue="calc">
            <TabsList className="flex-wrap">
              <TabsTrigger value="calc">Calculation</TabsTrigger>
              <TabsTrigger value="extraction">Extraction</TabsTrigger>
              <TabsTrigger value="findings">Findings ({file.findings.length})</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="calc" className="mt-4">
              <Panel title="Tenant Income Certification" description="Recomputed by the deterministic engine — never by the language model">
                <dl className="divide-y divide-border">
                  {rows.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="text-[13.5px] text-muted-foreground">{r.label}</dt>
                      <dd className="font-mono text-[13.5px] tabular-nums">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              <Panel className="mt-4" title="Rule evaluation" description="Every applicable rule in the layered stack, in evaluation order" bodyClassName="p-0">
                <ul className="divide-y divide-border">
                  {RULES.filter((r) => file.programs.includes(r.program))
                    .slice(0, 9)
                    .map((r) => {
                      const failed = file.findings.some((f) => f.ruleId === r.ruleId);
                      return (
                        <li key={r.ruleId + r.version} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                          {failed ? (
                            <CircleAlert className="size-4 shrink-0 text-flag" />
                          ) : (
                            <CheckCircle2 className="size-4 shrink-0 text-seal" />
                          )}
                          <span className="font-mono text-[12.5px]">{r.ruleId}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px]">{r.name}</span>
                          <span className="cite">{r.citation}</span>
                          <Pill tone={failed ? "flag" : "seal"}>{failed ? "Finding" : "Pass"}</Pill>
                        </li>
                      );
                    })}
                </ul>
              </Panel>
            </TabsContent>

            <TabsContent value="extraction" className="mt-4">
              <Panel
                title="Document extraction confidence"
                description="Every value traced to its source document, page and extracted text — authorized compliance verification tracked"
                bodyClassName="p-0"
              >
                <ul className="divide-y divide-border">
                  {file.fields.map((f) => (
                    <li key={f.label} className="grid gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <p className="text-[13px] text-muted-foreground">{f.label}</p>
                        <p className="mt-0.5 font-mono text-[15px]">{f.value}</p>
                        <Cite>
                          {f.source} · page {f.page}
                        </Cite>
                      </div>
                      <div className="w-full sm:w-40">
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="cite">confidence</span>
                          <span className="font-mono text-[12.5px]">{f.confidence}%</span>
                        </div>
                        <Meter value={f.confidence} tone={f.confidence >= 95 ? "seal" : f.confidence >= 85 ? "flag" : "reject"} />
                        <div className="mt-2">
                          {f.verified ? (
                            <Pill tone="seal">Authorized compliance agent verified</Pill>
                          ) : (
                            <Pill tone="flag">Needs verification</Pill>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </TabsContent>

            <TabsContent value="findings" className="mt-4">
              {file.findings.length === 0 ? (
                <Panel>
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <span className="stamp px-4 py-1.5 text-[13px] text-seal">Approved</span>
                    <p className="text-[13.5px] text-muted-foreground">
                      All applicable rules passed. File locked with the full audit trail retained.
                    </p>
                  </div>
                </Panel>
              ) : (
                <div className="space-y-4">
                  {file.findings.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <Panel title="Compliance timeline" description="Move-in through recertification — one continuous history">
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {file.timeline.map((e) => {
                    const dot =
                      e.kind === "seal" ? "bg-seal" : e.kind === "flag" ? "bg-flag" : e.kind === "reject" ? "bg-reject" : "bg-slate";
                    return (
                      <li key={e.date + e.label} className="relative">
                        <span className={`absolute top-1.5 -left-[27px] size-2.5 rounded-full ring-3 ring-card ${dot}`} />
                        <p className="cite">{e.date}</p>
                        <p className="mt-0.5 font-display text-[15px] leading-tight">{e.label}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">{e.note}</p>
                      </li>
                    );
                  })}
                </ol>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Panel title="Compliance review verdict" description="Scored against this property's assigned program rule packs">
            {(() => {
              const v = verdictFor(file);
              const meta = LEVEL_META[v.level];
              return (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className={`stamp px-3 py-1.5 text-[13px] ${
                        meta.tone === "seal" ? "text-seal" : meta.tone === "flag" ? "text-flag" : "text-reject"
                      }`}
                    >
                      {v.verdict}
                    </span>
                    <div>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                      <p className="mt-1 font-mono text-[13px]">
                        {v.score}% · {v.passed}/{v.total} rules passed
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Meter value={v.score} tone={meta.tone} />
                  </div>
                  <p className="mt-3 text-[12.5px] text-muted-foreground">{meta.blurb}</p>

                  <p className="cite mt-5 text-[10.5px] uppercase tracking-[0.14em]">Correction steps</p>
                  <ol className="mt-2 space-y-2.5">
                    {correctionSteps(file).map((s, i) => (
                      <li key={i} className="border-b border-border pb-2.5 text-[12.5px] last:border-0 last:pb-0">
                        <span className="cite">{s.rule}</span>
                        <p className="mt-0.5">{s.step}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {s.owner} · due in {s.due}
                        </p>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <Stamp className="size-4 text-slate" />
                      <StatusPill status={approved ? "approved" : file.status} />
                    </div>
                    {determination.outcome === "unable_to_determine" ? (
                      <div className="mt-3 rounded-md border border-flag/40 bg-flag-soft p-3">
                        <p className="font-display text-[13.5px]">
                          {OUTCOME_LABEL[determination.outcome]}
                        </p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12.5px] text-muted-foreground">
                          {determination.blockingReasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[12px] text-muted-foreground">
                          No Pass or Fail is issued and sign-off stays locked until these are resolved.
                        </p>
                      </div>
                    ) : null}
                    <p className="mt-3 text-[12.5px] text-muted-foreground">
                      {approved
                        ? "Final sign-off recorded by Jordan Alvarez, Compliance Reviewer — file locked with full audit trail."
                        : blocking > 0
                          ? `${blocking} finding(s) must be corrected before authorized compliance approval can be recorded.`
                          : "All rules passed — reviewer may give final sign-off."}
                    </p>
                    <Button
                      className="mt-3 w-full"
                      size="sm"
                      disabled={signOffBlocked}
                      onClick={() => {
                        setApproved(true);
                        toast.success("Final approval signed", {
                          description: `${file.id} signed off by Jordan Alvarez · ${new Date().toLocaleDateString()}`,
                        });
                      }}
                    >
                      <ShieldCheck className="size-4" />
                      {approved ? "Signed off" : "Authorized compliance approval"}
                    </Button>
                  </div>
                </>
              );
            })()}
          </Panel>

          <Panel title="Document set">
            <ul className="space-y-2.5">
              {[...new Set(file.fields.map((f) => f.source))].map((doc) => (
                <li key={doc} className="flex items-center gap-2.5 text-[12.5px]">
                  <FileText className="size-4 shrink-0 text-slate" />
                  <span className="truncate font-mono">{doc}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Ask the compliance assistant">
            <p className="text-[13px] text-muted-foreground">
              The deterministic engine supplies the facts; the Compliance Assistant explains them in plain language with citations.
            </p>
            <Button className="mt-3 w-full" variant="outline" size="sm" asChild>
              <Link to="/copilot">Why did this fail?</Link>
            </Button>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
