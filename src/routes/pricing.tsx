import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { COMMERCIAL_TERMS } from "@/lib/plan-catalog";
import { FOUNDERS_PROMOTION, foundersPromotionAvailable } from "@/lib/founders-promotion";
import { Check, Gift, ShieldCheck } from "lucide-react";

const MULTIFAMILY_FEATURES = [
  "Certification and recertification review across licensed properties",
  "Federal requirements plus validated rule guides for each licensed state",
  "Income, asset, rent, utility-allowance, household, student, and layered-program validations",
  "Document and evidence reconciliation with inconsistency detection",
  "Deterministic Pass, Fail, and Unable to Determine outcomes",
  "Source citations, versioned rules, and a traceable audit record",
  "Portfolio dashboards, exception queues, and evidence-manifest exports",
  "Pending final review controls with responsible-party signature and position",
];

const PHA_FEATURES = [
  "HCV, PBV, public housing, and Mod Rehab operating workspaces",
  "Family intake, eligibility, annual reexamination, and interim reexamination controls",
  "HUD-50058 transaction routing and reporting controls",
  "HCV, PBV, and public-housing waiting-list workflows",
  "Portability, HCV lease-up, and PBV operations",
  "Public-housing admissions, occupancy, and operations",
  "HOTMA implementation and NSPIRE standards and inspection workflows",
  "Reasonable accommodations, notices, agency policies, users, source library, and agency-wide reporting",
];

const MERLIN_FEATURES = [
  "Plain-language research across licensed compliance manuals and rule guides",
  "Citation-backed explanations connected to controlling source material",
  "Cross-document and cross-program inconsistency analysis",
  "Exception prioritization and compliance narrative preparation",
  "Regulatory-change monitoring and candidate rule-update support",
  "Audit-response and corrective-action assistance",
  "Organization-wide access across licensed states and programs",
];

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Platform Pricing — CertivoIQ" },
      {
        name: "description",
        content:
          "CertivoIQ pricing for Multifamily Enterprise, Public Housing Authorities, and the optional Merlin compliance-intelligence add-on.",
      },
      { property: "og:title", content: "CertivoIQ Platform Pricing" },
      {
        property: "og:description",
        content:
          "Compare CertivoIQ Multifamily Enterprise and PHA features, then add Merlin for citation-backed compliance intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/pricing" }],
  }),
  component: PricingPage,
});

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-6 grid gap-3">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2 text-[13.5px] leading-6">
          <Check className="mt-1 size-4 shrink-0 text-seal" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingPage() {
  const foundersSpecialAvailable = foundersPromotionAvailable();

  return (
    <PublicShell
      title="Platform pricing"
      subtitle="Choose the operating platform that matches your organization, then add Merlin when you want deeper compliance intelligence."
    >
      <div className="mx-auto max-w-6xl">
        {foundersSpecialAvailable ? (
          <Panel className="mb-7 border-seal/35 bg-seal-soft" bodyClassName="p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex max-w-3xl gap-3">
                <Gift className="mt-0.5 size-6 shrink-0 text-seal" />
                <div>
                  <Pill tone="seal">Founder&apos;s Special</Pill>
                  <h2 className="mt-3 font-display text-[24px]">
                    50% off your first 12 months
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                    New customers may apply code{" "}
                    <strong className="font-mono text-foreground">{FOUNDERS_PROMOTION.code}</strong>{" "}
                    during checkout through November 30, 2026. The discount applies to the first
                    annual platform-license term; renewals return to the standard annual price.
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

        <section aria-labelledby="product-packages">
          <div className="mb-6 max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[.18em] text-primary">
              Product packages
            </p>
            <h2 id="product-packages" className="mt-2 font-display text-3xl">
              Two operating platforms built for different housing organizations
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
              Multifamily Enterprise is organized around property and portfolio certification risk.
              PHA adds agency-wide HUD program administration workflows that multifamily owners and
              agents generally do not require.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel className="glow-ring border-primary/40" bodyClassName="flex h-full flex-col p-7 md:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Pill tone="seal">Multifamily Enterprise</Pill>
                  <h3 className="mt-4 font-display text-[28px]">CertivoIQ Multifamily Enterprise</h3>
                  <p className="mt-1 text-[13.5px] text-muted-foreground">
                    Owners, agents, management companies, and affordable-housing portfolios
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-display text-[40px] leading-none">
                    {usd(COMMERCIAL_TERMS.multifamilyAnnualPerStateUsd)}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">per selected state / year</p>
                </div>
              </div>
              <FeatureList features={MULTIFAMILY_FEATURES} />
              <p className="mt-6 border-t border-border pt-5 text-[12.5px] leading-6 text-muted-foreground">
                Add each operating state at the same annual rate. The active rule guide and source
                set for every licensed state govern state-specific review.
              </p>
            </Panel>

            <Panel className="glow-ring border-primary/40" bodyClassName="flex h-full flex-col p-7 md:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Pill tone="seal">Public Housing Authority</Pill>
                  <h3 className="mt-4 font-display text-[28px]">CertivoIQ PHA</h3>
                  <p className="mt-1 text-[13.5px] text-muted-foreground">
                    Public Housing Authorities and agency-wide HUD program operations
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-display text-[40px] leading-none">
                    {usd(COMMERCIAL_TERMS.phaAnnualUsd)}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">per organization / year</p>
                </div>
              </div>
              <FeatureList features={PHA_FEATURES} />
              <p className="mt-6 border-t border-border pt-5 text-[12.5px] leading-6 text-muted-foreground">
                The PHA license is a flat organization-level fee and includes one validated
                operating-state rule guide plus supported PHA program workspaces.
              </p>
            </Panel>
          </div>
        </section>

        <Panel className="mt-7 border-gold/40" bodyClassName="p-7 md:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Pill tone="flag">Optional premium add-on</Pill>
              <h2 className="mt-4 font-display text-[32px]">Merlin compliance intelligence</h2>
              <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
                Merlin works across the manuals, procedures, citations, and rule guides already
                licensed to the organization. It helps teams investigate inconsistencies and
                prepare an informed response without changing the deterministic review result.
              </p>
              <div className="mt-6 rounded-lg border border-gold/30 bg-accent p-5">
                <p className="font-display text-[36px] leading-none">
                  {usd(COMMERCIAL_TERMS.merlinMonthlyUsd)}
                  <span className="text-base text-muted-foreground"> / month</span>
                </p>
                <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                  Billed under a {COMMERCIAL_TERMS.merlinAnnualCommitmentMonths}-month agreement
                  ({usd(COMMERCIAL_TERMS.merlinAnnualUsd)} annually). An approved month-to-month
                  arrangement is {usd(COMMERCIAL_TERMS.merlinMonthToMonthUsd)} per month.
                </p>
              </div>
            </div>
            <FeatureList features={MERLIN_FEATURES} />
          </div>

          <div className="mt-7 rounded-lg border border-primary/20 bg-muted/30 px-5 py-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-display text-[15px]">Merlin assists; the rule engine decides</p>
                <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
                  Merlin does not override a rule, convert Unable to Determine into an approval, or
                  issue final confirmation. Findings remain pending final review until an authorized
                  responsible party confirms the result with signature and position.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="mt-7" title="One-state Multifamily example" bodyClassName="p-6">
          <div className="space-y-2 text-[13.5px]">
            <div className="flex justify-between gap-4"><span>Multifamily Enterprise — one state</span><span>{usd(COMMERCIAL_TERMS.multifamilyAnnualPerStateUsd)}</span></div>
            <div className="flex justify-between gap-4"><span>Merlin — annual agreement</span><span>{usd(COMMERCIAL_TERMS.merlinAnnualUsd)}</span></div>
            <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
              <span>Standard annual total</span>
              <span>{usd(COMMERCIAL_TERMS.multifamilyAnnualPerStateUsd + COMMERCIAL_TERMS.merlinAnnualUsd)}</span>
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-5 text-muted-foreground">
            FOUNDERS50 applies only to the base annual platform-license line item during the first
            annual term. Merlin and all other add-ons or services are excluded from the discount.
          </p>
        </Panel>

        <Panel className="mt-5" title="Scope, contracting, and next steps" bodyClassName="p-6">
          <p className="text-[13.5px] leading-7 text-muted-foreground">
            Availability depends on the licensed programs, jurisdictions, validated rule guides,
            and signed scope. The executed order form controls billing, renewal, integrations,
            and any negotiated terms. Review the <Link to="/terms" className="text-primary underline underline-offset-4">Terms of Use</Link> for the standard commercial terms.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/trial">Try CertivoIQ for Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pha">Explore PHA Workflows</Link>
            </Button>
          </div>
        </Panel>
      </div>
    </PublicShell>
  );
}
