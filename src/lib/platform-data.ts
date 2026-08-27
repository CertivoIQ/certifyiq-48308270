import type { CertFile, Program } from "./demo-data";

/* ------------------------------------------------------------------ *
 * Review verdicts — Pass / Fail with a compliance level
 * green = Compliant · yellow = Corrections required · red = Non-compliant
 * ------------------------------------------------------------------ */

export type ComplianceLevel = "compliant" | "corrections" | "noncompliant";

export const LEVEL_META: Record<
  ComplianceLevel,
  { label: string; tone: "seal" | "flag" | "reject"; verdict: "Pass" | "Fail"; blurb: string }
> = {
  compliant: {
    label: "Compliant",
    tone: "seal",
    verdict: "Pass",
    blurb: "All program rules satisfied. Ready for Agent Approval and Agent Signature.",
  },
  corrections: {
    label: "Corrections required",
    tone: "flag",
    verdict: "Fail",
    blurb: "Curable findings. Complete the correction steps, then re-run the review.",
  },
  noncompliant: {
    label: "Non-compliant",
    tone: "reject",
    verdict: "Fail",
    blurb: "Critical program violation. Escalate before any approval — 8823 exposure.",
  },
};

export type Verdict = {
  level: ComplianceLevel;
  verdict: "Pass" | "Fail";
  score: number;
  passed: number;
  total: number;
  critical: number;
  curable: number;
};

export function verdictFor(file: CertFile): Verdict {
  const critical = file.findings.filter(
    (f) => f.severity === "critical" && f.status !== "approved",
  ).length;
  const open = file.findings.filter((f) => f.status !== "approved").length;
  const curable = open - critical;
  const total = 24;
  const passed = Math.max(0, total - open);
  const score = Math.round((passed / total) * 100);
  const level: ComplianceLevel =
    critical > 0 ? "noncompliant" : open > 0 ? "corrections" : "compliant";
  return { level, verdict: LEVEL_META[level].verdict, score, passed, total, critical, curable };
}

/** Ordered correction steps handed to the reviewer. */
export function correctionSteps(file: CertFile) {
  const open = file.findings.filter((f) => f.status !== "approved");
  if (open.length === 0) {
    return [
      {
        rule: "—",
        step: "No corrections outstanding — proceed to Agent Approval and Agent Signature.",
        owner: "Compliance Agent",
        due: "Today",
      },
    ];
  }
  return open.map((f, i) => ({
    rule: `${f.ruleId} ${f.ruleVersion}`,
    step: f.remediation,
    owner: f.severity === "critical" ? "Compliance Manager" : "Site Manager",
    due: `${(i + 1) * 3} business days`,
  }));
}

/* ------------------------------------------------------------------ *
 * Property registration — programs an admin can assign
 * ------------------------------------------------------------------ */

export const PROGRAM_OPTIONS: { id: Program | "RD" | "BOND"; label: string; note: string }[] = [
  {
    id: "LIHTC",
    label: "LIHTC (Section 42)",
    note: "IRC §42 federal baseline; state requirements require Manual Review",
  },
  { id: "PBS8", label: "Project-Based Section 8", note: "HUD Handbook 4350.3 / HOTMA" },
  { id: "HOME", label: "HOME Investment Partnerships", note: "24 CFR Part 92" },
  { id: "HOTMA", label: "HOTMA overlay", note: "Sections 102 / 104 asset & income rules" },
  { id: "RD", label: "Rural Development (515/521)", note: "USDA RD Handbook HB-2-3560" },
  { id: "BOND", label: "Tax-Exempt Bonds", note: "IRC §142(d) set-aside election" },
];

export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

/* ------------------------------------------------------------------ *
 * Trial · pricing · LaunchPad · success coach
 * ------------------------------------------------------------------ */

export const TRIAL = {
  active: true,
  daysTotal: 7,
  daysLeft: 5,
  uploadsAllowed: 3,
  uploadsUsed: 1,
};

export const PLANS = [
  {
    id: "multifamily_enterprise",
    name: "Multifamily Enterprise",
    price: "$65,000",
    cadence: "/state/year",
    tagline: "Annual license per selected state rule pack",
    features: [
      "All currently available platform features",
      "Federal baseline certification review",
      "Traceable evidence and versioned federal rules",
      "Manual Review, Agent Verification, Agent Approval, and Agent Signature",
      "Portfolio-level compliance visibility",
      "Evidence-manifest export",
    ],
    cta: "Try CertivoIQ for Free",
    featured: true,
    selfServe: false,
  },
  {
    id: "pha",
    name: "PHA",
    price: "$150,000",
    cadence: "/year",
    tagline: "Flat annual Public Housing Authority license",
    features: [
      "All currently available platform features",
      "One validated operating-state rule pack",
      "PHA compliance workflows",
    ],
    cta: "Try CertivoIQ for Free",
    featured: false,
    selfServe: false,
  },
];

export const ADDONS: { name: string; price: string }[] = [];

/** Sales email already used for CertivoIQ outreach — no new address invented. */
export const SALES_EMAIL = "sales@certivoiq.com";

/**
 * Integrations are scoped during contracting only after the applicable
 * end-to-end workflow has been verified for the customer's environment.
 * They are not separately priced or advertised as production-ready.
 */
export const SALES_ASSISTED_ADDONS: {
  id: string;
  name: string;
  price: string;
  cadence: string;
  note: string;
  subject: string;
}[] = [];

export const ACADEMY_ADDONS: {
  id: string;
  name: string;
  price: string;
  cadence: string;
  note: string;
}[] = [];

export const LAUNCHPAD_STEPS = [
  {
    id: 1,
    title: "Welcome to CertivoIQ",
    lead: "Set up your account without scheduling a sales or technical-support call.",
    detail: "Your progress is saved automatically so you can leave and resume from any device.",
    cta: "Start setup",
  },
  {
    id: 2,
    title: "Confirm your organization profile",
    lead: "Review the organization name, operating states, affordable-housing programs, and primary contact.",
    detail:
      "Use verified organization information. Do not include resident or applicant data in the organization profile.",
    cta: "Mark profile complete",
  },
  {
    id: 3,
    title: "Add your portfolio",
    lead: "Create the properties that your organization is authorized to manage.",
    detail:
      "Confirm each property's programs and jurisdiction before using it in a compliance workflow.",
    cta: "Mark portfolio complete",
  },
  {
    id: 4,
    title: "Submit your first certification review",
    lead: "Upload a certification package and review the extracted evidence before relying on any finding.",
    detail:
      "A submitted file remains subject to the platform's evidence, Manual Review, Agent Approval, and Agent Signature controls.",
    cta: "Mark first review complete",
  },
  {
    id: 5,
    title: "Set team access",
    lead: "Invite only authorized team members and assign the minimum access needed for their work.",
    detail:
      "Verify every recipient and role before sharing property, resident, or certification information.",
    cta: "Mark access review complete",
  },
  {
    id: 6,
    title: "Confirm operational readiness",
    lead: "Review your saved setup and open SupportIQ if anything is incomplete or unclear.",
    detail:
      "Completing onboarding confirms account setup only. It is not a training certificate, compliance determination, or certification approval.",
    cta: "Complete onboarding",
  },
];

