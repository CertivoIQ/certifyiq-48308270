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
    blurb: "All program rules satisfied. Ready for human final sign-off.",
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
  const critical = file.findings.filter((f) => f.severity === "critical" && f.status !== "approved").length;
  const open = file.findings.filter((f) => f.status !== "approved").length;
  const curable = open - critical;
  const total = 24;
  const passed = Math.max(0, total - open);
  const score = Math.round((passed / total) * 100);
  const level: ComplianceLevel = critical > 0 ? "noncompliant" : open > 0 ? "corrections" : "compliant";
  return { level, verdict: LEVEL_META[level].verdict, score, passed, total, critical, curable };
}

/** Ordered correction steps the AI hands to the reviewer. */
export function correctionSteps(file: CertFile) {
  const open = file.findings.filter((f) => f.status !== "approved");
  if (open.length === 0) {
    return [
      { rule: "—", step: "No corrections outstanding — proceed to human final sign-off.", owner: "Reviewer", due: "Today" },
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
  { id: "LIHTC", label: "LIHTC (Section 42)", note: "IRC §42 · state QAP rule pack" },
  { id: "PBS8", label: "Project-Based Section 8", note: "HUD Handbook 4350.3 / HOTMA" },
  { id: "HOME", label: "HOME Investment Partnerships", note: "24 CFR Part 92" },
  { id: "HOTMA", label: "HOTMA overlay", note: "Sections 102 / 104 asset & income rules" },
  { id: "RD", label: "Rural Development (515/521)", note: "USDA RD Handbook HB-2-3560" },
  { id: "BOND", label: "Tax-Exempt Bonds", note: "IRC §142(d) set-aside election" },
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
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
    id: "professional",
    name: "Professional",
    price: "$599",
    cadence: "/month",
    tagline: "Single-site and small portfolios",
    features: ["Up to 750 units", "1 state rule pack", "AI document review", "Compliance knowledge base", "Email support"],
    cta: "Start 7-day trial",
    featured: false,
  },
  {
    id: "business",
    name: "Business",
    price: "$1,499",
    cadence: "/month",
    tagline: "Our sweet spot",
    features: [
      "Up to 5,000 units",
      "Multi-property portfolios",
      "State rule packs included",
      "AI document processing (5,000 docs/mo)",
      "Customer Success Wizard",
      "Compliance knowledge base",
      "Priority support",
    ],
    cta: "Choose Business",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$4,999",
    cadence: "/month",
    tagline: "Multi-state operators and owners — buy online, cancel anytime",
    features: [
      "Unlimited units",
      "Multi-state portfolios",
      "API access · SSO · white labeling",
      "AI Onboarding & Migration Wizard",
      "Custom integrations",
      "Contractual SLA",
    ],
    cta: "Choose Enterprise",
    featured: false,
    selfServe: true,
  },
];

export const ADDONS = [
  { name: "Additional state rule packs", price: "$99–$199 / month per state" },
  { name: "CertifyIQ Academy add-on", price: "$49 / user / month or $499 / property / month" },
  { name: "API access", price: "$500–$2,000 / month by usage" },
  { name: "High-volume AI document processing", price: "$3 per uploaded certification beyond plan allowance" },
  { name: "AI Onboarding & Migration Wizard", price: "Included on every plan — no account rep required" },
];

export const ACADEMY_ADDONS = [
  {
    id: "academy-seat",
    name: "Academy seat add-on",
    price: "$49",
    cadence: "/user / month",
    note: "Add the Academy to any platform plan, per user",
  },
  {
    id: "academy-property-addon",
    name: "Academy property add-on",
    price: "$499",
    cadence: "/property / month",
    note: "Unlimited seats at one property on any platform plan",
  },
];



export const LAUNCHPAD_STEPS = [
  {
    id: 1,
    title: "Welcome to CertifyIQ",
    lead: "Congratulations on taking the next step toward making compliance easier.",
    detail: "Let's get your organization audit-ready. Estimated setup time: 20–30 minutes.",
    cta: "Start setup",
  },
  {
    id: 2,
    title: "Tell us about your organization",
    lead: "Five questions — not a hundred.",
    detail: "Organization name, address, states operated in, programs managed, number of properties.",
    cta: "Save & continue",
  },
  {
    id: 3,
    title: "Build your portfolio",
    lead: "Upload Excel, CSV or an export from your existing software — or create properties manually.",
    detail: "AI maps your columns to CertifyIQ fields automatically.",
    cta: "Import portfolio",
  },
  {
    id: 4,
    title: "Import residents",
    lead: "Drag. Drop. Done.",
    detail: "\"I found 1,248 households. Would you like me to map these fields?\"",
    cta: "Yes, map fields",
  },
  {
    id: 5,
    title: "Upload documents",
    lead: "Drop the entire folder. Literally — thousands of PDFs.",
    detail: "AI sorts income certifications, leases, verifications, EIVs, utility allowances and asset documents.",
    cta: "Upload documents",
  },
  {
    id: 6,
    title: "AI reviews everything",
    lead: "Reviewing files — 842 of 1,102.",
    detail: "Missing files · duplicate documents · possible income discrepancies · expired forms · missing signatures.",
    cta: "See what we found",
  },
  {
    id: 7,
    title: "Build your compliance dashboard",
    lead: "Your first dashboard isn't empty — it's already useful.",
    detail: "92% audit ready · 17 upcoming recerts · 23 missing documents · 4 HOTMA alerts · 2 high-risk files.",
    cta: "Open dashboard preview",
  },
  {
    id: 8,
    title: "Invite your team",
    lead: "One click each.",
    detail: "Regional managers, compliance specialists, property managers, owners and auditors.",
    cta: "Send invitations",
  },
  {
    id: 9,
    title: "Merlin's readiness review",
    lead: "No phone call, no account rep — Merlin reviews your setup right here.",
    detail: "He re-checks portfolio coverage, rule pack assignment, document completeness and team roles, then hands you a punch list.",
    cta: "Run readiness review",

  },
  {
    id: 10,
    title: "Graduation",
    lead: "You are officially live on CertifyIQ.",
    detail: "Awarded: CertifyIQ Launch Certified.",
    cta: "Finish",
  },
];

export const AUDIT_JOURNEY = [
  { label: "Company created", done: true },
  { label: "Properties imported", done: true },
  { label: "Residents imported", done: true },
  { label: "Documents uploaded", done: true },
  { label: "Rules engine activated", done: true },
  { label: "Knowledge base indexed", done: true },
  { label: "Audit ready", done: false },
];

export const COACH_TIPS = [
  { day: "Day 12", text: "Three recertifications are due next week at Harper Mill Lofts." },
  { day: "Day 14", text: "Cedar Grove hasn't uploaded 2026 utility allowances." },
  { day: "Day 19", text: "Your Tennessee rule pack was updated to 2026.08 — 4 files need re-evaluation." },
  { day: "Day 23", text: "Five invited users haven't completed onboarding." },
];
