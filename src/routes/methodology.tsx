import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
const OFFICIAL_FEDERAL_SOURCES = [
  {
    name: "Federal HOME regulations (24 CFR Part 92)",
    url: "https://www.ecfr.gov/current/title-24/subtitle-A/part-92",
  },
  {
    name: "Federal income and asset regulations (24 CFR Part 5)",
    url: "https://www.ecfr.gov/current/title-24/subtitle-A/part-5",
  },
] as const;

/**
 * Public calculation and validation methodology. No performance metric appears
 * here until a reproducible benchmark supports it.
 */

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Calculation & Validation Methodology — CertivoIQ" },
      {
        name: "description",
        content:
          "Affordable Housing Compliance Intelligence: how CertivoIQ reaches a compliance outcome — document extraction, deterministic calculation, confidence policy, rule sourcing and versioning, and the definitions of Pass, Fail and Unable to determine.",
      },
      { property: "og:title", content: "Calculation & Validation Methodology — CertivoIQ" },
      {
        property: "og:description",
        content: "Deterministic code decides; automated processing only extracts. Every determination carries its rule versions and source hashes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://certivoiq.com/methodology" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/methodology" }],
  }),
  component: MethodologyPage,
});

const PROGRAMS = [
  "LIHTC (IRC §42)",
  "Project-Based Section 8 (HUD Handbook 4350.3)",
  "HOME (24 CFR Part 92)",
  "HOTMA income and asset provisions (24 CFR Part 5)",
  "Tax-exempt bond financed units",
];

const INPUTS = [
  "Household composition and student status",
  "Employment, self-employment, benefit and other income sources",
  "Asset balances, imputed income and HOTMA asset thresholds",
  "Applicable income limit set, effective date and area",
  "Contract rent, tenant-paid utilities and the utility allowance schedule in force",
  "Set-aside election, applicable fraction and unit designation",
  "Third-party verification dates, signatures and expiration",
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Panel bodyClassName="p-5">
      <h2 id={id} className="font-display text-[17px]">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </Panel>
  );
}

function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-11 w-auto object-contain dark:hidden" /><img src="/certivoiq-logo-dark.png" alt="" aria-hidden="true" className="hidden h-11 w-auto object-contain dark:block" />
          </Link>
          <Button size="sm" variant="outline" asChild>
            <Link to="/security">Security &amp; Data Use</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="font-display text-[34px] leading-tight">
          Calculation &amp; validation methodology
        </h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted-foreground">
          CertivoIQ currently evaluates supported federal affordable-housing requirements only.
          State-agency, allocating-agency, local, and project-specific requirements require
          separate Manual Review.
        </p>

        <div className="mt-8 space-y-3">
          <Section id="division-of-labor" title="Division of labor">
            <p>
              Automated processing performs document extraction and classification only: it reads a certification
              packet and proposes field values with a confidence score and a page reference.
              Deterministic code performs every calculation and every rule evaluation. No language
              model decides a compliance outcome.
            </p>
          </Section>

          <Section id="scope" title="Supported programs, forms, file types and jurisdictions">
            <ul className="list-disc space-y-1 pl-5">
              {PROGRAMS.map((program) => (
                <li key={program}>{program}</li>
              ))}
            </ul>
            <p>
              Accepted uploads are PDF and common image scans of tenant income certifications and
              their supporting verifications. Jurisdictional scope is limited to the supported
              federal baseline. Non-federal requirements require separate Manual Review.
            </p>
          </Section>

          <Section id="inputs" title="Required inputs, rounding and effective dates">
            <ul className="list-disc space-y-1 pl-5">
              {INPUTS.map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
            <p>
              Income and rent figures are computed in whole dollars using the rounding convention
              published by the controlling authority for that program. Every limit, allowance and
              rule is applied as of the effective date in force on the certification's effective
              date, not the date of review.
            </p>
          </Section>

          <Section id="confidence" title="Confidence and Agent Verification policy">
            <p>
              Any field required for the decision that falls below the configured confidence
              threshold must receive Agent Verification before the engine will return Pass or Fail. Agent
              verification is recorded per field with the actor and timestamp.
            </p>
          </Section>

          <Section id="outcomes" title="Pass, Fail and Unable to determine">
            <p>
              <strong>Pass</strong> — every required input is present and verified to policy, and no
              evaluated rule failed.
            </p>
            <p>
              <strong>Fail</strong> — every required input is present and verified to policy, and at
              least one evaluated rule failed. The finding cites the rule, version and correction
              path.
            </p>
            <p>
              <strong>Unable to determine</strong> — required evidence is missing, below the
              confidence policy, unverified, or affected by an unresolved rule conflict, or the
              an unevaluated non-federal requirement could change the outcome. Final Pass/Fail and Agent Signature are
              blocked, and the blocking reasons are logged with the review.
            </p>
          </Section>

          <Section id="rules" title="Rule sourcing, versioning, supersession and emergency suspension">
            <p>
              Rules are derived from archived copies of the controlling source document, stored with
              a SHA-256 content hash, publication date and effective range. A rule change creates a
              new version; prior versions are retained so any historical finding can be reproduced
              exactly. When a source becomes uncertain, the affected rules are suspended rather than
              guessed, and reviews that depend on them return Unable to determine.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {OFFICIAL_FEDERAL_SOURCES.map((source) => (
                <li key={source.url}>
                  {source.name} —{" "}
                  <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                    {source.url}
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="validation" title="Validation datasets, sampling and agent qualifications">
            <p>
              Release testing uses fixture sets covering positive, negative, boundary,
              layered-program and supersession cases. Ground truth is established by a credentialed
              affordable-housing compliance professional independent of the engineer who authored
              the rule. Deterministic release tests must return 100% of expected results before a
              supported federal rule set is released.
            </p>
          </Section>

          <Section id="metrics" title="Measured performance">
            <p className="font-medium text-flag">
              Benchmark in progress. No per-field precision or recall figure, end-to-end false-pass
              or false-fail rate, or time-savings estimate is published because no reproducible
              benchmark supports one yet. Figures will appear here with the benchmark date, engine
              build, dataset description and known limitations attached.
            </p>
          </Section>

          <Section id="change-control" title="Change control and regression testing">
            <p>
              Rule and engine changes are reviewed, versioned and released prospectively. The full
              fixture suite runs on every change; a regression blocks release. Each completed review
              stores an evidence manifest containing the extracted inputs, the deterministic
              calculation trace, the rule versions and source hashes, the outcome, the engine and
              processing versions, and every agent action.
            </p>
          </Section>

          <Section id="limits" title="Known limitations">
            <p>
              CertivoIQ does not replace your compliance staff, your state agency's determination, or
              legal advice. Regulatory and financial consequences vary by program, jurisdiction and
              deal structure, and CertivoIQ does not guarantee avoidance of findings, penalties or
              credit recapture.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
