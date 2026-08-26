import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

/**
 * Public Security and Data Use center.
 *
 * Every published claim must exist in `publishedSecurityFacts` with an
 * evidence link, a verification date and a named owner. Sections with no
 * verified fact render as "Documentation in progress" rather than a claim.
 * Certifications (SOC 2, HIPAA, FedRAMP, ISO, PCI) are never stated here
 * unless formally achieved and in scope.
 */

export type SecurityFact = {
  id: string;
  statement: string;
  evidenceUrl: string;
  verifiedAt: string;
  owner: string;
};

/** Populate only after technical and legal verification. */
export const publishedSecurityFacts: SecurityFact[] = [];

type Section = { id: string; heading: string; intent: string };

const SECTIONS: Section[] = [
  { id: "data-collected", heading: "Data collected and purpose", intent: "What CertivoIQ receives, why it is needed for a compliance determination, and who inside the customer organization can submit it." },
  { id: "encryption", heading: "Encryption in transit and at rest", intent: "Transport and storage protections, published only after infrastructure verification." },
  { id: "isolation", heading: "Tenant isolation and authorization model", intent: "How one customer's files, reviews and evidence are separated, and how row-level authorization is enforced." },
  { id: "authentication", heading: "Authentication, MFA, SSO and session controls", intent: "Sign-in methods, multi-factor enrollment, recovery codes and session lifetime." },
  { id: "audit-logs", heading: "Audit logs", intent: "What is recorded for review actions, sign-off, exports and administrative changes, and how long it is kept." },
  { id: "retention", heading: "Retention, deletion, trial data and backups", intent: "Retention windows, deletion requests, trial-upload purge timing and backup handling." },
  { id: "processing", heading: "Processing providers, system use, training policy and Manual Review", intent: "Which services perform extraction, whether customer content is used for training, and where Agent Approval is required." },
  { id: "subprocessors", heading: "Subprocessors and hosting regions", intent: "The processors involved in delivering the service and the regions where data is processed." },
  { id: "incident", heading: "Incident response and contact", intent: "How incidents are triaged, who is notified, and the timeline commitments once documented." },
  { id: "vulnerability", heading: "Vulnerability reporting", intent: "How to report a suspected vulnerability and what response to expect." },
  { id: "continuity", heading: "Business continuity and recovery", intent: "Recovery objectives and continuity testing, published only once tested." },
  { id: "documents", heading: "DPA and security-document request", intent: "How to request a data processing agreement or a completed security questionnaire." },
];

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & Data Use — CertivoIQ" },
      {
        name: "description",
        content:
          "Affordable Housing Compliance Intelligence: how CertivoIQ handles compliance data — tenant isolation, authentication, retention, automated processing, subprocessors, incident response and vulnerability reporting.",
      },
      { property: "og:title", content: "Security & Data Use — CertivoIQ" },
      {
        property: "og:description",
        content: "Verified statements only. CertivoIQ publishes no security certification it has not formally achieved.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://certivoiq.com/security" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/security" }],
  }),
  component: SecurityCenterPage,
});

function factsFor(sectionId: string) {
  return publishedSecurityFacts.filter((fact) => fact.id.startsWith(sectionId));
}

function SecurityCenterPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-11 w-auto object-contain dark:hidden" /><img src="/certivoiq-logo-dark.png" alt="" aria-hidden="true" className="hidden h-11 w-auto object-contain dark:block" />
          </Link>
          <Button size="sm" variant="outline" asChild>
            <Link to="/methodology">Methodology</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <ShieldCheck className="size-6 text-primary" />
        <h1 className="mt-3 font-display text-[34px] leading-tight">Security &amp; Data Use</h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted-foreground">
          This page publishes only statements that have been technically and legally verified, each
          with an evidence reference, a verification date and an accountable owner. Where a section
          shows “Documentation in progress”, CertivoIQ has not yet verified a statement it is willing
          to stand behind — treat the absence as an open question, not as an assurance.
        </p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
          CertivoIQ does not hold SOC 2, HIPAA, FedRAMP, ISO 27001 or PCI attestation, and makes no
          such claim anywhere in this product or its marketing material.
        </p>

        <div className="mt-8 space-y-3">
          {SECTIONS.map((section) => {
            const facts = factsFor(section.id);
            return (
              <Panel key={section.id} bodyClassName="p-5">
                <h2 id={section.id} className="font-display text-[17px]">
                  {section.heading}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {section.intent}
                </p>
                {facts.length ? (
                  <ul className="mt-3 space-y-2">
                    {facts.map((fact) => (
                      <li key={fact.id} className="text-[13.5px] leading-relaxed">
                        {fact.statement}
                        <span className="cite ml-2">
                          verified {fact.verifiedAt} · {fact.owner} ·{" "}
                          <a className="underline" href={fact.evidenceUrl}>
                            evidence
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[13px] font-medium text-flag">Documentation in progress</p>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel className="mt-6" bodyClassName="p-5">
          <h2 className="font-display text-[17px]">Contact</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            Security questions, vulnerability reports, DPA requests and completed questionnaires:{" "}
            <Link className="underline" to="/contact-support">
              contact CertivoIQ support
            </Link>
            . Report a suspected vulnerability before disclosing it publicly and include reproduction
            steps.
          </p>
        </Panel>
      </main>
    </div>
  );
}
