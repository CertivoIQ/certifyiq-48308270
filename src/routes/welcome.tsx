import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import CertivoIQVoiceoverVideo from "@/components/CertivoIQVoiceoverVideo";
import { CostComparisonCalculator } from "@/components/CostComparisonCalculator";
import { TRIAL } from "@/lib/platform-data";
import { coverageClaim } from "@/lib/stateCoverageRegistry";
import { useSubscription } from "@/hooks/use-subscription";
import { useViewerState } from "@/hooks/use-viewer-state";
import { useT } from "@/lib/i18n/provider";
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

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "CertivoIQ — One Analyst. Every Property. 24/7." },
      {
        name: "description",
        content:
          "AI-powered compliance intelligence for affordable housing. CertivoIQ extracts evidence, applies deterministic rules, and keeps human approval at the center.",
      },
      { property: "og:title", content: "CertivoIQ — One Analyst. Every Property. 24/7." },
      {
        property: "og:description",
        content:
          "Scale compliance capacity without scaling administrative burden. AI-powered compliance intelligence. Human-approved decisions.",
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
    title: "Rule exception requires human approval",
    detail: "Potential exception identified; no automatic approval applied.",
    source: "Certification history · record 18",
  },
] as const;

const FLOW = [
  { icon: FileSearch, label: "AI extracts" },
  { icon: Workflow, label: "Rules evaluate" },
  { icon: FileCheck2, label: "Evidence connects" },
  { icon: ShieldCheck, label: "Human approves" },
] as const;

function WelcomePage() {
  const t = useT();
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
            <a href="#value" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">Value</a>
            <Link to="/pricing" className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild><Link to="/auth">Sign in</Link></Button>
            <Button size="sm" asChild><Link to={isSubscriber ? "/dashboard" : "/launchpad"}>Start free review</Link></Button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
            <div>
              <Pill tone="seal">AI-powered compliance intelligence · human-approved decisions</Pill>
              <h1 className="mt-6 max-w-4xl font-display text-[48px] leading-[.98] tracking-[-0.035em] sm:text-[64px] lg:text-[76px]">
                ONE ANALYST.<br />EVERY PROPERTY.<br /><span className="text-gold">24/7.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-[18px] leading-8 text-muted-foreground">
                Your portfolio doesn't need more spreadsheets. It needs intelligence. CertivoIQ turns certification files into traceable compliance findings so your team can review risk before it becomes an audit problem.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild><Link to={isSubscriber ? "/dashboard" : "/launchpad"}>Review my files free <ArrowRight className="ml-2 size-4" /></Link></Button>
                <Button size="lg" variant="outline" asChild><a href="#how-it-works">See how it works</a></Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-seal" /> No phone call required</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-seal" /> Human approval stays in control</span>
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-seal" /> Start with {TRIAL.uploadsAllowed} free reviews</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rounded-[28px] bg-gold/10 blur-2xl" />
              <Panel className="relative overflow-hidden border-gold/20 bg-card shadow-2xl" bodyClassName="p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Compliance Analyst</p><p className="mt-1 font-display text-lg">Certification review</p></div>
                  <span className="rounded-full border border-seal/30 bg-seal/10 px-2.5 py-1 text-[10px] font-semibold text-seal">LIVE REVIEW</span>
                </div>
                <div className="border-b border-border bg-muted/30 px-5 py-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>Meridian Gardens · Unit 214</span><span>3 findings</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-[76%] rounded-full bg-gold" /></div>
                </div>
                <div className="divide-y divide-border">
                  {SAMPLE_FINDINGS.map((finding) => (
                    <div key={finding.title} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        {finding.status === "pass" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-seal" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-flag" />}
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
                  <span className="text-[11px] text-muted-foreground">AI extraction complete · rule evaluation complete</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gold"><Fingerprint className="size-3.5" /> Human approval required</span>
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
            <Pill tone="seal">The workflow</Pill>
            <h2 className="mt-4 font-display text-[38px] leading-tight sm:text-[50px]">AI does the reading.<br />Your team owns the decision.</h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">CertivoIQ is deliberately not a black box. Automation handles the repetitive evidence work; deterministic rules make the evaluation explainable; a human keeps final approval authority.</p>
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
                  {index === 3 && "Review, resolve, and approve with a defensible trail."}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="evidence" className="bg-foreground text-background">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
            <div>
              <Pill tone="seal">Built for defensibility</Pill>
              <h2 className="mt-5 font-display text-[38px] leading-tight sm:text-[50px]">Don't just get an answer.<br /><span className="text-gold">Know why.</span></h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-background/65">A useful compliance intelligence system should make the path from document to decision visible. CertivoIQ is designed around evidence lineage, versioned rules, and human review.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {["Source evidence stays attached to the finding","Rule evaluation is deterministic and explainable","Exceptions are surfaced for human review","Approval remains a deliberate human action"].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 rounded-lg border border-background/10 bg-background/5 p-3 text-[12.5px] text-background/80"><Check className="mt-0.5 size-4 shrink-0 text-gold" />{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-background/10 bg-background/5 p-4"><CertivoIQVoiceoverVideo accountState={viewerState} /></div>
          </div>
        </section>

        <section id="value" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div>
              <Pill tone="seal">The business case</Pill>
              <h2 className="mt-4 font-display text-[38px] leading-tight sm:text-[48px]">Scale compliance capacity without scaling administrative burden.</h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">Use your own staffing and portfolio numbers to see the operational opportunity. CertivoIQ does not promise that automation eliminates jobs or guarantees avoided findings.</p>
              <div className="mt-6 rounded-xl border border-border bg-card p-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-gold" /><div><p className="font-display text-lg">Turn compliance capacity into profitability.</p><p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">Give your existing team more review capacity, better visibility, and a clearer path from risk to resolution.</p></div></div></div>
            </div>
            <CostComparisonCalculator />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          <div className="rounded-2xl border border-gold/25 bg-accent px-6 py-10 text-center sm:px-10">
            <Pill tone="seal">Start without a sales call</Pill>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-[34px] leading-tight sm:text-[46px]">See what CertivoIQ catches in your files.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">Start with {TRIAL.uploadsAllowed} free certification reviews. Bring your own files, inspect the evidence trail, and decide whether CertivoIQ deserves a place in your compliance workflow.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3"><Button size="lg" asChild><Link to={isSubscriber ? "/dashboard" : "/launchpad"}>Start my free review <ArrowRight className="ml-2 size-4" /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/pricing">View plans</Link></Button></div>
            <p className="mt-4 text-[11px] text-muted-foreground">{t("welcome.pill", { daysLeft: TRIAL.daysLeft, allowed: TRIAL.uploadsAllowed })}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-center sm:flex-row sm:text-left lg:px-8">
          <div><p className="font-display text-sm">Certivo<span className="text-gold">IQ</span></p><p className="mt-1 text-[11px] text-muted-foreground">ONE ANALYST. EVERY PROPERTY. 24/7.</p></div>
          <div className="flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground sm:justify-end"><Link className="underline" to="/security">Security &amp; AI data use</Link><Link className="underline" to="/methodology">Methodology</Link><Link className="underline" to="/contact-support">Contact</Link></div>
        </div>
        <p className="cite mt-4 text-center">{coverageClaim()}</p>
      </footer>
    </div>
  );
}
