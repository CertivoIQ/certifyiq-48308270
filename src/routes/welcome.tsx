import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PLANS, TRIAL } from "@/lib/platform-data";
import { ShieldCheck, TrendingDown, Clock, Check, AlertTriangle, ChevronRight, Upload, ScanLine, CheckCircle, FileText, Flag } from "lucide-react";
import { PENALTY_RISKS, TRIAL_OFFER } from "@/lib/trial-data";
import CertivoIQVoiceoverVideo from "@/components/CertivoIQVoiceoverVideo";
import { CostComparisonCalculator } from "@/components/CostComparisonCalculator";
import { coverageClaim } from "@/lib/stateCoverageRegistry";

import { useT, useLanguage } from "@/lib/i18n/provider";
import { PENALTY_RISKS_ES } from "@/lib/i18n/marketing-es";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSubscription } from "@/hooks/use-subscription";
import { useViewerState } from "@/hooks/use-viewer-state";



export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "CertivoIQ — Find compliance problems before the auditor does." },
      {
        name: "description",
        content:
          "CertivoIQ uses AI to extract evidence from affordable-housing certification files, applies versioned compliance rules deterministically, and shows exactly why each finding was raised.",
      },
      { property: "og:title", content: "CertivoIQ — Find compliance problems before the auditor does." },
      {
        property: "og:description",
        content:
          "CertivoIQ uses AI to extract evidence from affordable-housing certification files, applies versioned compliance rules deterministically, and shows exactly why each finding was raised.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/welcome" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/welcome" }],
  }),
  component: WelcomePage,
});

const WHY = [
  { icon: ShieldCheck, titleKey: "welcome.why.1.title", bodyKey: "welcome.why.1.body" },
  { icon: TrendingDown, titleKey: "welcome.why.2.title", bodyKey: "welcome.why.2.body" },
  { icon: Clock, titleKey: "welcome.why.3.title", bodyKey: "welcome.why.3.body" },
] as const;

const WORKFLOW = [
  { icon: Upload, labelKey: "welcome.workflow.upload" },
  { icon: ScanLine, labelKey: "welcome.workflow.extract" },
  { icon: CheckCircle, labelKey: "welcome.workflow.check" },
  { icon: FileText, labelKey: "welcome.workflow.evidence" },
  { icon: Flag, labelKey: "welcome.workflow.findings" },
] as const;

function WelcomePage() {
  const t = useT();
  const { lang } = useLanguage();
  const { isActive: isSubscriber } = useSubscription();
  const { state: viewerState } = useViewerState();

  const risks = lang === "es" ? PENALTY_RISKS_ES : PENALTY_RISKS;


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <span className="brand-gradient grid size-8 place-items-center rounded-[8px] font-mono text-[13px] font-bold text-gold">
              IQ
            </span>
            <span className="font-display text-lg leading-none">Certivo<span className="text-gold">IQ</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/contact-support">{t("welcome.nav.support")}</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/pricing">{t("welcome.nav.pricing")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/dashboard">{t("welcome.nav.open")}</Link>
            </Button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12">
        <section className="text-center">
          <Pill tone="seal">
            {t("welcome.pill", { daysLeft: TRIAL.daysLeft, allowed: TRIAL.uploadsAllowed })}
          </Pill>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-[38px] leading-[1.08] sm:text-[56px]">
            {t("welcome.hero.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
            {t("welcome.hero.subtitle")}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={isSubscriber ? "/dashboard" : "/launchpad"}>{t("welcome.hero.cta")}</Link>
            </Button>
            {!isSubscriber && (
              <Button size="lg" variant="outline" asChild>
                <Link to="/demo-dashboard">{t("welcome.cta.sample")}</Link>
              </Button>
            )}
          </div>

          <div className="mt-10" aria-label="CertivoIQ review workflow">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 sm:gap-3">
              {WORKFLOW.map(({ icon: Icon, labelKey }, i) => (
                <div key={labelKey} className="flex items-center gap-2 sm:gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-ledger">
                    <Icon className="size-4 text-primary" />
                    <span className="text-[12.5px] font-medium">{t(labelKey)}</span>
                  </div>
                  {i < WORKFLOW.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 overflow-hidden rounded-lg" id="video">
          <CertivoIQVoiceoverVideo accountState={viewerState} />
        </section>



        <section className="mt-12">
          <h2 className="text-center font-display text-[30px]">
            {t("welcome.risks.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] leading-relaxed text-muted-foreground">
            {t("welcome.risks.body")}
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {risks.map((r) => (
              <Panel key={r.risk} className="lift" bodyClassName="p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-flag" />
                  <div className="min-w-0">
                    <h3 className="font-display text-[16px]">{r.risk}</h3>
                    <p className="mt-1 text-[12px] font-medium text-reject">{r.cost}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center font-display text-[30px]">{t("welcome.value.title")}</h2>
          <p className="mx-auto mb-6 mt-3 max-w-2xl text-center text-[13.5px] leading-relaxed text-muted-foreground">
            {t("welcome.value.body", { offer: TRIAL_OFFER.label })}
          </p>
          <CostComparisonCalculator />
        </section>



        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {WHY.map(({ icon: Icon, titleKey, bodyKey }) => (
            <Panel key={titleKey} className="lift" bodyClassName="p-6">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-[18px]">{t(titleKey)}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
            </Panel>
          ))}
        </section>

        <section className="mt-12 rounded-lg border border-primary/25 bg-accent px-6 py-8 text-center">
          <h2 className="font-display text-[26px] text-accent-foreground">
            {t("welcome.close.title", { daysLeft: TRIAL.daysLeft })}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] text-muted-foreground">
            {t("welcome.close.body", { plan: PLANS[1]!.name, price: PLANS[1]!.price })}
          </p>
          <ul className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-x-5 gap-y-2">
            {PLANS[1]!.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-[12.5px]">
                <Check className="size-3.5 text-seal" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="mt-6" size="lg" asChild>
            <Link to="/pricing">{t("welcome.close.cta")}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center">
        <p className="cite">{coverageClaim()}</p>
        <div className="mt-2 flex justify-center gap-4 text-[12.5px]">
          <Link className="underline text-muted-foreground" to="/security">
            Security &amp; AI data use
          </Link>
          <Link className="underline text-muted-foreground" to="/methodology">
            Methodology
          </Link>
        </div>
      </footer>

    </div>
  );
}
