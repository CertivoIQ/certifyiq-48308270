import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import CertivoIQVoiceoverVideo from "@/components/CertivoIQVoiceoverVideo";
import { CostComparisonCalculator } from "@/components/CostComparisonCalculator";
import { coverageClaim } from "@/lib/stateCoverageRegistry";
import { useSubscription } from "@/hooks/use-subscription";
import { useViewerState } from "@/hooks/use-viewer-state";
import {
  ArrowRight,
  Check,
  CircleCheck,
  FileCheck2,
  FileSearch,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
} from "lucide-react";

const FREE_REVIEW_COUNT = 3;

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "CertivoIQ — Find compliance risk before the auditor." },
      {
        name: "description",
        content:
          "The compliance intelligence infrastructure for affordable housing. Upload certification files, surface traceable findings, and see the evidence behind every result.",
      },
      { property: "og:title", content: "CertivoIQ — Find compliance risk before the auditor." },
      {
        property: "og:description",
        content:
          "Upload certification files, surface traceable compliance findings, and review the evidence before a missed issue becomes an expensive problem.",
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

const SAMPLE_FINDINGS = [
  {
    status: "flag",
    title: "Income evidence needs review",
    detail: "Source document conflicts with the certification value.",
    source: "Income certification · page 3",
  },
  {
    status: "pass",
    title: "Required household evidence present",
    detail: "Required supporting document is present and traceable.",
    source: "Verification document · page 2",
  },
  {
    status: "flag",
    title: "Rule exception surfaced for review",
    detail: "Potential exception identified; result is flagged, not resolved.",
    source: "Certification history · record 18",
  },
] as const;

const FLOW = [
  { icon: FileSearch, label: "Extract" },
  { icon: Workflow, label: "Evaluate" },
  { icon: FileCheck2, label: "Connect evidence" },
  { icon: ShieldCheck, label: "Resolve" },
] as const;

const EXECUTIVE_OUTCOMES = [
  { title: "See the risk earlier", detail: "Surface missing evidence, inconsistencies, and exceptions while your team still has time to investigate." },
  { title: "Defend the decision", detail: "Keep the finding connected to the source evidence, rule version, and reviewer action." },
  { title: "Standardize review", detail: "Apply the same deterministic rule logic across properties, teams, and certification files." },
  { title: "Scale capacity", detail: "Give compliance leaders more review capacity without turning the workflow into another administrative burden." },
] as const;

const PROGRAMS = ["LIHTC (IRC §42)", "Project-Based Section 8", "HOME", "HOTMA income & asset provisions"] as const;

function WelcomePage() {
  const { isActive: isSubscriber } = useSubscription();
  const { state: viewerState } = useViewerState();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <span className="brand-gradient grid size-8 place-items-center rounded-[8px] font-mono text-[13px] font-bold text-gold">IQ</span>
            <span className="font-display text-lg leading-none tracking-tight">Certivo<span className="text-gold">IQ</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#how-it-works" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#evidence" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">Evidence</a>
            <a href="#leaders" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">For portfolio leaders</a>
            <a href="#value" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">Value</a>
            <Link to="/pricing" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild><Link to="/auth">Sign in</Link></Button>
            <Button size="sm" asChild><Link to={isSubscriber ? "/dashboard" : "/trial"}>TRY CERTIVOIQ FOR FREE</Link></Button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
            <div>
              <Pill tone="neutral">The compliance intelligence infrastructure for affordable housing</Pill>
              <h1 className="mt-6 max-w-4xl font-display text-[48px] leading-[.98] tracking-[-0.035em] sm:text-[64px] lg:text-[76px]">
                FIND COMPLIANCE RISK<br />BEFORE THE <span className="text-gold">AUDITOR.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-[18px] leading-8 text-muted-foreground">
                Upload a certification file. CertivoIQ reads the evidence, applies the versioned rules assigned to that property, and surfaces traceable findings your team can investigate before a missed issue becomes an expensive compliance problem.
              </p>
              <div className="mt-8">
                <div className="flex flex-wrap items-start gap-3">
                  <div>
                    <Button size="lg" asChild><Link to={isSubscriber ? "/dashboard" : "/trial"}>TRY CERTIVOIQ FOR FREE <ArrowRight className="ml-2 size-4" /></Link></Button>
                    <p className="mt-2 text-[12px] font-semibold uppercase tracking-[.14em] text-gold">{FREE_REVIEW_COUNT} FREE CERTIFICATION REVIEWS</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[.14em] text-muted-foreground">NO CREDIT CARD REQUIRED</p>
                  </div>
                  <Button size="lg" variant="outline" asChild><a href="#how-it-works">See how it works</a></Button>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-gold" /> No sales call required</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-gold" /> Findings tied to source evidence</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-gold" /> Nationwide federal baseline; state-specific packs require validation</span>
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card px-3 py-3"><p className="font-mono text-[10px] text-gold">01 · UPLOAD</p><p className="mt-1 text-[12px] font-medium">Bring one certification file</p></div>
                <div className="rounded-lg border border-border bg-card px-3 py-3"><p className="font-mono text-[10px] text-gold">02 · ANALYZE</p><p className="mt-1 text-[12px] font-medium">Get findings tied to evidence</p></div>
                <div className="rounded-lg border border-border bg-card px-3 py-3"><p className="font-mono text-[10px] text-gold">03 · RESOLVE</p><p className="mt-1 text-[12px] font-medium">Work the findings your team sees</p></div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rounded-[28px] bg-gold/10 blur-2xl" />
              <Panel className="relative overflow-hidden border-gold/20 bg-card shadow-2xl" bodyClassName="p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Compliance intelligence</p><p className="mt-1 font-display text-lg">Certification review</p></div>
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold text-gold-ink dark:text-gold">IN REVIEW</span>
                </div>
                <div className="border-b border-border bg-muted/30 px-5 py-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>Meridian Gardens · Unit 214</span><span>3 findings</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-[76%] rounded-full bg-gold" /></div>
                </div>
                <div className="divide-y divide-border">
                  {SAMPLE_FINDINGS.map((finding) => (
                    <div key={finding.title} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        {finding.status === "pass" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-gold-ink dark:text-gold" />}
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold">{finding.title}</p>
                          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{finding.detail}</p>
                          <p className="mt-2 font-mono text-[10px] text-muted-foreground">SOURCE · {finding.source}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-4">
                  <span className="text-[11px] text-muted-foreground">Extraction complete · rule evaluation complete</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gold"><Fingerprint className="size-3.5" /> Evidence trail attached</span>
                </div>
              </Panel>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:grid-cols-3 lg:px-8">
            <div className="border-b border-border px-4 py-7 sm:border-b-0 sm:border-r"><p className="font-display text-xl">Catch issues earlier</p><p className="mt-1.5 text-[12.5px] text-muted-foreground">Surface missing evidence, inconsistencies, and rule conflicts before the file reaches an auditor.</p></div>
            <div className="border-b border-border px-4 py-7 sm:border-b-0 sm:border-r"><p className="font-display text-xl">Explain every finding</p><p className="mt-1.5 text-[12.5px] text-muted-foreground">Trace findings back to the source evidence and the rule that produced them.</p></div>
            <div className="px-4 py-7"><p className="font-display text-xl">Scale team capacity</p><p className="mt-1.5 text-[12.5px] text-muted-foreground">Turn compliance capacity into profitability without adding administrative burden.</p></div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <Pill tone="neutral">The workflow</Pill>
            <h2 className="mt-4 font-display text-[38px] leading-tight sm:text-[50px]">Every finding traces back<br />to the document that caused it.</h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">CertivoIQ is deliberately not a black box. Evidence is extracted from the certification file, deterministic versioned rules make the evaluation explainable, and each result is presented with its source.</p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {FLOW.map(({ icon: Icon, label }, index) => (
              <div key={label} className="relative rounded-xl border border-border bg-card p-5">
                <span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span>
                <Icon className="mt-8 size-5 text-gold" />
                <h3 className="mt-3 font-display text-lg">{label}</h3>
                <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
                  {index === 0 && "Read certifications and supporting documents into structured evidence."}
                  {index === 1 && "Apply the assigned, versioned rule set consistently."}
                  {index === 2 && "Keep the source, extracted value, and finding connected."}
                  {index === 3 && "Work findings to resolution with a defensible trail."}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="evidence" className="bg-foreground text-background">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
            <div>
              <Pill tone="neutral">Built for defensibility</Pill>
              <h2 className="mt-5 font-display text-[38px] leading-tight sm:text-[50px]">Don't just get an answer.<br /><span className="text-gold">Know why.</span></h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-background/65">Compliance intelligence should make the path from document to finding visible. CertivoIQ is designed around evidence lineage, versioned rule packs, and a complete record of every action.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {["Source evidence stays attached to the finding","Rule evaluation is deterministic and explainable","Exceptions are surfaced instead of silently resolved","Every action is recorded in the audit trail"].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 rounded-lg border border-background/10 bg-background/5 p-3 text-[12.5px] text-background/80"><Check className="mt-0.5 size-4 shrink-0 text-gold" />{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-background/10 bg-background/5 p-4"><CertivoIQVoiceoverVideo accountState={viewerState} /></div>
          </div>
        </section>

        <section id="leaders" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
            <div>
              <Pill tone="neutral">For portfolio leaders</Pill>
              <h2 className="mt-4 font-display text-[38px] leading-tight sm:text-[50px]">A clearer view of compliance risk across the portfolio.</h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Built for owners, operators, compliance leaders, and property-management teams who need a defensible review process without adding another layer of administrative work.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" asChild><Link to={isSubscriber ? "/dashboard" : "/trial"}>TRY CERTIVOIQ FOR FREE <ArrowRight className="ml-2 size-4" /></Link></Button>
                <Button size="lg" variant="outline" asChild><Link to="/methodology">See the methodology</Link></Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {EXECUTIVE_OUTCOMES.map((item) => (
                <Panel key={item.title} bodyClassName="p-5">
                  <Check className="size-5 text-gold" />
                  <h3 className="mt-4 font-display text-lg">{item.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">{item.detail}</p>
                </Panel>
              ))}
            </div>
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.16em] text-gold">Program scope</p>
                <p className="mt-2 font-display text-lg">Built around the federal program rules your team already works with.</p>
              </div>
              <Link className="text-[12.5px] font-semibold underline" to="/methodology">Review supported programs</Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {PROGRAMS.map((program) => <Pill key={program} tone="neutral">{program}</Pill>)}
            </div>
          </div>
        </section>

        <section id="value" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div>
              <Pill tone="neutral">The business case</Pill>
              <h2 className="mt-4 font-display text-[38px] leading-tight sm:text-[48px]">Scale compliance capacity without scaling administrative burden.</h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Use your own staffing and portfolio numbers to see the operational opportunity. CertivoIQ does not promise that automation eliminates jobs or guarantees avoided findings.</p>
              <div className="mt-6 rounded-xl border border-border bg-card p-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-gold" /><div><p className="font-display text-lg">Turn compliance capacity into profitability.</p><p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">Give your existing team more review capacity, better visibility, and a clearer path from risk to resolution.</p></div></div></div>
            </div>
            <CostComparisonCalculator />
          </div>
        </section>

        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold">Why act before the audit?</p>
              <h2 className="mt-2 max-w-3xl font-display text-[28px] leading-tight sm:text-[34px]">One missed compliance finding can cost more than the system that helps you catch it.</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted-foreground">CertivoIQ is built to surface missing evidence, inconsistencies, and exceptions while your team still has time to investigate and resolve them.</p>
            </div>
            <Button size="lg" asChild><Link to={isSubscriber ? "/dashboard" : "/trial"}>TRY CERTIVOIQ FOR FREE <ArrowRight className="ml-2 size-4" /></Link></Button>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          <div className="rounded-2xl border border-gold/25 bg-accent px-6 py-10 text-center sm:px-10">
            <Pill tone="neutral">Start without a sales call</Pill>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-[34px] leading-tight sm:text-[46px]">Find the compliance issues your current process can miss.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">Start with {FREE_REVIEW_COUNT} FREE certification reviews. Bring your own files, inspect the evidence trail, and decide whether CertivoIQ deserves a place in your compliance workflow.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3"><Button size="lg" asChild><Link to={isSubscriber ? "/dashboard" : "/trial"}>TRY CERTIVOIQ FOR FREE <ArrowRight className="ml-2 size-4" /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/pricing">View plans</Link></Button></div>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[.14em] text-gold">{FREE_REVIEW_COUNT} FREE CERTIFICATION REVIEWS</p>
            <p className="mt-1 text-[11px] uppercase tracking-[.14em] text-muted-foreground">NO CREDIT CARD REQUIRED</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-center sm:flex-row sm:text-left lg:px-8">
          <div><p className="font-display text-sm">Certivo<span className="text-gold">IQ</span></p><p className="mt-1 text-[11px] text-muted-foreground">FIND COMPLIANCE RISK BEFORE THE AUDITOR.</p></div>
          <div className="flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground sm:justify-end"><Link className="underline" to="/security">Security &amp; data use</Link><Link className="underline" to="/methodology">Methodology</Link><Link className="underline" to="/contact-support">Contact</Link></div>
        </div>
        <p className="cite mt-4 text-center">{coverageClaim()}</p>
      </footer>
    </div>
  );
}
