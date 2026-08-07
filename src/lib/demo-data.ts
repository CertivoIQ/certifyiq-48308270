// CertivoIQ demo dataset — front-end walkthrough only (no backend yet).

export type Status = "approved" | "pending" | "remediation" | "rejected";
export type Program = "LIHTC" | "HOTMA" | "HOME" | "PBS8";

export const PROGRAMS: { id: Program; name: string; authority: string; blurb: string }[] = [
  {
    id: "LIHTC",
    name: "LIHTC",
    authority: "IRC §42",
    blurb: "Low-Income Housing Tax Credit — income/rent limits, set-asides, NAUR, student rule.",
  },
  {
    id: "HOTMA",
    name: "HOTMA",
    authority: "HUD 24 CFR 5 (HOTMA §102/§104)",
    blurb: "Income exclusions, asset thresholds, hardship, safe harbor, interim recerts.",
  },
  {
    id: "HOME",
    name: "HOME",
    authority: "24 CFR Part 92",
    blurb: "HOME rents, fixed/floating unit designation, annual income re-exam.",
  },
  {
    id: "PBS8",
    name: "Section 8",
    authority: "HUD Handbook 4350.3 / HOTMA",
    blurb: "Project-Based Section 8 — TTP, EIV reconciliation, deductions, interims.",
  },
];

export type RuleVersion = {
  ruleId: string;
  name: string;
  program: Program;
  version: string;
  effective: string;
  expires: string | null;
  authority: string;
  citation: string;
  supersededBy: string | null;
  summary: string;
  scope: "core" | "state" | "county" | "pha" | "property";
};

export const RULES: RuleVersion[] = [
  {
    ruleId: "LIHTC-001",
    name: "Income eligibility at move-in",
    program: "LIHTC",
    version: "v4.2",
    effective: "2026-04-01",
    expires: null,
    authority: "IRS",
    citation: "IRC 42(g)(1)",
    supersededBy: null,
    summary: "Annual gross income must not exceed the elected AMI set-aside limit for household size.",
    scope: "core",
  },
  {
    ruleId: "LIHTC-002",
    name: "Gross rent limit",
    program: "LIHTC",
    version: "v4.2",
    effective: "2026-04-01",
    expires: null,
    authority: "IRS",
    citation: "IRC 42(g)(2)",
    supersededBy: null,
    summary: "Tenant rent + utility allowance ≤ 30% of the imputed income limit for the unit tier.",
    scope: "core",
  },
  {
    ruleId: "LIHTC-004",
    name: "Next Available Unit Rule",
    program: "LIHTC",
    version: "v3.1",
    effective: "2025-01-01",
    expires: null,
    authority: "IRS",
    citation: "IRC 42(g)(2)(D)",
    supersededBy: null,
    summary: "Recert income > 140% of limit triggers NAUR on the next comparable or smaller vacancy.",
    scope: "core",
  },
  {
    ruleId: "LIHTC-005",
    name: "Student status exception",
    program: "LIHTC",
    version: "v2.6",
    effective: "2024-07-01",
    expires: null,
    authority: "IRS",
    citation: "IRC 42(i)(3)(D)",
    supersededBy: null,
    summary: "All-full-time-student households are ineligible absent one of five documented exceptions.",
    scope: "core",
  },
  {
    ruleId: "HOTMA-101",
    name: "Net family asset threshold",
    program: "HOTMA",
    version: "v2.0",
    effective: "2026-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.618(a)",
    supersededBy: "HOTMA-101 v1.4",
    summary: "Households with net assets over the indexed threshold ($102,000 for 2026) are ineligible.",
    scope: "core",
  },
  {
    ruleId: "HOTMA-104",
    name: "Asset imputation safe harbor",
    program: "HOTMA",
    version: "v2.0",
    effective: "2026-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.609(a)(2)",
    supersededBy: null,
    summary: "Assets ≤ $50,000 (indexed) may be self-certified; imputation is not required.",
    scope: "core",
  },
  {
    ruleId: "HOTMA-208",
    name: "Medical expense deduction threshold",
    program: "HOTMA",
    version: "v2.1",
    effective: "2026-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.611(a)(3)",
    supersededBy: "HOTMA-208 v1.2",
    summary: "Unreimbursed medical expenses deductible above 10% of annual income (phased from 3%).",
    scope: "core",
  },
  {
    ruleId: "HOTMA-311",
    name: "Hardship exemption determination",
    program: "HOTMA",
    version: "v1.3",
    effective: "2025-07-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.611(c)",
    supersededBy: null,
    summary: "Phase-in relief where the deduction change increases TTP beyond the hardship trigger.",
    scope: "core",
  },
  {
    ruleId: "HOTMA-402",
    name: "Over-income monitoring (200% limit)",
    program: "HOTMA",
    version: "v1.1",
    effective: "2025-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.618(c)",
    supersededBy: null,
    summary: "Two consecutive years above 200% of the income limit requires termination or market conversion.",
    scope: "core",
  },
  {
    ruleId: "HOTMA-505",
    name: "EIV reconciliation",
    program: "HOTMA",
    version: "v1.0",
    effective: "2025-01-01",
    expires: null,
    authority: "HUD",
    citation: "HUD Handbook 4350.3 Ch. 9",
    supersededBy: null,
    summary: "EIV income report must be reconciled to certified income within 90 days of the effective date.",
    scope: "core",
  },
  {
    ruleId: "HOME-021",
    name: "HOME rent limit (High/Low)",
    program: "HOME",
    version: "v3.0",
    effective: "2026-06-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 92.252",
    supersededBy: null,
    summary: "HOME-assisted unit rents must not exceed the applicable High or Low HOME rent.",
    scope: "core",
  },
  {
    ruleId: "HOME-034",
    name: "Annual income re-examination",
    program: "HOME",
    version: "v2.2",
    effective: "2025-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 92.203",
    supersededBy: null,
    summary: "Income must be re-examined annually using the definition elected by the PJ.",
    scope: "core",
  },
  {
    ruleId: "PBS8-012",
    name: "Total Tenant Payment calculation",
    program: "PBS8",
    version: "v5.0",
    effective: "2026-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.628",
    supersededBy: "PBS8-012 v4.3",
    summary: "TTP is the greatest of 30% adjusted monthly income, 10% monthly income, or the minimum rent.",
    scope: "core",
  },
  {
    ruleId: "PBS8-031",
    name: "Interim recertification trigger",
    program: "PBS8",
    version: "v2.0",
    effective: "2026-01-01",
    expires: null,
    authority: "HUD",
    citation: "24 CFR 5.657(c)",
    supersededBy: null,
    summary: "Income decreases must be processed; increases under $2,400/yr need not trigger an interim.",
    scope: "core",
  },
  {
    ruleId: "TN-QAP-07",
    name: "THDA average income documentation",
    program: "LIHTC",
    version: "v1.4",
    effective: "2026-01-01",
    expires: null,
    authority: "THDA",
    citation: "THDA QAP §7.3",
    supersededBy: null,
    summary: "Tennessee requires unit-level AMI designation letters retained in each file.",
    scope: "state",
  },
  {
    ruleId: "CA-TCAC-19",
    name: "TCAC good cause eviction addendum",
    program: "LIHTC",
    version: "v2.0",
    effective: "2025-01-01",
    expires: null,
    authority: "CA TCAC",
    citation: "4 CCR §10337",
    supersededBy: null,
    summary: "California requires the TCAC lease rider on every certified LIHTC file.",
    scope: "state",
  },
  {
    ruleId: "TX-TDHCA-04",
    name: "TDHCA student self-certification form",
    program: "LIHTC",
    version: "v1.2",
    effective: "2025-03-01",
    expires: null,
    authority: "TDHCA",
    citation: "TDHCA Compliance Manual Ch. 5",
    supersededBy: null,
    summary: "Texas requires the state student self-certification in addition to the federal exception test.",
    scope: "state",
  },
];

export const STATE_PACKS = [
  { code: "TN", state: "Tennessee", agency: "THDA", rules: 46, status: "Certified", properties: 62 },
  { code: "GA", state: "Georgia", agency: "DCA", rules: 41, status: "Certified", properties: 34 },
  { code: "AL", state: "Alabama", agency: "AHFA", rules: 38, status: "Certified", properties: 18 },
  { code: "TX", state: "Texas", agency: "TDHCA", rules: 52, status: "Certified", properties: 29 },
  { code: "FL", state: "Florida", agency: "FHFC", rules: 44, status: "Certified", properties: 21 },
  { code: "CA", state: "California", agency: "TCAC", rules: 61, status: "Certified", properties: 15 },
  { code: "NC", state: "North Carolina", agency: "NCHFA", rules: 39, status: "Review", properties: 6 },
  { code: "OH", state: "Ohio", agency: "OHFA", rules: 37, status: "Review", properties: 0 },
];

export type Property = {
  id: string;
  name: string;
  city: string;
  state: string;
  county: string;
  units: number;
  programs: Program[];
  risk: number;
  riskReasons: string[];
  openFindings: number;
  overdueRecerts: number;
  nextAudit: string;
  hotmaReadiness: number;
  nspireReadiness: number;
};

export const PROPERTIES: Property[] = [
  {
    id: "harper-mill",
    name: "Harper Mill Lofts",
    city: "Nashville",
    state: "TN",
    county: "Davidson",
    units: 148,
    programs: ["LIHTC", "PBS8", "HOTMA"],
    risk: 87,
    riskReasons: [
      "17 overdue recertifications",
      "5 missing EIV reconciliations",
      "3 NAUR violations open > 60 days",
      "2 HOTMA asset discrepancies",
    ],
    openFindings: 27,
    overdueRecerts: 17,
    nextAudit: "2026-09-14",
    hotmaReadiness: 62,
    nspireReadiness: 74,
  },
  {
    id: "cedar-crossing",
    name: "Cedar Crossing",
    city: "Chattanooga",
    state: "TN",
    county: "Hamilton",
    units: 96,
    programs: ["LIHTC", "HOME"],
    risk: 54,
    riskReasons: ["4 overdue recertifications", "1 HOME rent overage", "Utility allowance study expiring"],
    openFindings: 9,
    overdueRecerts: 4,
    nextAudit: "2026-10-02",
    hotmaReadiness: 81,
    nspireReadiness: 88,
  },
  {
    id: "magnolia-court",
    name: "Magnolia Court",
    city: "Atlanta",
    state: "GA",
    county: "Fulton",
    units: 212,
    programs: ["LIHTC", "PBS8", "HOTMA"],
    risk: 41,
    riskReasons: ["2 files pending soft approval", "EIV queue 6 days behind"],
    openFindings: 6,
    overdueRecerts: 2,
    nextAudit: "2026-11-19",
    hotmaReadiness: 90,
    nspireReadiness: 79,
  },
  {
    id: "brazos-landing",
    name: "Brazos Landing",
    city: "Austin",
    state: "TX",
    county: "Travis",
    units: 174,
    programs: ["LIHTC", "HOME", "HOTMA"],
    risk: 68,
    riskReasons: ["9 overdue recertifications", "TDHCA student form missing on 4 files", "1 set-aside exposure"],
    openFindings: 15,
    overdueRecerts: 9,
    nextAudit: "2026-08-28",
    hotmaReadiness: 70,
    nspireReadiness: 66,
  },
  {
    id: "pacific-terrace",
    name: "Pacific Terrace",
    city: "Fresno",
    state: "CA",
    county: "Fresno",
    units: 132,
    programs: ["LIHTC", "PBS8"],
    risk: 22,
    riskReasons: ["No material exposure — 1 informational finding"],
    openFindings: 1,
    overdueRecerts: 0,
    nextAudit: "2027-01-12",
    hotmaReadiness: 96,
    nspireReadiness: 93,
  },
  {
    id: "gulf-view",
    name: "Gulf View Commons",
    city: "Tampa",
    state: "FL",
    county: "Hillsborough",
    units: 88,
    programs: ["LIHTC", "HOTMA"],
    risk: 76,
    riskReasons: ["11 overdue recertifications", "2 over-income households at 200% threshold", "8823 exposure flagged"],
    openFindings: 19,
    overdueRecerts: 11,
    nextAudit: "2026-09-30",
    hotmaReadiness: 55,
    nspireReadiness: 71,
  },
];

export type ExtractedField = {
  label: string;
  value: string;
  confidence: number;
  source: string;
  page: number;
  verified: boolean;
};

export type Finding = {
  id: string;
  ruleId: string;
  ruleVersion: string;
  program: Program;
  title: string;
  severity: "critical" | "major" | "minor";
  status: Status;
  citation: string;
  detail: string;
  evidence: { doc: string; page: number; paragraph: number; excerpt: string };
  remediation: string;
};

export type TimelineEvent = {
  date: string;
  label: string;
  kind: "neutral" | "seal" | "flag" | "reject";
  note: string;
};

export type CertFile = {
  id: string;
  household: string;
  unit: string;
  propertyId: string;
  certType: "Initial" | "Annual Recert" | "Interim" | "Move-In";
  effective: string;
  status: Status;
  programs: Program[];
  hhSize: number;
  amiTier: string;
  annualIncome: number;
  assets: number;
  ttp: number;
  aiScore: number;
  fields: ExtractedField[];
  findings: Finding[];
  timeline: TimelineEvent[];
};

export const FILES: CertFile[] = [
  {
    id: "TIC-2026-0418",
    household: "Whitfield, Danielle",
    unit: "Harper Mill · 214B",
    propertyId: "harper-mill",
    certType: "Annual Recert",
    effective: "2026-08-01",
    status: "remediation",
    programs: ["LIHTC", "HOTMA"],
    hhSize: 3,
    amiTier: "60% AMI",
    annualIncome: 38440,
    assets: 54200,
    ttp: 961,
    aiScore: 96.4,
    fields: [
      { label: "Annual gross income", value: "$38,440.00", confidence: 99.3, source: "Paystub_ADP_Jul2026.pdf", page: 2, verified: true },
      { label: "Household size", value: "3", confidence: 99.8, source: "TIC_Signed.pdf", page: 1, verified: true },
      { label: "Net family assets", value: "$54,200.00", confidence: 91.2, source: "Regions_Statement.pdf", page: 3, verified: false },
      { label: "Unreimbursed medical", value: "$4,120.00", confidence: 78.5, source: "Medical_Receipts.pdf", page: 6, verified: false },
      { label: "Student status (all members)", value: "No", confidence: 88.1, source: "Lease.pdf", page: 14, verified: false },
      { label: "Utility allowance", value: "$92.00", confidence: 97.0, source: "UA_Schedule_2026.pdf", page: 1, verified: true },
    ],
    findings: [
      {
        id: "F-9013",
        ruleId: "HOTMA-104",
        ruleVersion: "v2.0",
        program: "HOTMA",
        title: "Assets exceed self-certification safe harbor",
        severity: "major",
        status: "remediation",
        citation: "24 CFR 5.609(a)(2)",
        detail:
          "Net family assets of $54,200 exceed the $50,000 indexed safe harbor. Third-party asset verification and actual income from assets are required — self-certification is not sufficient.",
        evidence: {
          doc: "Regions_Statement.pdf",
          page: 3,
          paragraph: 2,
          excerpt: "Ending balance as of 07/31/2026 ......... $54,200.18",
        },
        remediation: "Obtain third-party verification of all asset accounts and recompute actual asset income.",
      },
      {
        id: "F-9014",
        ruleId: "HOTMA-208",
        ruleVersion: "v2.1",
        program: "HOTMA",
        title: "Medical deduction applied at pre-HOTMA 3% threshold",
        severity: "critical",
        status: "remediation",
        citation: "24 CFR 5.611(a)(3)",
        detail:
          "Deduction was calculated above 3% of annual income. Effective 2026-01-01 the threshold is 10%, reducing the allowable deduction by $2,691 and increasing TTP by $67/month.",
        evidence: {
          doc: "TIC_Signed.pdf",
          page: 4,
          paragraph: 1,
          excerpt: "Medical expense deduction (3% threshold) ......... $2,967.00",
        },
        remediation: "Recalculate at 10%; evaluate HOTMA-311 hardship phase-in before issuing the rent change notice.",
      },
      {
        id: "F-9015",
        ruleId: "HOTMA-505",
        ruleVersion: "v1.0",
        program: "HOTMA",
        title: "EIV report not reconciled",
        severity: "minor",
        status: "pending",
        citation: "HUD Handbook 4350.3 Ch. 9",
        detail: "No EIV income report is attached within 90 days of the effective date.",
        evidence: { doc: "File index", page: 1, paragraph: 1, excerpt: "EIV Income Report — not present in file index" },
        remediation: "Pull the current EIV income report and document any discrepancy over $200/yr.",
      },
    ],
    timeline: [
      { date: "2023-08-01", label: "Move-in", kind: "neutral", note: "Initial certification at 60% AMI, HH size 2." },
      { date: "2024-08-01", label: "Annual recertification", kind: "seal", note: "Passed all LIHTC rules." },
      { date: "2025-11-14", label: "Interim certification", kind: "neutral", note: "Household size increased to 3." },
      { date: "2026-07-22", label: "Documents imported", kind: "neutral", note: "6 documents, 41 fields extracted." },
      { date: "2026-07-23", label: "3 findings generated", kind: "flag", note: "HOTMA-104, HOTMA-208, HOTMA-505." },
      { date: "2026-08-01", label: "Recertification due", kind: "flag", note: "Effective date — remediation in progress." },
    ],
  },
  {
    id: "TIC-2026-0421",
    household: "Okonjo, Marcus & Ada",
    unit: "Gulf View · 12A",
    propertyId: "gulf-view",
    certType: "Annual Recert",
    effective: "2026-08-15",
    status: "rejected",
    programs: ["LIHTC", "HOTMA"],
    hhSize: 2,
    amiTier: "50% AMI",
    annualIncome: 61250,
    assets: 12400,
    ttp: 1240,
    aiScore: 94.1,
    fields: [
      { label: "Annual gross income", value: "$61,250.00", confidence: 98.6, source: "Paystubs_Q2.pdf", page: 1, verified: true },
      { label: "Household size", value: "2", confidence: 99.9, source: "TIC_Signed.pdf", page: 1, verified: true },
      { label: "Original AMI limit", value: "$41,300.00", confidence: 99.1, source: "MTSP_2026_Hillsborough.pdf", page: 2, verified: true },
      { label: "Net family assets", value: "$12,400.00", confidence: 95.4, source: "Asset_Cert.pdf", page: 1, verified: true },
    ],
    findings: [
      {
        id: "F-9101",
        ruleId: "LIHTC-004",
        ruleVersion: "v3.1",
        program: "LIHTC",
        title: "Next Available Unit Rule triggered",
        severity: "critical",
        status: "rejected",
        citation: "IRC 42(g)(2)(D)",
        detail:
          "Recertified income of $61,250 exceeds 140% of the $41,300 limit ($57,820). The next comparable or smaller vacancy must be leased to an income-qualified household until the set-aside is restored.",
        evidence: {
          doc: "TIC_Signed.pdf",
          page: 2,
          paragraph: 4,
          excerpt: "Total annual household income ......... $61,250.00",
        },
        remediation: "Flag unit 12A as NAUR-restricted and route the next 1BR vacancy to a qualified applicant.",
      },
      {
        id: "F-9102",
        ruleId: "HOTMA-402",
        ruleVersion: "v1.1",
        program: "HOTMA",
        title: "Over-income monitoring — year 1 of 2",
        severity: "major",
        status: "pending",
        citation: "24 CFR 5.618(c)",
        detail: "Household is above 140% but below 200%. Begin over-income tracking; a second consecutive year triggers action.",
        evidence: { doc: "TIC_Signed.pdf", page: 2, paragraph: 4, excerpt: "Total annual household income ......... $61,250.00" },
        remediation: "Record the over-income determination date and set a 12-month monitoring reminder.",
      },
    ],
    timeline: [
      { date: "2021-05-01", label: "Move-in", kind: "neutral", note: "Initial certification at 50% AMI." },
      { date: "2025-08-15", label: "Annual recertification", kind: "seal", note: "Income $46,100 — within limit." },
      { date: "2026-08-02", label: "Documents imported", kind: "neutral", note: "4 documents, 22 fields extracted." },
      { date: "2026-08-03", label: "NAUR violation flagged", kind: "reject", note: "LIHTC-004 v3.1 — 8823 exposure." },
    ],
  },
  {
    id: "TIC-2026-0407",
    household: "Reyes, Anita",
    unit: "Cedar Crossing · 08C",
    propertyId: "cedar-crossing",
    certType: "Initial",
    effective: "2026-07-01",
    status: "approved",
    programs: ["LIHTC", "HOME"],
    hhSize: 4,
    amiTier: "60% AMI",
    annualIncome: 44120,
    assets: 3100,
    ttp: 1103,
    aiScore: 98.7,
    fields: [
      { label: "Annual gross income", value: "$44,120.00", confidence: 99.5, source: "VOE_Employer.pdf", page: 1, verified: true },
      { label: "Household size", value: "4", confidence: 99.9, source: "TIC_Signed.pdf", page: 1, verified: true },
      { label: "Gross rent", value: "$1,103.00", confidence: 99.2, source: "Lease.pdf", page: 2, verified: true },
      { label: "Net family assets", value: "$3,100.00", confidence: 97.8, source: "Asset_Cert.pdf", page: 1, verified: true },
    ],
    findings: [],
    timeline: [
      { date: "2026-06-12", label: "Application received", kind: "neutral", note: "Waitlist position 4." },
      { date: "2026-06-25", label: "Documents imported", kind: "neutral", note: "9 documents, 58 fields extracted." },
      { date: "2026-06-26", label: "All rules passed", kind: "seal", note: "LIHTC + HOME rule packs, TN state pack v1.4." },
      { date: "2026-06-27", label: "Soft approved", kind: "seal", note: "Reviewer: J. Alvarez — file locked." },
    ],
  },
  {
    id: "TIC-2026-0433",
    household: "Delacroix, Simone",
    unit: "Brazos Landing · 305",
    propertyId: "brazos-landing",
    certType: "Interim",
    effective: "2026-08-10",
    status: "pending",
    programs: ["LIHTC", "HOTMA", "HOME"],
    hhSize: 1,
    amiTier: "50% AMI",
    annualIncome: 21900,
    assets: 800,
    ttp: 548,
    aiScore: 92.3,
    fields: [
      { label: "Annual gross income", value: "$21,900.00", confidence: 96.2, source: "SSA_Award_Letter.pdf", page: 1, verified: true },
      { label: "Student status", value: "Full-time", confidence: 81.4, source: "Lease.pdf", page: 14, verified: false },
      { label: "Exception documentation", value: "Not located", confidence: 64.0, source: "File index", page: 1, verified: false },
    ],
    findings: [
      {
        id: "F-9210",
        ruleId: "LIHTC-005",
        ruleVersion: "v2.6",
        program: "LIHTC",
        title: "Full-time student household without documented exception",
        severity: "critical",
        status: "pending",
        citation: "IRC 42(i)(3)(D)",
        detail:
          "All household members are full-time students and no qualifying exception is documented in the file. The unit does not count toward the applicable fraction until resolved.",
        evidence: {
          doc: "Lease.pdf",
          page: 14,
          paragraph: 3,
          excerpt: "Resident certifies enrollment as a full-time student at Austin Community College for the 2026 term.",
        },
        remediation: "Collect one of the five §42(i)(3)(D) exception verifications, plus the TDHCA student self-certification form.",
      },
      {
        id: "F-9211",
        ruleId: "TX-TDHCA-04",
        ruleVersion: "v1.2",
        program: "LIHTC",
        title: "Texas student self-certification form missing",
        severity: "minor",
        status: "pending",
        citation: "TDHCA Compliance Manual Ch. 5",
        detail: "The state rule pack for TX requires the TDHCA student self-certification in every file with a student member.",
        evidence: { doc: "File index", page: 1, paragraph: 1, excerpt: "TDHCA Student Self-Certification — not present" },
        remediation: "Have the household execute the TDHCA form and re-run the review.",
      },
    ],
    timeline: [
      { date: "2025-09-01", label: "Move-in", kind: "neutral", note: "Initial certification at 50% AMI." },
      { date: "2026-08-04", label: "Interim requested", kind: "neutral", note: "Income decrease reported by household." },
      { date: "2026-08-05", label: "2 findings generated", kind: "flag", note: "LIHTC-005 v2.6, TX-TDHCA-04 v1.2." },
    ],
  },
];

export const PORTFOLIO = {
  properties: 185,
  units: 2400,
  openFindings: 314,
  upcomingRecerts: 176,
  upcomingAudits: 12,
  exposure8823: 9,
  hotmaReadiness: 74,
  nspireReadiness: 81,
  filesReviewed: 4128,
  autoApprovalRate: 68,
  avgReviewMinutes: 4.2,
};

export const RISK_TREND = [
  { month: "Feb", score: 71, findings: 402 },
  { month: "Mar", score: 68, findings: 388 },
  { month: "Apr", score: 64, findings: 351 },
  { month: "May", score: 59, findings: 340 },
  { month: "Jun", score: 55, findings: 327 },
  { month: "Jul", score: 51, findings: 314 },
];

export const FINDINGS_BY_PROGRAM = [
  { program: "LIHTC", count: 128 },
  { program: "HOTMA", count: 96 },
  { program: "Section 8", count: 61 },
  { program: "HOME", count: 29 },
];

export type Course = {
  id: string;
  title: string;
  program: Program;
  level: "Foundations" | "Intermediate" | "Advanced";
  hours: number;
  progress: number;
  summary: string;
  modules: { title: string; minutes: number; topics: string[] }[];
  quiz: { q: string; options: string[]; answer: number; explain: string }[];
};

export const COURSES: Course[] = [
  {
    id: "lihtc-foundations",
    title: "LIHTC Certification Auditing Foundations",
    program: "LIHTC",
    level: "Foundations",
    hours: 6,
    progress: 100,
    summary:
      "How to read a Tenant Income Certification line by line, verify income and assets, and spot the findings a state agency will cite.",
    modules: [
      { title: "Anatomy of a TIC", minutes: 45, topics: ["Part I–VII walkthrough", "Effective vs. signature dates", "Unit designation"] },
      { title: "Income verification hierarchy", minutes: 55, topics: ["Third-party written", "EIV", "Self-certification limits"] },
      { title: "Assets and imputed income", minutes: 50, topics: ["Actual vs. imputed", "Divested assets", "Safe harbor"] },
      { title: "Rent and utility allowances", minutes: 40, topics: ["Gross rent test", "UA methods", "Rent overage cure"] },
      { title: "Common 8823 findings", minutes: 60, topics: ["Category 11", "Student rule", "NAUR"] },
    ],
    quiz: [
      {
        q: "A household's recertified income is 145% of the current AMI limit at a 100% LIHTC property with no deep rent skewing. What happens?",
        options: ["Household must be terminated", "NAUR is triggered for the next comparable vacancy", "Nothing — all units are low-income", "Rent must be raised to market"],
        answer: 2,
        explain: "At a 100% LIHTC property where all units are low-income, there is no market unit to offset, so NAUR has no practical effect.",
      },
      {
        q: "Which document is the highest tier of income verification?",
        options: ["Tenant self-certification", "Third-party written verification", "Verbal verification memo", "Prior year TIC"],
        answer: 1,
        explain: "Third-party written verification sits at the top of the hierarchy in HUD Handbook 4350.3.",
      },
      {
        q: "The gross rent test compares tenant-paid rent plus utility allowance against what?",
        options: ["Market rent", "30% of the imputed income limit", "40% of adjusted income", "The contract rent"],
        answer: 1,
        explain: "IRC 42(g)(2): gross rent may not exceed 30% of the imputed income limit for the unit's AMI tier and bedroom size.",
      },
    ],
  },
  {
    id: "hotma-changes",
    title: "HOTMA: Income, Assets & Hardship",
    program: "HOTMA",
    level: "Intermediate",
    hours: 8,
    progress: 45,
    summary:
      "The 2023–2026 HOTMA implementation in practice: new asset rules, the 10% medical threshold, hardship relief, and over-income monitoring.",
    modules: [
      { title: "What HOTMA changed and when", minutes: 40, topics: ["§102 vs §104", "Compliance dates", "Transition rules"] },
      { title: "Net family assets & the $50k safe harbor", minutes: 60, topics: ["Self-certification", "Excluded assets", "Real property"] },
      { title: "The $102,000 asset limitation", minutes: 45, topics: ["Eligibility bar", "Existing tenants", "Documentation"] },
      { title: "Deductions & the 10% medical threshold", minutes: 55, topics: ["Phase-in", "Elderly/disabled family", "Health & mobility"] },
      { title: "Hardship exemptions", minutes: 50, topics: ["Triggers", "Duration", "Recordkeeping"] },
      { title: "Over-income at 200%", minutes: 45, topics: ["Two-year clock", "Termination vs. market rent", "Notices"] },
    ],
    quiz: [
      {
        q: "A household reports $48,000 in net family assets. What verification is required in 2026?",
        options: ["Third-party verification of every account", "Self-certification is acceptable under the safe harbor", "Imputed income at the HUD passbook rate", "Termination of assistance"],
        answer: 1,
        explain: "Assets at or below the indexed $50,000 safe harbor may be self-certified under 24 CFR 5.618.",
      },
      {
        q: "Unreimbursed medical expenses are deductible above what percentage of annual income under fully phased-in HOTMA?",
        options: ["3%", "5%", "10%", "15%"],
        answer: 2,
        explain: "HOTMA raises the medical/disability expense threshold from 3% to 10% of annual income.",
      },
      {
        q: "A household exceeds 200% of the income limit for a second consecutive year. What is required?",
        options: ["No action", "An interim certification", "Termination of assistance or conversion to market rent", "A hardship exemption"],
        answer: 2,
        explain: "24 CFR 5.618(c): two consecutive years over 200% requires termination or conversion within the required timeframe.",
      },
    ],
  },
  {
    id: "sec8-ttp",
    title: "Section 8 TTP & EIV Reconciliation",
    program: "PBS8",
    level: "Intermediate",
    hours: 5,
    progress: 0,
    summary: "Calculating Total Tenant Payment correctly, processing interims, and reconciling EIV discrepancies without creating a finding.",
    modules: [
      { title: "TTP components", minutes: 45, topics: ["30% adjusted", "10% gross", "Minimum rent"] },
      { title: "Adjusted income deductions", minutes: 50, topics: ["Dependent", "Elderly", "Childcare", "Medical"] },
      { title: "EIV reports in practice", minutes: 55, topics: ["Income report", "New hires", "Discrepancy report"] },
      { title: "Interim recertifications", minutes: 40, topics: ["Mandatory vs. optional", "$2,400 threshold", "Effective dates"] },
    ],
    quiz: [
      {
        q: "TTP is the greatest of which set of values?",
        options: ["30% adjusted monthly income, 10% monthly gross income, minimum rent", "25% gross income or minimum rent", "30% gross income only", "Contract rent minus utility allowance"],
        answer: 0,
        explain: "24 CFR 5.628 defines TTP as the greatest of those amounts (plus any welfare rent where applicable).",
      },
      {
        q: "An EIV discrepancy of $1,900/yr appears. What is the first step?",
        options: ["Terminate assistance", "Ignore it — under $2,400", "Reconcile against third-party verification and document the result", "Process a retroactive interim immediately"],
        answer: 2,
        explain: "Every discrepancy is reconciled and documented; the $2,400 threshold governs interim triggers, not investigation.",
      },
    ],
  },
  {
    id: "home-basics",
    title: "HOME Program Compliance Essentials",
    program: "HOME",
    level: "Foundations",
    hours: 4,
    progress: 20,
    summary: "HOME rents, fixed vs. floating units, annual re-examinations, and layering HOME with LIHTC without tripping either rule set.",
    modules: [
      { title: "HOME basics & the PJ relationship", minutes: 35, topics: ["24 CFR 92", "Affordability periods"] },
      { title: "High and Low HOME rents", minutes: 45, topics: ["Rent limits", "Utility allowances", "Annual updates"] },
      { title: "Fixed vs. floating units", minutes: 40, topics: ["Designation", "Unit substitution"] },
      { title: "Layering HOME with LIHTC", minutes: 50, topics: ["Most restrictive rule", "Conflicting re-exam rules"] },
    ],
    quiz: [
      {
        q: "When HOME and LIHTC layer on the same unit, which rent limit applies?",
        options: ["HOME always", "LIHTC always", "The more restrictive of the two", "Whichever the owner elects"],
        answer: 2,
        explain: "Layered programs are governed by the most restrictive applicable limit.",
      },
      {
        q: "How often must HOME-assisted household income be re-examined?",
        options: ["Every 6 months", "Annually", "Every 3 years", "Only at move-in"],
        answer: 1,
        explain: "24 CFR 92.203 requires annual re-examination using the PJ's elected income definition.",
      },
    ],
  },
];

export const statusLabel: Record<Status, string> = {
  approved: "Approved",
  pending: "In review",
  remediation: "Needs remediation",
  rejected: "Failed",
};

export function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function riskBand(score: number) {
  if (score >= 75) return { label: "High risk", tone: "reject" as const };
  if (score >= 45) return { label: "Medium risk", tone: "flag" as const };
  return { label: "Low risk", tone: "seal" as const };
}
