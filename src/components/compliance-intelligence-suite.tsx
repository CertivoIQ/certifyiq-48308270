import { Archive, Building2, ClipboardCheck, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FEATURE_NAMES } from "@/lib/compliance-intelligence.mjs";
import { CertificationReviewPanel } from "@/components/certification-review-panel";
import { FreeReviewLeadGate } from "@/components/FreeReviewLeadGate";

const features: Array<{ name: string; description: string; icon: LucideIcon; to: string }> = [
  { name: FEATURE_NAMES.massReview, description: "Import properties, units, tenant profiles, and documents in bulk.", icon: UploadCloud, to: "/files" },
  { name: FEATURE_NAMES.auditSimulator, description: "Run evidence-backed federal or state audit simulations before a real reviewer arrives.", icon: ClipboardCheck, to: "/audit-readiness" },
  { name: FEATURE_NAMES.portfolioCommandCenter, description: "See property-by-property readiness, risk, findings, and open corrective actions.", icon: Building2, to: "/dashboard" },
  { name: FEATURE_NAMES.evidenceIntelligence, description: "Keep findings tied to the evidence that supports the compliance decision.", icon: FileCheck2, to: "/document-intelligence" },
];

export function ComplianceIntelligenceSuite() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 p-6 md:p-10">
      <section className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" /> CertivoIQ Compliance Intelligence Platform</div>
            <h1 className="text-3xl font-semibold tracking-tight">Compliance Intelligence Suite</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Portfolio onboarding, certification intake, and compliance review remain separate so each step has a clear audit trail.</p>
          </div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map(({ name, description, icon: Icon, to }) => (
          <Link
            key={name}
            to={to}
            className="block cursor-pointer rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">{name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>
      <FreeReviewLeadGate>
        <div className="space-y-6">
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Archive className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium">Certification intake is separate from portfolio onboarding</p>
                <p className="mt-1 text-muted-foreground">Upload and correct certification fields in the dedicated intake workspace, then save the document or save and start review.</p>
                <Link to="/upload-certification" className="mt-3 inline-flex rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">Upload Certification & OCR</Link>
              </div>
            </div>
          </section>
          <CertificationReviewPanel />
        </div>
      </FreeReviewLeadGate>
    </main>
  );
}
