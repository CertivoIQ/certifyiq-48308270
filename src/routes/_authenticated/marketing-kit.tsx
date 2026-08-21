import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { PLANS } from "@/lib/platform-data";

export const Route = createFileRoute("/_authenticated/marketing-kit")({
  head: () => ({
    meta: [
      { title: "CertivoIQ Marketing Kit — Printable Intro One-Pager" },
      { name: "description", content: "Printable CertivoIQ introduction leave-behind for sales agents: platform overview, enterprise benefits, non-compliance risk infographics and the landing page link." },
      { property: "og:title", content: "CertivoIQ Marketing Kit — printable intro one-pager" },
      { property: "og:description", content: "Agent-ready, print-optimized CertivoIQ introduction material with infographics and landing page link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingKitPage,
});

const LANDING = "https://certivoiq.com/welcome";

const STATS = [
  { value: "Federal", label: "Supported baseline requirements", tone: "navy" },
  { value: "Versioned", label: "Deterministic rule evaluation", tone: "navy" },
  { value: "Traceable", label: "Findings connected to evidence", tone: "navy" },
  { value: "Agent", label: "Approval and signature controls", tone: "green" },
];

const BARS = [
  { label: "Evidence intake", value: "source documents retained with the review", pct: 100, color: "var(--print-green)" },
  { label: "Federal rule evaluation", value: "versioned and deterministic", pct: 100, color: "var(--print-green)" },
  { label: "Unresolved evidence", value: "Unable to Determine blocks completion", pct: 100, color: "var(--print-amber)" },
  { label: "Review completion", value: "Agent Approval and Agent Signature required", pct: 100, color: "var(--print-green)" },
];

const BENEFITS = [
  "Portfolio-level visibility into traceable findings and review status.",
  "Consistent evaluation using supported, versioned federal requirements.",
  "Evidence remains connected to findings, rule versions, and agent actions.",
  "Unable to Determine safeguards block unsupported or incomplete conclusions.",
  "Authorized compliance agents retain approval and signature authority.",
];

const RISKS = [
  { risk: "Missing or inconsistent evidence", cost: "May require correction or additional documentation" },
  { risk: "Federal requirement conflict", cost: "Returns a cited finding for Manual Review" },
  { risk: "Unevaluated non-federal requirement", cost: "Returns Unable to Determine and identifies the limitation" },
  { risk: "Unapproved review", cost: "Cannot be completed without Agent Approval and Agent Signature" },
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
          <div><h1 className="font-display text-[18px]">Marketing kit — intro leave-behind</h1><p className="text-[12.5px] text-muted-foreground">Same content as the “Cold intro” email. Print or save as PDF for prospect meetings.</p></div>
          <div className="flex items-center gap-2"><Button size="sm" variant="outline" asChild><Link to="/crm"><ArrowLeft className="size-4" /> CRM</Link></Button><Button size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / Save as PDF</Button></div>
        </div>
      </div>
      <article className="print-sheet mx-auto my-8 max-w-3xl rounded-lg border border-border bg-card p-8 shadow-ledger print:my-0">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div><p className="font-display text-[24px] leading-none">Certivo<span className="text-gold">IQ</span></p><p className="mt-1.5 text-[12.5px] text-muted-foreground">Compliance intelligence infrastructure — LIHTC · HOME · Project-Based Section 8 · HOTMA</p></div>
          <p className="text-right text-[11.5px] leading-snug text-muted-foreground">certivoiq.com/welcome<br />Federal baseline compliance intelligence</p>
        </header>
        <section className="print-avoid-break mt-6"><h2 className="font-display text-[26px] leading-[1.15]">One missed certification can cost <span className="text-reject">years of tax credits</span></h2><p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">CertivoIQ evaluates certification evidence against supported, versioned federal requirements and returns traceable findings or Unable to Determine when evidence or scope is incomplete. An authorized compliance agent retains Agent Approval authority and provides an Agent Signature.</p></section>
        <section className="print-avoid-break mt-6"><h3 className="cite font-mono">WHAT THE PLATFORM DOES</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{STATS.map((s) => <div key={s.label} className="rounded-lg border border-border p-3 text-center"><p className={`font-display text-[22px] leading-none ${s.tone === "green" ? "text-seal" : ""}`}>{s.value}</p><p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{s.label}</p></div>)}</div></section>
        <section className="print-avoid-break mt-6"><h3 className="cite font-mono">TRACEABLE REVIEW WORKFLOW</h3><div className="mt-3 space-y-3">{BARS.map((b) => <div key={b.label}><p className="text-[12.5px] font-medium">{b.label} — <span className="text-muted-foreground">{b.value}</span></p><div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted"><div className="h-3 rounded-full" style={{ width: `${b.pct}%`, backgroundColor: b.color }} /></div></div>)}</div></section>
        <section className="print-avoid-break mt-6"><h3 className="cite font-mono">HOW ENTERPRISES BENEFIT</h3><ul className="mt-3 space-y-2">{BENEFITS.map((b) => <li key={b} className="flex gap-2 text-[13px] leading-relaxed"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gold" />{b}</li>)}</ul></section>
        <section className="print-avoid-break mt-6"><h3 className="cite font-mono">ANNUAL PLATFORM LICENSE</h3><div className="mt-3 divide-y divide-border">{PLANS.map((p) => <div key={p.id} className="flex items-baseline justify-between gap-4 py-2"><div><p className="text-[13px] font-medium">{p.name}</p><p className="text-[11.5px] text-muted-foreground">{p.tagline}</p></div><p className="whitespace-nowrap font-display text-[15px]">{p.price}<span className="text-[11.5px] text-muted-foreground">{p.cadence}</span></p></div>)}</div></section>
        <section className="print-avoid-break mt-6"><h3 className="cite font-mono text-reject">THE COST OF NON-COMPLIANCE</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{RISKS.map((r) => <div key={r.risk} className="border-l-2 border-reject pl-3"><p className="text-[13px] font-medium">{r.risk}</p><p className="mt-0.5 text-[12px] text-reject">{r.cost}</p></div>)}</div></section>
        <section className="print-avoid-break mt-7 rounded-lg border border-primary/25 bg-accent px-5 py-5 text-center"><p className="font-display text-[18px] text-accent-foreground">Request a demonstration of the CertivoIQ federal baseline workflow</p><p className="mt-1.5 text-[13px] text-muted-foreground">One $65,000 annual platform license · all currently available features included</p><p className="mt-3 font-mono text-[14px] font-semibold">{LANDING}</p><Button className="no-print mt-4" asChild><a href={LANDING} target="_blank" rel="noreferrer">Open the landing page</a></Button></section>
        <footer className="mt-6 border-t border-border pt-4"><p className="cite">CertivoIQ · hello@certivoiq.com · Leave-behind for authorized sales-agent use — claims reflect the current federal baseline scope.</p></footer>
      </article>
    </div>
  );
}
