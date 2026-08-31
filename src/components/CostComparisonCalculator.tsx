import { useState } from "react";
import { Panel } from "@/components/ui-kit";
import { COMMERCIAL_TERMS } from "@/lib/plan-catalog";

/**
 * Customer-input cost comparison. Nothing is preloaded and no savings figure is
 * claimed: the customer enters their own costs and sees their own arithmetic
 * next to the approved one-state Multifamily Enterprise annual price.
 */

const DEFAULT_ANNUAL_PRICE = COMMERCIAL_TERMS.multifamilyAnnualPerStateUsd;

const currency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type FieldKey = "externalReviews" | "vacancyDelays" | "correctionCycles" | "auditPrep";

const FIELDS: { key: FieldKey; label: string; help: string }[] = [
  { key: "externalReviews", label: "External file review fees", help: "Annual spend on outside compliance reviewers" },
  { key: "vacancyDelays", label: "Vacancy and move-in delay cost", help: "Annual cost of units held while files are corrected" },
  { key: "correctionCycles", label: "Correction cycle labor", help: "Annual internal labor cost spent reworking files" },
  { key: "auditPrep", label: "Audit preparation", help: "Annual cost cost of preparing for agency review" },
];

export function CostComparisonCalculator({ annualPrice = DEFAULT_ANNUAL_PRICE }: { annualPrice?: number }) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    externalReviews: "",
    vacancyDelays: "",
    correctionCycles: "",
    auditPrep: "",
  });

  const entered = FIELDS.map((field) => Number(values[field.key]) || 0);
  const total = entered.reduce((sum, value) => sum + value, 0);
  const anyEntered = FIELDS.some((field) => values[field.key].trim() !== "");

  return (
    <Panel bodyClassName="p-6">
      <h2 className="font-display text-[22px]">Compare with your own numbers</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Enter your organization's actual annual costs. CertivoIQ does not estimate your savings and
        makes no claim about what you will avoid.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="font-display text-[13.5px]">{field.label}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={values[field.key]}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[13.5px] tabular-nums"
            />
            <span className="cite mt-1 block">{field.help}</span>
          </label>
        ))}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <dt className="cite">Your entered annual cost</dt>
          <dd className="mt-1 font-mono text-[20px] tabular-nums">
            {anyEntered ? currency(total) : "—"}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <dt className="cite">Multifamily Enterprise · one selected state</dt>
          <dd className="mt-1 font-mono text-[20px] tabular-nums">{currency(annualPrice)}</dd>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <dt className="cite">Difference (your figures)</dt>
          <dd className="mt-1 font-mono text-[20px] tabular-nums">
            {anyEntered ? currency(total - annualPrice) : "—"}
          </dd>
        </div>
      </dl>

      <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
        {currency(annualPrice)} per selected state per year for the Multifamily Enterprise package.
        Public Housing Authorities use the separate flat organization-level PHA license. Licensed
        features, state rule guides, included self-directed onboarding, and optional Merlin service are described on
        the pricing page. Compare the applicable license with your organization's actual cost of
        external file reviews, vacancy delays, correction cycles, audit preparation and potential
        noncompliance. Regulatory and financial consequences vary; CertivoIQ does not guarantee
        avoidance of findings, penalties or credit recapture.
      </p>
    </Panel>
  );
}
