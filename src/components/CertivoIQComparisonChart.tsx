import { Check, Minus, ShieldCheck } from "lucide-react";

type Availability = "yes" | "partial" | "not-public";

const rows: Array<{
  capability: string;
  benefit: string;
  certivo: [Availability, string];
  resman: [Availability, string];
  appfolio: [Availability, string];
}> = [
  {
    capability: "AI certification-file review",
    benefit: "Finds document-level compliance issues before final approval",
    certivo: ["yes", "Purpose-built review with Pass/Fail findings"],
    resman: ["partial", "Workflow guardrails and critical-point error checks"],
    appfolio: ["partial", "AI workflows and certification milestone monitoring"],
  },
  {
    capability: "Cited findings and correction steps",
    benefit: "Gives reviewers an explainable, actionable result",
    certivo: ["yes", "Rule citation and correction path in each review"],
    resman: ["not-public", "Not described on the cited public product page"],
    appfolio: ["not-public", "Not described on the cited public product page"],
  },
  {
    capability: "Versioned property rule packs",
    benefit: "Applies repeatable rules by property, program, and jurisdiction",
    certivo: ["yes", "Assigned rule packs for LIHTC, HOME, Section 8, and HOTMA"],
    resman: ["partial", "HUD, Tax Credit, and Rural Housing compliance support"],
    appfolio: ["partial", "HUD and LIHTC program controls"],
  },
  {
    capability: "Centralized portfolio oversight",
    benefit: "Helps enterprise teams see risk and work across properties",
    certivo: ["yes", "Multi-property review workspace and consistent scoring"],
    resman: ["yes", "Compliance Center, centralized review, approvals, and reporting"],
    appfolio: ["yes", "Unified portfolio view and affordable-housing workflows"],
  },
  {
    capability: "Full property-management operations",
    benefit: "Combines accounting, leasing, maintenance, and resident operations",
    certivo: ["partial", "Specialized compliance intelligence; complements a PMS"],
    resman: ["yes", "Accounting, leasing, maintenance, marketing, and compliance"],
    appfolio: ["yes", "Accounting, leasing, maintenance, resident, and portfolio tools"],
  },
  {
    capability: "Human-controlled final approval",
    benefit: "Keeps accountable experts in the decision loop",
    certivo: ["yes", "AI review routes to a human for final sign-off"],
    resman: ["yes", "Customizable approval workflows and centralized review"],
    appfolio: ["partial", "Customizable permissions and workflow automation"],
  },
];

const tone: Record<Availability, string> = {
  yes: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  partial: "bg-amber-50 text-amber-900 ring-amber-200",
  "not-public": "bg-slate-50 text-slate-600 ring-slate-200",
};

function Cell({ value }: { value: [Availability, string] }) {
  const [status, detail] = value;
  return (
    <div className={`rounded-lg p-3 text-sm ring-1 ${tone[status]}`}>
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        {status === "yes" ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        {status === "yes" ? "Yes" : status === "partial" ? "Partial / different approach" : "Not publicly documented"}
      </div>
      <p className="leading-5 opacity-90">{detail}</p>
    </div>
  );
}

export default function CertivoIQComparisonChart() {
  return (
    <section className="bg-white px-5 py-16 text-slate-950 sm:px-8" aria-labelledby="comparison-title">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-cyan-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-[0.16em]">Platform comparison</span></div>
          <h2 id="comparison-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Specialized compliance intelligence or an all-in-one PMS?</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">CertivoIQ is positioned as a certification-review and compliance-intelligence layer. ResMan and AppFolio publicly position broader property-management suites with affordable-housing capabilities.</p>
        </div>

        <div className="mt-9 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="min-w-[1050px] border-collapse text-left">
            <caption className="sr-only">Feature and benefit comparison for CertivoIQ, ResMan, and AppFolio</caption>
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="w-[18%] p-4 font-semibold">Capability</th>
                <th className="w-[22%] p-4 font-semibold">Enterprise benefit</th>
                <th className="w-[20%] p-4 font-semibold text-cyan-300">CertivoIQ</th>
                <th className="w-[20%] p-4 font-semibold">ResMan</th>
                <th className="w-[20%] p-4 font-semibold">AppFolio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.capability} className={index % 2 ? "bg-slate-50/70" : "bg-white"}>
                  <th scope="row" className="border-t border-slate-200 p-4 align-top text-sm font-semibold">{row.capability}</th>
                  <td className="border-t border-slate-200 p-4 align-top text-sm leading-6 text-slate-600">{row.benefit}</td>
                  <td className="border-t border-slate-200 p-3 align-top"><Cell value={row.certivo} /></td>
                  <td className="border-t border-slate-200 p-3 align-top"><Cell value={row.resman} /></td>
                  <td className="border-t border-slate-200 p-3 align-top"><Cell value={row.appfolio} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">Comparison reflects publicly described capabilities reviewed August 8, 2026. “Not publicly documented” is not a claim that a feature is unavailable. Confirm current scope, packaging, integrations, and pricing with each vendor before purchasing.</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium">
          <a className="text-cyan-700 underline underline-offset-4" href="https://www.myresman.com/solutions/affordable-compliance/" target="_blank" rel="noreferrer">ResMan affordable compliance source</a>
          <a className="text-cyan-700 underline underline-offset-4" href="https://www.appfolio.com/markets/affordable-housing" target="_blank" rel="noreferrer">AppFolio affordable housing source</a>
        </div>
      </div>
    </section>
  );
}
