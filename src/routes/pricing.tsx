import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Check, Gift, ShieldCheck } from "lucide-react";
import { FOUNDERS_PROMOTION, foundersPromotionAvailable } from "@/lib/founders-promotion";

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
          "CertivoIQ annual platform licensing: Multifamily Enterprise is $65,000 per selected state and PHA is a flat $150,000, with all currently available features included.",
      },
      { property: "og:title", content: "CertivoIQ Platform Pricing" },
      {
        property: "og:description",
        content:
          "Annual organization licensing for affordable-housing enterprises and Public Housing Authorities, with all currently available CertivoIQ platform features included.",
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
  const foundersSpecialAvailable = foundersPromotionAvailable();

  return (
    <PublicShell
      title="Platform pricing"
      subtitle="Annual organization licensing with all currently available CertivoIQ features included"
    >
      <div className="mx-auto max-w-5xl">
        {foundersSpecialAvailable ? (
          <Panel className="mb-5 border-seal/35 bg-seal-soft" bodyClassName="p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex max-w-3xl gap-3">
                <Gift className="mt-0.5 size-6 shrink-0 text-seal" />
                <div>
                  <Pill tone="seal">Founder's Special</Pill>
                  <h2 className="mt-3 font-display text-[24px]">
                    50% off your first 12 months
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                    New customers may apply code{" "}
                    <strong className="font-mono text-foreground">{FOUNDERS_PROMOTION.code}</strong>{" "}
                    during checkout through November 30, 2026. The discount applies to the first
                    annual license term; renewals return to the standard annual price.
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-seal/30 bg-background px-5 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Coupon code
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">{FOUNDERS_PROMOTION.code}</p>
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel className="glow-ring border-primary/40" bodyClassName="p-7 md:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Pill tone="seal">Multifamily Enterprise license</Pill>
                <h2 className="mt-4 font-display text-[28px]">CertivoIQ Multifamily Enterprise</h2>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Multifamily and affordable-housing organizations
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="font-display text-[40px] leading-none">$65,000</p>
                <p className="mt-1 text-[13px] text-muted-foreground">per selected state / year</p>
              </div>
            </div>
            <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground">
              Select every state where the organization operates. Each selected state rule pack is
              licensed at $65,000 annually, with access to all currently available features.
            </p>
          </Panel>

          <Panel className="glow-ring border-primary/40" bodyClassName="p-7 md:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Pill tone="seal">Public Housing Authority license</Pill>
                <h2 className="mt-4 font-display text-[28px]">CertivoIQ PHA</h2>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  Public Housing Authorities and agency-wide PHA operations
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="font-display text-[40px] leading-none">$150,000</p>
                <p className="mt-1 text-[13px] text-muted-foreground">per year</p>
              </div>
            </div>
            <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground">
              One PHA organization-level annual license with access to all currently available
              CertivoIQ platform features, including supported PHA review workflows.
            </p>
          </Panel>
        </div>

        <Panel
          className="mt-5"
          title="Included with either annual license"
          bodyClassName="p-7 md:p-9"
        >
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Pricing is determined by license type and, for Multifamily Enterprise, the number of
            selected operating states. PHA remains a flat annual fee. There are no public feature
            tiers, training products, certificate products, document overages, or separately priced
            API packages.
          </p>

          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {INCLUDED_CAPABILITIES.map((capability) => (
              <li key={capability} className="flex gap-2 text-[13.5px]">
                <Check className="mt-0.5 size-4 shrink-0 text-seal" />
                <span>{capability}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-lg border border-primary/20 bg-accent px-5 py-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-display text-[15px]">Federal baseline scope</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  CertivoIQ evaluates supported federal affordable-housing requirements.
                  State-agency, allocating-agency, local, and project-specific requirements require
                  separate Manual Review. When an unevaluated requirement could change the outcome,
                  CertivoIQ returns Unable to Determine.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/trial">Try CertivoIQ for Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pha">Explore PHA Workflows</Link>
            </Button>
          </div>
        </Panel>

        <Panel className="mt-5" title="Implementation and integrations" bodyClassName="p-5">
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            Implementation requirements are reviewed during contracting. API and
            property-management-system connections are scoped only when the applicable end-to-end
            integration has been verified for the customer&apos;s environment.
          </p>
        </Panel>
      </div>
    </PublicShell>
  );
}

