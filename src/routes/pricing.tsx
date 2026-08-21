import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck } from "lucide-react";

const INCLUDED_CAPABILITIES = [
  "Federal baseline certification review",
  "Traceable findings connected to source evidence",
  "Versioned federal rule evaluation",
  "Unable to Determine safeguards for incomplete or conflicting evidence",
  "Manual Review and Agent Verification workflow",
  "Agent Approval and Agent Signature controls",
  "Portfolio-level compliance visibility",
  "Evidence-manifest export for completed reviews",
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Platform Pricing — CertivoIQ" },
      {
        name: "description",
        content:
          "CertivoIQ is available through one $65,000 annual platform license with all currently available features included.",
      },
      { property: "og:title", content: "CertivoIQ Platform Pricing" },
      {
        property: "og:description",
        content:
          "One annual license. All currently available CertivoIQ platform features included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <PublicShell
      title="Platform pricing"
      subtitle="One annual license for the complete CertivoIQ platform"
    >
      <div className="mx-auto max-w-3xl">
        <Panel className="glow-ring border-primary/40" bodyClassName="p-7 md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Pill tone="seal">Annual platform license</Pill>
              <h2 className="mt-4 font-display text-[28px]">CertivoIQ</h2>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                Compliance intelligence infrastructure for affordable housing programs
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="font-display text-[40px] leading-none">$65,000</p>
              <p className="mt-1 text-[13px] text-muted-foreground">per year</p>
            </div>
          </div>

          <div className="mt-7 border-t border-border pt-6">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Every customer receives access to all currently available platform features. There
              are no public plan tiers, training products, certificate products, state-pack
              add-ons, document overages, or separately priced API packages.
            </p>

            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {INCLUDED_CAPABILITIES.map((capability) => (
                <li key={capability} className="flex gap-2 text-[13.5px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-seal" />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 rounded-lg border border-primary/20 bg-accent px-5 py-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-display text-[15px]">Federal baseline scope</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  CertivoIQ evaluates supported federal affordable-housing requirements.
                  State-agency, allocating-agency, local, and project-specific requirements
                  require separate Manual Review. When an unevaluated requirement could change
                  the outcome, CertivoIQ returns Unable to Determine.
                </p>
              </div>
            </div>
          </div>

          <Button className="mt-7 w-full sm:w-auto" size="lg" asChild>
            <Link to="/contact-support">Request a Demo</Link>
          </Button>
        </Panel>

        <Panel className="mt-5" title="Implementation and integrations" bodyClassName="p-5">
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            Implementation requirements are reviewed during contracting. API and
            property-management-system connections are scoped only when the applicable
            end-to-end integration has been verified for the customer&apos;s environment.
          </p>
        </Panel>
      </div>
    </PublicShell>
  );
}
