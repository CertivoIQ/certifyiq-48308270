import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketing-kit")({
  head: () => ({
    meta: [
      { title: "CertifyIQ Marketing Kit — Printable Intro One-Pager" },
      {
        name: "description",
        content:
          "Printable CertifyIQ introduction leave-behind for sales agents: platform overview, enterprise benefits, non-compliance risk infographics and the landing page link.",
      },
      { property: "og:title", content: "CertifyIQ Marketing Kit — printable intro one-pager" },
      {
        property: "og:description",
        content: "Agent-ready, print-optimized CertifyIQ introduction material with infographics and landing page link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingKitPage,
});

const LANDING = "https://certifyiq.app/welcome";

const STATS = [
  { value: "4 min", label: "Average AI review per certification", tone: "navy" },
  { value: "50", label: "States with maintained rule packs", tone: "navy" },
  { value: "6", label: "Programs: LIHTC · HOME · S8 · HOTMA · RD · Bond", tone: "navy" },
  { value: "100%", label: "Files scored, cited, human signed off", tone: "green" },
];

const BARS = [
  { label: "Manual file review", value: "~41 min per certification", pct: 100, color: "var(--print-red)" },
  { label: "CertifyIQ AI review", value: "~4 min + human sign-off", pct: 12, color: "var(--print-green)" },
  { label: "Rule checks applied manually", value: "most items, most of the time", pct: 62, color: "var(--print-amber)" },
  { label: "Rule checks applied by CertifyIQ", value: "every item, every time", pct: 100, color: "var(--print-green)" },
];

const BENEFITS = [
  "Portfolio-wide visibility into findings, verdicts and audit readiness across every property and program.",
  "Standardized reviews — identical rule logic applied by every reviewer, in every state.",
  "Higher file throughput without adding compliance headcount.",
  "CertifyIQ Academy training with Certificates of Achievement for new reviewers.",
  "Merlin, the AI compliance assistant, cites the governing rule the moment a reviewer gets stuck.",
];

const RISKS = [
  { risk: "Non-curable §42 findings", cost: "IRS Form 8823 filing and recapture of allocated credits" },
  { risk: "Failed state agency audit", cost: "Repayment agreements, withheld allocations, reputational damage" },
  { risk: "Section 8 / TRACS errors", cost: "Subsidy repayment and HUD-imposed corrective action" },
  { risk: "HOTMA implementation gaps", cost: "Systemic recertification errors across an entire portfolio" },
];

function MarketingKitPage() {
  return (
    <div className="min-h-screen bg-background">
      <style>{`
        .print-sheet { --print-red:#d64545; --print-green:#0f9d58; --print-amber:#b98200; }
        @media print {
          @page { size: letter portrait; margin: 0.55in; }
          html, body { background:#fff !important; }
          .no-print { display:none !important; }
          .print-sheet { box-shadow:none !important; border:0 !important; margin:0 !important; padding:0 !important; max-width:none !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="font-display text-[18px]">Marketing kit — intro leave-behind</h1>
            <p className="text-[12.5px] text-muted-foreground">
              Same content as the “Cold intro” email. Print or save as PDF for prospect meetings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/crm">
                <ArrowLeft className="size-4" /> CRM
              </Link>
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      <article className="print-sheet mx-auto my-8 max-w-3xl rounded-lg border border-border bg-card p-8 shadow-ledger print:my-0">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="font-display text-[24px] leading-none">
              Certify<span className="text-gold">IQ</span>
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Affordable housing compliance platform — LIHTC · HOME · Section 8 · HOTMA · RD · Bond
            </p>
          </div>
          <p className="text-right text-[11.5px] leading-snug text-muted-foreground">
            certifyiq.app/welcome
            <br />
            Compliance intelligence for all 50 states
          </p>
        </header>

        <section className="print-avoid-break mt-6">
          <h2 className="font-display text-[26px] leading-[1.15]">
            One missed certification can cost <span className="text-reject">years of tax credits</span>
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
            CertifyIQ reviews every tenant income certification against the exact rule pack assigned to that property
            and returns a Pass or Fail score with cited findings and written correction steps — before an auditor ever
            sees the file. A human reviewer keeps final sign-off authority.
          </p>
        </section>

        <section className="print-avoid-break mt-6">
          <h3 className="cite font-mono">WHAT THE PLATFORM DOES</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3 text-center">
                <p className={`font-display text-[22px] leading-none ${s.tone === "green" ? "text-seal" : ""}`}>
                  {s.value}
                </p>
                <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="print-avoid-break mt-6">
          <h3 className="cite font-mono">MANUAL REVIEW VS. CERTIFYIQ</h3>
          <div className="mt-3 space-y-3">
            {BARS.map((b) => (
              <div key={b.label}>
                <p className="text-[12.5px] font-medium">
                  {b.label} — <span className="text-muted-foreground">{b.value}</span>
                </p>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-3 rounded-full" style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="print-avoid-break mt-6">
          <h3 className="cite font-mono">HOW ENTERPRISES BENEFIT</h3>
          <ul className="mt-3 space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-2 text-[13px] leading-relaxed">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gold" />
                {b}
              </li>
            ))}
          </ul>
        </section>

        <section className="print-avoid-break mt-6">
          <h3 className="cite font-mono text-reject">THE COST OF NON-COMPLIANCE</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {RISKS.map((r) => (
              <div key={r.risk} className="border-l-2 border-reject pl-3">
                <p className="text-[13px] font-medium">{r.risk}</p>
                <p className="mt-0.5 text-[12px] text-reject">{r.cost}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="print-avoid-break mt-7 rounded-lg border border-primary/25 bg-accent px-5 py-5 text-center">
          <p className="font-display text-[18px] text-accent-foreground">
            Watch the 4-minute walkthrough, then run 3 full AI reviews free for 7 days
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            No card required · files retained 14 days after trial
          </p>
          <p className="mt-3 font-mono text-[14px] font-semibold">{LANDING}</p>
          <Button className="no-print mt-4" asChild>
            <a href={LANDING} target="_blank" rel="noreferrer">
              Open the landing page
            </a>
          </Button>
        </section>

        <footer className="mt-6 border-t border-border pt-4">
          <p className="cite">
            CertifyIQ · hello@certifyiq.app · Leave-behind for agent use — figures reflect platform benchmarks.
          </p>
        </footer>
      </article>
    </div>
  );
}
