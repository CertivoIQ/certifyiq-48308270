import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { ArrowRight, Building2, ChartNoAxesCombined, ClipboardCheck, Landmark, MonitorCog, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/pha/")({
  head: () => ({
    meta: [
      { title: "CertivoIQ for Public Housing Agencies" },
      {
        name: "description",
        content:
          "Choose your PHA leadership role to see how CertivoIQ adds independent certification review without replacing your housing-management system.",
      },
      { property: "og:title", content: "CertivoIQ for Public Housing Agencies" },
      {
        property: "og:description",
        content: "Processed by your software. Independently reviewed by CertivoIQ.",
      },
      { property: "og:url", content: "https://certivoiq.com/pha" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/pha" }],
  }),
  component: PhaOverviewPage,
});

const roles = [
  {
    slug: "executive",
    label: "Executive Director / CEO",
    headline: "See agency-wide compliance risk before the audit.",
    cta: "View Executive Leadership",
    icon: Landmark,
  },
  {
    slug: "compliance",
    label: "Compliance / QA Director",
    headline: "Give your review team a consistent, independent review layer.",
    cta: "View Compliance Leadership",
    icon: ShieldCheck,
  },
  {
    slug: "hcv",
    label: "HCV Director",
    headline: "Reduce HCV certification risk before HUD review.",
    cta: "View HCV Leadership",
    icon: ClipboardCheck,
  },
  {
    slug: "public-housing",
    label: "Public Housing Director",
    headline: "Strengthen public housing certification quality.",
    cta: "View Public Housing Leadership",
    icon: Building2,
  },
  {
    slug: "finance-operations",
    label: "CFO / COO",
    headline: "Protect revenue and reduce audit exposure.",
    cta: "View Finance & Operations",
    icon: ChartNoAxesCombined,
  },
  {
    slug: "technology",
    label: "CIO / IT Director",
    headline: "Add independent review without replacing your system.",
    cta: "View Technology Leadership",
    icon: MonitorCog,
  },
] as const;

function PhaOverviewPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/welcome">
            <img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-11 w-auto object-contain dark:hidden" /><img src="/certivoiq-logo-dark.png" alt="" aria-hidden="true" className="hidden h-11 w-auto object-contain dark:block" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild><Link to="/welcome">Main site</Link></Button>
            <Button asChild><Link to="/trial">Try CertivoIQ for Free</Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 py-20 text-center lg:px-8 lg:py-28">
          <Pill tone="neutral">For Public Housing Agencies</Pill>
          <h1 className="mx-auto mt-6 max-w-5xl font-display text-[48px] leading-[1.02] tracking-[-0.035em] sm:text-[68px]">
            PROCESSED BY YOUR SOFTWARE.<br />
            <span className="text-gold">INDEPENDENTLY REVIEWED BY CERTIVOIQ.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-[18px] leading-8 text-muted-foreground">
            Keep Yardi Voyager PHA, Emphasys, MRI PHA Pro, or your existing housing-management platform.
            CertivoIQ adds an independent compliance-review layer around the completed certification.
          </p>
          <p className="mt-10 font-mono text-[11px] uppercase tracking-[.18em] text-gold">
            Choose your role to see the risks, workflow, and demonstration built for you
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map(({ slug, label, headline, cta, icon: Icon }) => (
              <Panel key={slug} className="group h-full transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl" bodyClassName="flex h-full flex-col p-6">
                <Icon className="size-6 text-gold" />
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</p>
                <h2 className="mt-3 font-display text-2xl leading-tight">{headline}</h2>
                <Link
                  to="/pha/$persona"
                  params={{ persona: slug }}
                  className="mt-auto flex items-center gap-2 pt-8 text-[13px] font-semibold text-gold"
                >
                  {cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </Link>
              </Panel>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-5 py-14 text-center lg:px-8">
            <p className="font-display text-3xl">Your operating system processes the transaction. CertivoIQ reviews the compliance risk.</p>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              CertivoIQ does not replace agency judgment or promise that an audit will produce no findings. It gives each decision-maker
              traceable findings, evidence gaps, and exceptions to investigate before review.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
