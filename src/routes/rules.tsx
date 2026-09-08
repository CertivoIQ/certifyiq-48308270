import { isInternalSegmentUser } from "@/lib/internal-segment-access";
import { useSession } from "@/hooks/use-session";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Cite, Stat } from "@/components/ui-kit";
import { RULES, PROGRAMS, type Program } from "@/lib/demo-data";
import {
  stateCoverage,
  coverageClaim,
  isUsableForDetermination,
  type CoverageStatus,
} from "@/lib/stateCoverageRegistry";
import { Layers } from "lucide-react";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rule Packs & Versioning — CertivoIQ" },
      {
        name: "description",
        content:
          "Versioned LIHTC, HOTMA, HOME and Section 8 rule packs layered core → state → county → property, with effective dates and citations.",
      },
      { property: "og:title", content: "Rule Packs & Versioning — CertivoIQ" },
      {
        property: "og:description",
        content: "Every finding permanently records the rule version that produced it — audit-defensible by design.",
      },
      { property: "og:url", content: "https://certivoiq.com/rules" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/rules" }],
  }),
  component: RulesPage,
});

const LAYERS = [
  { name: "Core engine", detail: "Federal statute & HUD regulation — IRC §42, 24 CFR 5 / 92, Handbook 4350.3", count: 118 },
  { name: "State plugin", detail: "QAP and state agency requirements (THDA, DCA, TDHCA, TCAC…)", count: 358 },
  { name: "County plugin", detail: "MTSP income limits, utility allowance schedules, HOME rents", count: 3142 },
  { name: "PHA plugin", detail: "Payment standards, minimum rent elections, flat rents", count: 214 },
  { name: "Property plugin", detail: "Set-aside election, applicable fraction, unit designations", count: 185 },
];

const STATUS_LABEL: Record<CoverageStatus, string> = {
  federal_baseline: "Federal baseline",
  in_review: "In review",
  validated: "Validated",
  suspended: "Suspended",
};

const STATUS_TONE: Record<CoverageStatus, "seal" | "flag" | "reject"> = {
  federal_baseline: "flag",
  in_review: "flag",
  validated: "seal",
  suspended: "reject",
};

function RulesPage() {
  const { user } = useSession();
  const [program, setProgram] = useState<Program | "all">("all");
  const validatedCount = stateCoverage.filter(isUsableForDetermination).length;
  const rows = program === "all" ? RULES : RULES.filter((r) => r.program === program);

  return (
    <AppShell
      title="Rule packs"
      subtitle={coverageClaim()}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Federal baseline" value="Nationwide" hint="Applies in every jurisdiction" tone="seal" />
        <Stat
          label="Validated state packs"
          value={validatedCount}
          hint={`${stateCoverage.length - validatedCount} jurisdictions require state-specific review`}
          tone={validatedCount ? "seal" : "flag"}
        />
        <Stat label="Jurisdictions identified" value={stateCoverage.length} hint="Controlling agency identified" />
        <Stat label="Superseded versions retained" value="All" hint="Never deleted — findings cite the version of record" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Resolution order" description="Each layer may tighten, never loosen, the layer above it">
          <ol className="space-y-2.5">
            {LAYERS.filter((layer) => layer.name !== "PHA plugin" || isInternalSegmentUser(user)).map((l, i) => (
              <li key={l.name} className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3.5" style={{ marginLeft: `${i * 12}px` }}>
                <Layers className="mt-0.5 size-4 shrink-0 text-slate" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[14.5px] leading-tight">{l.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{l.detail}</p>
                </div>
                <span className="font-mono text-[12.5px] whitespace-nowrap">{l.count.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Programs">
          <ul className="space-y-3">
            {PROGRAMS.map((p) => (
              <li key={p.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[14.5px]">{p.name}</span>
                  <Cite>{p.authority}</Cite>
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{p.blurb}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title="State rule packs" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                {["State", "Controlling agency", "Validated rules", "Effective", "Status"].map((h) => (
                  <th key={h} className="cite px-5 py-2.5 text-[10.5px] uppercase tracking-[0.14em] font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stateCoverage.map((pack) => (
                <tr key={pack.code} className="hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <span className="font-mono text-[12.5px] font-semibold">{pack.code}</span>{" "}
                    <span className="text-muted-foreground">{pack.state}</span>
                  </td>
                  <td className="px-5 py-3 text-[12.5px]">
                    <a className="underline" href={pack.agencyUrl} target="_blank" rel="noreferrer">
                      {pack.primaryAgency}
                    </a>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums">{pack.validatedRuleCount}</td>
                  <td className="px-5 py-3 font-mono text-[12px]">{pack.effectiveDate ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Pill tone={STATUS_TONE[pack.status]}>{STATUS_LABEL[pack.status]}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
          A state pack becomes usable for a determination only after its controlling sources,
          effective dates, rules, fixtures, expected results and independent expert approval are
          stored. Until then CertivoIQ applies the federal baseline only and returns
          &ldquo;Unable to determine&rdquo; whenever the missing state rule could change the outcome.
        </p>
      </Panel>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(["all", ...PROGRAMS.map((p) => p.id)] as (Program | "all")[]).map((p) => (
          <button
            key={p}
            onClick={() => setProgram(p)}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
              program === p ? "border-ink bg-ink text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {p === "all" ? "All rules" : p}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <Panel key={r.ruleId + r.version}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px] font-semibold">{r.ruleId}</span>
                  <Pill tone="seal">{r.version}</Pill>
                  <Pill>{r.program}</Pill>
                  <Pill>{r.scope} layer</Pill>
                </div>
                <h2 className="mt-2 font-display text-[15.5px] leading-snug">{r.name}</h2>
                <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">{r.summary}</p>
              </div>
              <dl className="grid shrink-0 gap-1.5 text-[12px]">
                <div className="flex gap-2">
                  <dt className="cite w-[76px]">Authority</dt>
                  <dd className="font-mono">{r.authority}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="cite w-[76px]">Citation</dt>
                  <dd className="font-mono">{r.citation}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="cite w-[76px]">Effective</dt>
                  <dd className="font-mono">{r.effective}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="cite w-[76px]">Expires</dt>
                  <dd className="font-mono">{r.expires ?? "—"}</dd>
                </div>
                {r.supersededBy && (
                  <div className="flex gap-2">
                    <dt className="cite w-[76px]">Supersedes</dt>
                    <dd className="font-mono">{r.supersededBy}</dd>
                  </div>
                )}
              </dl>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
