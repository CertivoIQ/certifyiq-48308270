import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, StatusPill, Cite, Stat } from "@/components/ui-kit";
import { FILES, PROPERTIES, PROGRAMS, type Program } from "@/lib/demo-data";

export const Route = createFileRoute("/findings")({
  head: () => ({
    meta: [
      { title: "Findings & Remediation — CertivoIQ" },
      {
        name: "description",
        content:
          "Every compliance finding cited to a versioned rule and anchored to page-level document evidence, with remediation guidance.",
      },
      { property: "og:title", content: "Findings & Remediation — CertivoIQ" },
      {
        property: "og:description",
        content: "Findings read like an annotated document: rule ID, version, citation and highlighted evidence.",
      },
    ],
  }),
  component: FindingsPage,
});

const SEV = { critical: "reject", major: "flag", minor: "neutral" } as const;

function FindingsPage() {
  const [program, setProgram] = useState<Program | "all">("all");

  const all = FILES.flatMap((f) =>
    f.findings.map((finding) => ({
      finding,
      file: f,
      property: PROPERTIES.find((p) => p.id === f.propertyId),
    })),
  );
  const rows = program === "all" ? all : all.filter((r) => r.finding.program === program);
  const critical = all.filter((r) => r.finding.severity === "critical").length;

  return (
    <AppShell title="Findings" subtitle="Deterministic rule violations across the portfolio, each tied to a rule version of record">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open findings" value={all.length} tone="flag" />
        <Stat label="Critical" value={critical} tone="reject" />
        <Stat label="Mean days to remediate" value="6.4" tone="seal" />
        <Stat label="Re-review pass rate" value="91%" tone="seal" />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(["all", ...PROGRAMS.map((p) => p.id)] as (Program | "all")[]).map((p) => (
          <button
            key={p}
            onClick={() => setProgram(p)}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
              program === p ? "border-ink bg-ink text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {p === "all" ? "All programs" : p}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rows.map(({ finding, file, property }) => (
          <Panel key={finding.id} bodyClassName="p-0">
            <Link to="/files/$fileId" params={{ fileId: file.id }} className="block p-5 transition-colors hover:bg-muted/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12.5px] font-semibold">{finding.ruleId}</span>
                    <Pill>{finding.ruleVersion}</Pill>
                    <Pill tone={SEV[finding.severity]}>{finding.severity}</Pill>
                    <Pill>{finding.program}</Pill>
                  </div>
                  <h2 className="mt-2 font-display text-[16px] leading-snug">{finding.title}</h2>
                  <Cite>
                    {file.household} · {file.unit} · {property?.state} · {finding.citation}
                  </Cite>
                </div>
                <StatusPill status={finding.status} />
              </div>
              <blockquote className="mt-3 border-l-2 border-flag bg-flag-soft/40 py-1.5 pl-3 font-mono text-[12px] leading-relaxed">
                {finding.evidence.doc} · p.{finding.evidence.page} ¶{finding.evidence.paragraph} — {finding.evidence.excerpt}
              </blockquote>
            </Link>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
