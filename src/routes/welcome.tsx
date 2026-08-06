import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PLANS, TRIAL } from "@/lib/platform-data";
import { PlayCircle, ShieldCheck, TrendingDown, Clock, Check } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "CertifyIQ — Audit-Ready Affordable Housing Compliance" },
      {
        name: "description",
        content:
          "See how CertifyIQ protects your tax credits: AI reviews every LIHTC, HOME, Section 8 and HOTMA certification, cites the rule, and hands your reviewer the correction steps before an audit does.",
      },
      { property: "og:title", content: "CertifyIQ — Protect your tax credits before the auditor arrives" },
      {
        property: "og:description",
        content: "Watch the 3-minute demo, then run a full AI compliance review on 3 certifications free for 7 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const WHY = [
  {
    icon: ShieldCheck,
    title: "Tax credits stay intact",
    body: "A single uncorrected §42 finding can trigger IRS Form 8823 and put allocated credits at risk. CertifyIQ catches it while it is still curable.",
  },
  {
    icon: TrendingDown,
    title: "Fewer audit findings",
    body: "Every certification is scored Pass or Fail against the exact rule pack assigned to that property, with the correction steps written out.",
  },
  {
    icon: Clock,
    title: "Minutes, not hours",
    body: "Reviews drop from ~41 minutes of manual file work to about 4 minutes, with a human keeping final sign-off authority.",
  },
];

function WelcomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="brand-gradient grid size-8 place-items-center rounded-[8px] font-mono text-[13px] font-bold text-gold">
              IQ
            </span>
            <span className="font-display text-lg leading-none">Certify<span className="text-gold">IQ</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/">Open the platform</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12">
        <section className="text-center">
          <Pill tone="seal">
            {TRIAL.daysLeft} days left · {TRIAL.uploadsAllowed} free AI certification reviews
          </Pill>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-[38px] leading-[1.08] sm:text-[52px]">
            The operating system for <span className="brand-text">affordable housing compliance</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
            CertifyIQ reviews LIHTC, HOME, Section 8 and HOTMA certifications against the rule pack assigned to each
            property, returns a Pass or Fail score with cited findings and correction steps, and routes it to a human for
            final approval.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/launchpad">Start your 7-day trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/files">See a reviewed certification</Link>
            </Button>
          </div>
        </section>

        <section className="mt-12">
          <Panel bodyClassName="p-0">
            <div className="brand-gradient relative grid aspect-video place-items-center rounded-t-lg">
              <div className="text-center text-primary-foreground">
                <PlayCircle className="mx-auto size-16" strokeWidth={1.4} />
                <p className="mt-4 font-display text-[22px]">How CertifyIQ works — 3 minute walkthrough</p>
                <p className="mt-1.5 text-[13px] opacity-85">
                  Upload a TIC · AI extracts and cites · rules engine scores it · reviewer signs off
                </p>
              </div>
            </div>
            <div className="grid gap-3 px-6 py-5 sm:grid-cols-4">
              {[
                "1 · Register the property and select its programs",
                "2 · Drop in certifications and supporting documents",
                "3 · AI review returns Pass/Fail with cited findings",
                "4 · Human reviewer gives final sign-off",
              ].map((s) => (
                <p key={s} className="text-[12.5px] text-muted-foreground">
                  {s}
                </p>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body }) => (
            <Panel key={title} className="lift" bodyClassName="p-6">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-[18px]">{title}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
            </Panel>
          ))}
        </section>

        <section className="mt-12 rounded-lg border border-primary/25 bg-accent px-6 py-8 text-center">
          <h2 className="font-display text-[26px] text-accent-foreground">Your trial ends in {TRIAL.daysLeft} days</h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] text-muted-foreground">
            After the trial, keep unlimited certification reviews, state rule packs and Academy training on the{" "}
            {PLANS[1]!.name} plan at {PLANS[1]!.price}/month.
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
            <Link to="/pricing">Purchase a plan</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center">
        <p className="cite">CertifyIQ · compliance intelligence for all 50 states</p>
      </footer>
    </div>
  );
}
