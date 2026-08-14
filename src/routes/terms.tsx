import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — CertivoIQ" },
      {
        name: "description",
        content: "Launch terms governing access to and use of the CertivoIQ service.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/terms" }],
  }),
  component: TermsOfUse,
});

function TermsOfUse() {
  return (
    <PublicShell title="Terms of Use" subtitle="Effective August 15, 2026">
      <article className="mx-auto max-w-3xl space-y-7 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="font-display text-xl text-foreground">Agreement and business use</h2>
          <p className="mt-2">
            These Terms govern access to and use of CertivoIQ unless a signed order form, SaaS agreement, or other written
            agreement applies. If a signed agreement conflicts with these Terms, the signed agreement controls for that customer.
            You must be authorized to act for the organization whose account or data you use.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Compliance support — not professional advice</h2>
          <p className="mt-2">
            CertivoIQ is a compliance-support and workflow platform. It is not a law firm, accounting firm, housing agency,
            auditor, syndicator, or tax adviser. Platform findings, calculations, evidence links, readiness scores, and other
            outputs are tools for authorized human review. They do not guarantee compliance, agency acceptance, audit results,
            avoidance of findings, tax-credit recapture, penalties, or other outcomes.
          </p>
          <p className="mt-2">
            Where CertivoIQ marks a matter as unable to determine, conflicting, blocked, or requiring human review, users must
            not treat that result as an approval. Final submissions and consequential decisions remain subject to the required
            human authority and applicable program rules.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Customer data and authorization</h2>
          <p className="mt-2">
            You retain responsibility for the data and documents you submit and for ensuring that you have the right to process
            them. You grant CertivoIQ the limited permission needed to host, process, analyze, transmit when expressly authorized,
            and otherwise handle customer content solely to provide and secure the service and meet legal obligations.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Accounts and acceptable use</h2>
          <p className="mt-2">You are responsible for protecting account credentials and for activity performed through your authorized users. You may not use CertivoIQ to violate law, access data without authorization, interfere with security controls, probe other customers' data, distribute malware, or misrepresent platform outputs as government or legal determinations.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Subscriptions, billing, and free reviews</h2>
          <p className="mt-2">
            Current plans, allowances, billing cadence, and available add-ons are described on the <Link to="/pricing" className="text-primary underline underline-offset-4">pricing page</Link> or in a signed order form. Free certification reviews are a product-evaluation offer and do not require a credit card where the website expressly states that. Paid subscriptions and transactions are processed through the configured payment provider. Cancellations, renewals, credits, refunds, and enterprise terms are subject to the applicable checkout terms, billing portal, written agreement, and law. CertivoIQ does not authorize automatic material refunds through its virtual support agent.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Intellectual property</h2>
          <p className="mt-2">
            CertivoIQ software, product design, documentation, rule-engine implementation, workflows, branding, and other
            proprietary materials are owned by CertivoIQ or its licensors except for customer content and third-party materials.
            Access to the service does not transfer ownership of the software or permit copying, reverse engineering, resale,
            sublicensing, or creation of a competing derivative service except where such restriction is prohibited by law or
            expressly authorized in writing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Availability and changes</h2>
          <p className="mt-2">We may maintain, improve, secure, suspend, or modify service features. Some integrations, jurisdictions, external-delivery methods, or roadmap capabilities may not be generally available. Product pages should be read together with any stated limitations, validation status, and signed scope.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Privacy and support</h2>
          <p className="mt-2">
            Use of personal information is described in the <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Notice</Link>. Questions about these Terms or the service may be submitted through the <Link to="/contact-support" className="text-primary underline underline-offset-4">contact/support page</Link>.
          </p>
        </section>

        <p className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
          Enterprise procurement, privacy, security, allocation of risk, indemnity, warranties, service levels, and liability
          should be documented in a signed customer agreement reviewed by qualified counsel.
        </p>
      </article>
    </PublicShell>
  );
}
