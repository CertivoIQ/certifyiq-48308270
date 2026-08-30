import { Archive, Building2, ClipboardCheck, FileCheck2, Gauge, History, Plug, Send, ShieldCheck, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FEATURE_NAMES } from "@/lib/compliance-intelligence.mjs";
import { CertificationReviewPanel } from "@/components/certification-review-panel";
import { PortfolioIntakePanel } from "@/components/portfolio-intake-panel";
import { FreeReviewLeadGate } from "@/components/FreeReviewLeadGate";

const features: Array<{ name: string; description: string; icon: LucideIcon }> = [
  { name: FEATURE_NAMES.massReview, description: "Import properties, units, tenant profiles, and documents in bulk. Clients decide which certifications enter review.", icon: UploadCloud },
  { name: FEATURE_NAMES.auditSimulator, description: "Run evidence-backed federal or state audit simulations before a real reviewer arrives.", icon: ClipboardCheck },
  { name: FEATURE_NAMES.portfolioCommandCenter, description: "See property-by-property readiness, risk, findings, and open corrective actions.", icon: Building2 },
  { name: FEATURE_NAMES.submissionCenter, description: "Prepare authority submission packages after mandatory human approval.", icon: Send },
  { name: FEATURE_NAMES.pmsHub, description: "Connect normalized property and certification data from supported PMS providers.", icon: Plug },
  { name: FEATURE_NAMES.evidenceIntelligence, description: "Keep findings tied to the evidence that supports the compliance decision.", icon: FileCheck2 },
];

const summaryCards: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Certification History Intelligence™", icon: History },
  { label: "Audit Readiness Score™", icon: Gauge },
  { label: "Compliance Approval Center™", icon: ShieldCheck },
];

export function ComplianceIntelligenceSuite() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 p-6 md:p-10">
      <section className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" /> CertivoIQ Compliance Intelligence Platform</div>
            <h1 className="text-3xl font-semibold tracking-tight">Compliance Intelligence Suite</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Import portfolio data first, choose certifications for review second, and preserve human control over every compliance decision.</p>
          </div>
          <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm"><div className="font-medium">Client-controlled review queue</div><div className="mt-1 text-muted-foreground">No certification is reviewed merely because it was uploaded.</div></div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map(({ name, description, icon: Icon }) => <article key={name} className="rounded-2xl border bg-card p-5 shadow-sm"><Icon className="mb-4 h-6 w-6 text-primary" /><h2 className="font-semibold">{name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></article>)}
      </section>
      <FreeReviewLeadGate>
        <div className="space-y-6">
          <PortfolioIntakePanel />
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <div className="flex items-start gap-3"><Archive className="mt-0.5 size-5 text-primary" /><div><p className="font-medium">Review is optional after intake</p><p className="mt-1 text-muted-foreground">Select one or more imported tenants or certifications below only when you want CertivoIQ to run compliance review. Multi-select queues run in original upload order.</p></div></div>
          </section>
          <CertificationReviewPanel />
        </div>
      </FreeReviewLeadGate>
      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map(({ label, icon: Icon }) => <div key={label} className="rounded-2xl border bg-card p-5"><Icon className="mb-3 h-5 w-5 text-primary" /><div className="font-medium">{label}</div><p className="mt-1 text-sm text-muted-foreground">Built into the compliance workflow and preserved with the audit trail.</p></div>)}
      </section>
    </main>
  );
}
