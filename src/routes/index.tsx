import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat, Meter, Cite } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  PORTFOLIO,
  PROPERTIES,
  RISK_TREND,
  FINDINGS_BY_PROGRAM,
  riskBand,
} from "@/lib/demo-data";
import { ArrowUpRight, TrendingDown } from "lucide-react";
import { useT, useFormatters } from "@/lib/i18n/provider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CertivoIQ — Affordable Housing Compliance Intelligence" },
      {
        name: "description",
        content:
          "CertivoIQ audits LIHTC, Section 8, HOME and HOTMA certifications with a deterministic rules engine, AI extraction and portfolio risk scoring across all 50 states.",
      },
      { property: "og:title", content: "CertivoIQ — Affordable Housing Compliance Intelligence" },
      {
        property: "og:description",
        content:
          "Executive portfolio view: open findings, 8823 exposure, HOTMA and NSPIRE readiness, and property-level risk scores.",
      },
      { property: "og:url", content: "https://certivoiq.com/" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/" }],
  }),
  component: ExecutiveDashboard,
});

function ExecutiveDashboard() {
  const t = useT();
  const { number } = useFormatters();
  const ranked = [...PROPERTIES].sort((a, b) => b.risk - a.risk);
  const maxFindings = Math.max(...FINDINGS_BY_PROGRAM.map((f) => f.count));

  return (
    <AppShell
      title={t("dash.title")}
      subtitle={t("dash.subtitle")}
      actions={
        <>
          <Button variant="outline" size="sm">
            {t("dash.export")}
          </Button>
          <Button size="sm" asChild>
            <Link to="/files">{t("dash.reviewQueue")}</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("dash.stat.properties")} value={PORTFOLIO.properties} hint={t("dash.stat.properties.hint", { units: number(PORTFOLIO.units) })} />
        <Stat label={t("dash.stat.openFindings")} value={PORTFOLIO.openFindings} hint={t("dash.stat.openFindings.hint")} tone="flag" />
        <Stat label={t("dash.stat.exposure")} value={PORTFOLIO.exposure8823} hint={t("dash.stat.exposure.hint")} tone="reject" />
        <Stat label={t("dash.stat.autoApproval")} value={`${PORTFOLIO.autoApprovalRate}%`} hint={t("dash.stat.autoApproval.hint", { minutes: PORTFOLIO.avgReviewMinutes })} tone="seal" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={t("dash.risk.title")}
          description={t("dash.risk.desc")}
        >
          <div className="flex items-end gap-2 sm:gap-4">
            {RISK_TREND.map((p) => (
              <div key={p.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{p.score}</span>
                <div className="flex h-40 w-full items-end justify-center">
                  <div
                    className="w-full max-w-10 rounded-t-sm bg-ink/85"
                    style={{ height: `${(p.score / 80) * 100}%` }}
                  />
                </div>
                <span className="cite text-[11px]">{p.month}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
            <TrendingDown className="size-4 text-seal" />
            {t("dash.risk.note")}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel title={t("dash.readiness.title")}>
            <div className="space-y-4">
              {[
                { label: t("dash.readiness.hotma"), value: PORTFOLIO.hotmaReadiness, tone: "flag" as const },
                { label: t("dash.readiness.nspire"), value: PORTFOLIO.nspireReadiness, tone: "seal" as const },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px]">{r.label}</span>
                    <span className="font-mono text-[13px]">{r.value}%</span>
                  </div>
                  <Meter value={r.value} tone={r.tone} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={t("dash.byProgram.title")}>
            <div className="space-y-3">
              {FINDINGS_BY_PROGRAM.map((f) => (
                <div key={f.program}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px]">{f.program}</span>
                    <span className="font-mono text-[13px]">{f.count}</span>
                  </div>
                  <Meter value={(f.count / maxFindings) * 100} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={t("dash.topRisk.title")}
          description={t("dash.topRisk.desc")}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/properties">
                {t("dash.topRisk.all")} <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {ranked.map((p) => {
              const band = riskBand(p.risk);
              return (
                <li key={p.id}>
                  <Link
                    to="/properties/$propertyId"
                    params={{ propertyId: p.id }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <span className="font-mono text-[19px] tabular-nums">{p.risk}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px]">{p.name}</span>
                      <Cite>
                        {p.city}, {p.state} · {p.units} {t("common.units")} · {p.programs.join(" / ")}
                      </Cite>
                    </span>
                    <Pill tone={band.tone}>{band.label}</Pill>
                    <span className="cite w-full sm:w-auto">
                      {p.openFindings} {t("common.findings")} · {p.overdueRecerts} {t("common.overdueRecerts")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title={t("dash.obligations.title")}>
          <ul className="space-y-3.5">
            {[
              { label: t("dash.obligations.recerts"), value: PORTFOLIO.upcomingRecerts, tone: "flag" as const },
              { label: t("dash.obligations.audits"), value: PORTFOLIO.upcomingAudits, tone: "neutral" as const },
              { label: t("dash.obligations.nspire"), value: 7, tone: "neutral" as const },
              { label: t("dash.obligations.interim"), value: 23, tone: "flag" as const },
              { label: t("dash.obligations.softApproval"), value: 38, tone: "neutral" as const },
            ].map((o) => (
              <li key={o.label} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="text-[13px] text-muted-foreground">{o.label}</span>
                <Pill tone={o.tone}>{o.value}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
