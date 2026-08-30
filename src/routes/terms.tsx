import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { COMMERCIAL_TERMS } from "@/lib/plan-catalog";

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — CertivoIQ" },
      {
        name: "description",
        content: "Terms governing access to, licensing of, and use of the CertivoIQ service.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/terms" }],
  }),
  component: TermsOfUse,
});

function TermsOfUse() {
  return (
    <PublicShell title="Terms of Use" subtitle="Effective August 30, 2026">
      <article className="mx-auto max-w-3xl space-y-7 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="font-display text-xl text-foreground">Agreement and business use</h2>
          <p className="mt-2">
            These Terms govern access to and use of CertivoIQ unless a signed order form, SaaS
            agreement, statement of work, or other written agreement applies. If a signed agreement
            conflicts with these Terms or the public pricing page, the signed agreement controls for
            that customer. You must be authorized to act for the organization whose account or data
            you use.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Platform licenses</h2>
          <p className="mt-2">
            The standard CertivoIQ Multifamily Enterprise license is{" "}
            {usd(COMMERCIAL_TERMS.multifamilyAnnualPerStateUsd)} per selected operating state per
            year. Each state is separately licensed and is subject to the availability and
            activation status of its validated rule guide. The standard CertivoIQ PHA license is{" "}
            {usd(COMMERCIAL_TERMS.phaAnnualUsd)} per organization per year and includes one validated
            operating-state rule guide and the supported PHA workspaces identified in the signed
            scope.
          </p>
          <p className="mt-2">
            Licensed capabilities, programs, jurisdictions, transaction volume, service levels, and
            renewal mechanics are those stated in the applicable order form. Public product
            descriptions identify the standard offer but do not expand a signed scope.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Merlin add-on</h2>
          <p className="mt-2">
            Merlin is an optional organization-wide compliance-intelligence add-on. Its standard
            price is {usd(COMMERCIAL_TERMS.merlinMonthlyUsd)} per month under a{" "}
            {COMMERCIAL_TERMS.merlinAnnualCommitmentMonths}-month agreement, for an annual commitment
            of {usd(COMMERCIAL_TERMS.merlinAnnualUsd)}. If CertivoIQ approves a month-to-month
            arrangement in writing, the standard price is{" "}
            {usd(COMMERCIAL_TERMS.merlinMonthToMonthUsd)} per month.
          </p>
          <p className="mt-2">
            Merlin includes up to{" "}
            {COMMERCIAL_TERMS.merlinMonthlyCertificationCapacity.toLocaleString()} certification or
            recertification analyses per calendar month across the organization&apos;s licensed
            states and programs. Unless the signed order form states otherwise, additional usage is
            billed at {usd(COMMERCIAL_TERMS.merlinOveragePerCertificationUsd)} per certification.
            Unused monthly capacity does not roll over.
          </p>
          <p className="mt-2">
            Merlin may research licensed manuals and rule guides, explain cited requirements,
            identify inconsistencies, prioritize exceptions, and assist with compliance narratives,
            audit responses, and corrective actions. Merlin does not change a deterministic rule
            result, convert Unable to Determine into an approval, or issue final confirmation.
            Findings remain pending final review until an authorized responsible party confirms the
            result with signature and position.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Implementation and additional scope</h2>
          <p className="mt-2">
            The standard one-time implementation fee is{" "}
            {usd(COMMERCIAL_TERMS.implementationOneTimeUsd)} per organization. Standard
            implementation covers initial discovery, organization setup, licensed-state and program
            configuration, rule-guide activation, workflow alignment, administrator enablement, and
            launch validation. Customer-specific integrations, data conversion, expanded training,
            additional implementation phases, or materially changed requirements may require a
            separate statement of work or change order.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Billing, renewals, and evaluation reviews</h2>
          <p className="mt-2">
            Current standard pricing is described on the{" "}
            <Link to="/pricing" className="text-primary underline underline-offset-4">
              pricing page
            </Link>
            . Fees, payment timing, taxes, renewal, cancellation, credits, refunds, procurement
            requirements, and any negotiated capacity are governed by the signed agreement and
            applicable law. The three free certification reviews are a product-evaluation offer for
            qualified leads using an organization website email and do not require a credit card
            where the website expressly states that. CertivoIQ does not authorize automatic material
            refunds through SupportIQ.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">
            Compliance support — not professional advice
          </h2>
          <p className="mt-2">
            CertivoIQ is a compliance-support and workflow platform. It is not a law firm,
            accounting firm, housing agency, auditor, syndicator, or tax adviser. Platform findings,
            calculations, evidence links, readiness scores, explanations, and other outputs support
            an organization&apos;s authorized review process. They do not guarantee compliance,
            agency acceptance, audit results, avoidance of findings, tax-credit recapture, penalties,
            or other outcomes.
          </p>
          <p className="mt-2">
            A matter marked Unable to Determine, conflicting, blocked, or pending final review must
            not be treated as an approval. Final submissions and consequential decisions remain the
            responsibility of the customer&apos;s authorized responsible party under the applicable
            program rules.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Customer data and authorization</h2>
          <p className="mt-2">
            You retain responsibility for the data and documents you submit and for ensuring that
            you have the right to process them. You grant CertivoIQ the limited permission needed to
            host, process, analyze, transmit when expressly authorized, and otherwise handle customer
            content solely to provide and secure the service and meet legal obligations.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Accounts and acceptable use</h2>
          <p className="mt-2">
            You are responsible for protecting account credentials and for activity performed
            through your authorized users. You may not use CertivoIQ to violate law, access data
            without authorization, interfere with security controls, probe other customers&apos;
            data, distribute malware, or misrepresent platform outputs as government or legal
            determinations.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Intellectual property</h2>
          <p className="mt-2">
            CertivoIQ software, product design, documentation, rule-engine implementation, workflows,
            branding, and other proprietary materials are owned by CertivoIQ or its licensors except
            for customer content and third-party materials. Access to the service does not transfer
            ownership of the software or permit copying, reverse engineering, resale, sublicensing,
            or creation of a competing derivative service except where such restriction is prohibited
            by law or expressly authorized in writing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Availability and changes</h2>
          <p className="mt-2">
            We may maintain, improve, secure, suspend, or modify service features. Some integrations,
            jurisdictions, external-delivery methods, or roadmap capabilities may not be generally
            available. Product pages should be read together with any stated limitations, validation
            status, and signed scope.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Privacy and support</h2>
          <p className="mt-2">
            Use of personal information is described in the{" "}
            <Link to="/privacy" className="text-primary underline underline-offset-4">
              Privacy Notice
            </Link>
            . Questions about these Terms or the service may be submitted through the{" "}
            <Link to="/contact-support" className="text-primary underline underline-offset-4">
              contact/support page
            </Link>
            .
          </p>
        </section>

        <p className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
          Enterprise procurement, privacy, security, allocation of risk, indemnity, warranties,
          service levels, and liability should be documented in a signed customer agreement reviewed
          by qualified counsel.
        </p>
      </article>
    </PublicShell>
  );
}
