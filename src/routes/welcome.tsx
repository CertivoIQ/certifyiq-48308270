import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PLANS, TRIAL } from "@/lib/platform-data";
import { PlayCircle, ShieldCheck, TrendingDown, Clock, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { VIDEO_CHAPTERS, PENALTY_RISKS, VALUE_MATH, TRIAL_OFFER } from "@/lib/trial-data";
import { useT } from "@/lib/i18n/provider";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "CertivoIQ — Audit-Ready Affordable Housing Compliance" },
      {
        name: "description",
        content:
          "See how CertivoIQ protects your tax credits: AI reviews every LIHTC, HOME, Section 8 and HOTMA certification, cites the rule, and hands your reviewer the correction steps before an audit does.",
      },
      { property: "og:title", content: "CertivoIQ — Protect your tax credits before the auditor arrives" },
      {
        property: "og:description",
        content: "Watch the 3-minute demo, then run a full AI compliance review on 3 certifications free for 7 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/welcome" },
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

function WelcomePage() {
  const t = useT();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
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
              <Link to="/">{t("welcome.nav.open")}</Link>
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
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-[38px] leading-[1.08] sm:text-[52px]">
            {t("welcome.hero.title.pre")}{" "}
            <span className="brand-text">{t("welcome.hero.title.accent")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
            {t("welcome.hero.body")}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/launchpad">{t("welcome.cta.trial")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/files">{t("welcome.cta.sample")}</Link>
            </Button>
          </div>
        </section>

        <section className="mt-12" id="video">
          <Panel bodyClassName="p-0">
            <div className="brand-gradient relative grid aspect-video place-items-center rounded-t-lg">
              <div className="text-center text-primary-foreground">
                <button
                  type="button"
                  onClick={() =>
                    toast.info(t("welcome.video.toast.title"), {
                      description: t("welcome.video.toast.body"),
                    })
                  }
                  className="transition-transform hover:scale-105"
                  aria-label={t("welcome.video.play")}
                >
                  <PlayCircle className="mx-auto size-20" strokeWidth={1.3} />
                </button>
                <p className="mt-4 font-display text-[24px]">
                  {t("welcome.video.title.pre")} Certivo<span className="text-gold">IQ</span>{" "}
                  {t("welcome.video.title.post")}
                </p>
                <p className="mt-1.5 text-[13px] opacity-85">
                  {t("welcome.video.sub")}
                </p>
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
              {VIDEO_CHAPTERS.map((c) => (
                <div key={c.time} className="border-l-2 border-primary/30 pl-3">
                  <p className="cite font-mono">{c.time}</p>
                  <p className="mt-0.5 font-display text-[15px]">{c.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-12">
          <h2 className="text-center font-display text-[30px]">
            {t("welcome.risks.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] leading-relaxed text-muted-foreground">
            {t("welcome.risks.body")}
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {PENALTY_RISKS.map((r) => (
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_MATH.map((v) => (
              <Panel key={v.label} bodyClassName="p-5 text-center">
                <p className="brand-text font-display text-[26px] leading-none">{v.value}</p>
                <p className="mt-2 font-display text-[14.5px]">{v.label}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{v.note}</p>
              </Panel>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[13.5px] leading-relaxed text-muted-foreground">
            {t("welcome.value.body", { offer: TRIAL_OFFER.label })}
          </p>
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
        <p className="cite">CertivoIQ · compliance intelligence for all 50 states</p>
      </footer>
    </div>
  );
}
