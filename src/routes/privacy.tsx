import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — CertivoIQ" },
      {
        name: "description",
        content: "How CertivoIQ collects, uses, protects, and discloses information used to provide the service.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/privacy" }],
  }),
  component: PrivacyNotice,
});

function PrivacyNotice() {
  return (
    <PublicShell title="Privacy Notice" subtitle="Effective August 15, 2026">
      <article className="mx-auto max-w-3xl space-y-7 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="font-display text-xl text-foreground">What this notice covers</h2>
          <p className="mt-2">
            This notice explains how CertivoIQ handles information when you visit our website, create an account,
            use CertivoIQ compliance workflows, submit support requests, or purchase a subscription. Enterprise
            agreements may include additional privacy, security, or data-processing terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Information we process</h2>
          <p className="mt-2">Depending on how you use CertivoIQ, we may process:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>account and contact information such as name, business email, role, company, and authentication details;</li>
            <li>portfolio, property, certification, resident, document, and evidence information that authorized users upload or enter;</li>
            <li>support messages, case details, feedback, and related communications;</li>
            <li>subscription, invoice, customer, and transaction identifiers. Payment-card details are handled by our payment provider rather than stored as full card numbers by CertivoIQ;</li>
            <li>technical, security, device, browser, usage, and audit-log information needed to operate and protect the service.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">How we use information</h2>
          <p className="mt-2">We use information to provide, secure, maintain, support, and improve CertivoIQ; authenticate users; process authorized compliance reviews; preserve evidence and audit trails; administer subscriptions; respond to support requests; prevent misuse; and comply with legal obligations.</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Service providers and disclosures</h2>
          <p className="mt-2">
            We may disclose information to service providers that help us host, secure, authenticate, process payments,
            send communications, or operate the platform, subject to their applicable terms and safeguards. We may also
            disclose information when required by law, to protect rights or safety, or as part of a corporate transaction
            subject to appropriate protections. CertivoIQ does not sell uploaded certification or resident files for unrelated advertising.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Data retention and customer control</h2>
          <p className="mt-2">
            We retain information for as long as reasonably necessary to provide the service, preserve required audit or
            transaction records, meet contractual obligations, resolve disputes, and comply with law. Customers should
            upload only information they are authorized to process and should follow their own legal and records-retention obligations.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Security</h2>
          <p className="mt-2">
            CertivoIQ uses administrative and technical safeguards designed to protect information, including access controls
            and audit-oriented workflows. No internet service can guarantee absolute security. Suspected unauthorized access
            or disclosure should be reported promptly through our support channel.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Your requests and choices</h2>
          <p className="mt-2">
            Depending on your location and applicable law, you may have rights to request access, correction, deletion, or
            other action concerning personal information. Account administrators may also control access to organization data.
            To submit a privacy request, use the <Link to="/contact-support" className="text-primary underline underline-offset-4">CertivoIQ contact/support page</Link> and identify the request as privacy-related.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Changes to this notice</h2>
          <p className="mt-2">We may update this notice as the service, vendors, or legal requirements change. The effective date above will be updated when material revisions are published.</p>
        </section>

        <p className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
          This launch notice is intended to describe current product practices in plain language. Contract-specific privacy,
          security, regulatory, and data-processing obligations should be reviewed in the applicable customer agreement.
        </p>
      </article>
    </PublicShell>
  );
}
