/* ------------------------------------------------------------------ *
 * FREE review program and the sales back office (demo data)
 * ------------------------------------------------------------------ */

export const FREE_REVIEW_OFFER = {
  reviews: 3,
  label: "3 FREE certification reviews",
  blurb: "No card required. Use your 3 FREE reviews when you're ready.",
};

/** Merlin's guided FREE-review checklist. */
export const TRIAL_TASKS = [
  {
    id: "learn",
    title: "Learn the platform with Merlin",
    lead: "A 6-minute guided tour of the dashboard, review queue and rule packs.",
    merlin: "Follow my wand — I'll show you where compliance hides.",
    cta: "Take the tour",
    to: "/welcome" as const,
    minutes: 6,
  },
  {
    id: "upload-cert",
    title: "Upload your first certification",
    lead: "Drop a TIC, income certification or recert packet. AI scores it Pass/Fail with cited rules.",
    merlin: "Give me your ugliest file. I love a challenge.",
    cta: "Upload a certification",
    to: "/files" as const,
    minutes: 4,
  },
  {
    id: "mass-upload",
    title: "Mass upload your property details",
    lead: "Excel, CSV or a software export — AI maps the columns to CertivoIQ fields.",
    merlin: "One spreadsheet, one poof, a whole portfolio.",
    cta: "Mass upload properties",
    to: "/launchpad" as const,
    minutes: 12,
  },
  {
    id: "delegate",
    title: "Send onboarding links to your team",
    lead: "Enterprise customers can invite regionals and property managers to upload their own property details.",
    merlin: "Delegation is the strongest magic there is.",
    cta: "Send invite links",
    to: "/launchpad" as const,
    minutes: 3,
    enterpriseOnly: true,
  },
];

export const INVITE_ROLES = [
  { id: "regional", label: "Regional manager", scope: "All properties in a region" },
  { id: "pm", label: "Property manager", scope: "One property" },
  { id: "compliance", label: "Compliance specialist", scope: "Certifications & findings" },
  { id: "owner", label: "Owner / asset manager", scope: "Read-only portfolio view" },
];

export const TRIAL_INVITES = [
  { name: "Dana Whitfield", role: "Regional manager", email: "dwhitfield@harborline.com", scope: "Southeast · 14 properties", status: "uploaded" },
  { name: "Marcus Bell", role: "Property manager", email: "mbell@harborline.com", scope: "Harper Mill Lofts", status: "in progress" },
  { name: "Priya Raman", role: "Compliance specialist", email: "praman@harborline.com", scope: "Certifications", status: "invited" },
  { name: "Tom Alcott", role: "Property manager", email: "talcott@harborline.com", scope: "Cedar Grove", status: "invited" },
];

/* ------------------------------------------------------------------ *
 * Back office CRM
 * ------------------------------------------------------------------ */

export type LeadStage = "new" | "trialing" | "trial ended" | "negotiation" | "won" | "lost";

export const STAGE_TONE: Record<LeadStage, "seal" | "flag" | "reject" | "neutral"> = {
  new: "neutral",
  trialing: "seal",
  "trial ended": "flag",
  negotiation: "neutral",
  won: "seal",
  lost: "reject",
};

export type Lead = {
  id: string;
  company: string;
  units: number;
  hq: string;
  linkedin: string;
  stage: LeadStage;
  arr: number;
  plan: string;
  owner: string;
  source: string;
  trialEnded?: string;
  remindersSent: number;
  lastTouch: string;
  contacts: { name: string; title: string; email: string; phone: string; linkedin: string }[];
};

export const LEADS: Lead[] = [
  {
    id: "harborline",
    company: "Harborline Residential Group",
    units: 12480,
    hq: "Nashville, TN",
    linkedin: "linkedin.com/company/harborline-residential",
    stage: "trialing",
    arr: 59988,
    plan: "Enterprise",
    owner: "R. Ortiz",
    source: "Marketing email · LaunchPad landing page",
    remindersSent: 0,
    lastTouch: "Today",
    contacts: [
      { name: "Denise Hollowell", title: "VP of Property Management", email: "dhollowell@harborline.com", phone: "(615) 555-0148", linkedin: "linkedin.com/in/denise-hollowell" },
      { name: "Craig Munsey", title: "Director of Compliance", email: "cmunsey@harborline.com", phone: "(615) 555-0192", linkedin: "linkedin.com/in/craig-munsey" },
    ],
  },
  {
    id: "verdant",
    company: "Verdant Housing Partners",
    units: 7320,
    hq: "Atlanta, GA",
    linkedin: "linkedin.com/company/verdant-housing-partners",
    stage: "trial ended",
    arr: 17988,
    plan: "Business",
    owner: "K. Adeyemi",
    source: "Webinar · HOTMA readiness",
    trialEnded: "Yesterday",
    remindersSent: 1,
    lastTouch: "FREE review follow-up sent",
    contacts: [
      { name: "Alicia Trent", title: "SVP Asset Management", email: "atrent@verdantpartners.com", phone: "(404) 555-0113", linkedin: "linkedin.com/in/alicia-trent" },
      { name: "Bo Randall", title: "VP of Property Management", email: "brandall@verdantpartners.com", phone: "(404) 555-0170", linkedin: "linkedin.com/in/bo-randall" },
    ],
  },
  {
    id: "cascade",
    company: "Cascade Affordable Communities",
    units: 21140,
    hq: "Portland, OR",
    linkedin: "linkedin.com/company/cascade-affordable",
    stage: "negotiation",
    arr: 59988,
    plan: "Enterprise",
    owner: "R. Ortiz",
    source: "Outbound · LinkedIn sequence",
    remindersSent: 2,
    lastTouch: "Security review scheduled",
    contacts: [
      { name: "Marta Quilliam", title: "Chief Operating Officer", email: "mquilliam@cascadeac.org", phone: "(503) 555-0122", linkedin: "linkedin.com/in/marta-quilliam" },
      { name: "Devon Pike", title: "VP Compliance & Risk", email: "dpike@cascadeac.org", phone: "(503) 555-0139", linkedin: "linkedin.com/in/devon-pike" },
    ],
  },
  {
    id: "keystone",
    company: "Keystone Bridge Management",
    units: 3860,
    hq: "Philadelphia, PA",
    linkedin: "linkedin.com/company/keystone-bridge-mgmt",
    stage: "new",
    arr: 17988,
    plan: "Business",
    owner: "Unassigned",
    source: "Auto-populated · non-subscriber list",
    remindersSent: 0,
    lastTouch: "Never contacted",
    contacts: [
      { name: "Rosalind Fahey", title: "VP of Property Management", email: "rfahey@keystonebridge.com", phone: "(215) 555-0166", linkedin: "linkedin.com/in/rosalind-fahey" },
    ],
  },
  {
    id: "sunbelt",
    company: "Sunbelt Equity Housing",
    units: 9450,
    hq: "Phoenix, AZ",
    linkedin: "linkedin.com/company/sunbelt-equity-housing",
    stage: "new",
    arr: 59988,
    plan: "Enterprise",
    owner: "Unassigned",
    source: "Auto-populated · non-subscriber list",
    remindersSent: 0,
    lastTouch: "Never contacted",
    contacts: [
      { name: "Hector Salgado", title: "EVP Operations", email: "hsalgado@sunbelteh.com", phone: "(602) 555-0104", linkedin: "linkedin.com/in/hector-salgado" },
      { name: "Jen Whitlow", title: "VP of Property Management", email: "jwhitlow@sunbelteh.com", phone: "(602) 555-0187", linkedin: "linkedin.com/in/jen-whitlow" },
    ],
  },
  {
    id: "granite",
    company: "Granite Row Communities",
    units: 1240,
    hq: "Manchester, NH",
    linkedin: "linkedin.com/company/granite-row",
    stage: "won",
    arr: 7188,
    plan: "Professional",
    owner: "K. Adeyemi",
    source: "Referral",
    remindersSent: 1,
    lastTouch: "Subscribed · onboarding in LaunchPad",
    contacts: [
      { name: "Ellen Mbeki", title: "Director of Compliance", email: "embeki@graniterow.com", phone: "(603) 555-0151", linkedin: "linkedin.com/in/ellen-mbeki" },
    ],
  },
  {
    id: "lakeshore",
    company: "Lakeshore Property Trust",
    units: 5680,
    hq: "Milwaukee, WI",
    linkedin: "linkedin.com/company/lakeshore-property-trust",
    stage: "lost",
    arr: 17988,
    plan: "Business",
    owner: "R. Ortiz",
    source: "Trade show",
    trialEnded: "12 days ago",
    remindersSent: 3,
    lastTouch: "Renewed with incumbent — revisit Q1",
    contacts: [
      { name: "Grant Petrosian", title: "VP of Property Management", email: "gpetrosian@lakeshorept.com", phone: "(414) 555-0129", linkedin: "linkedin.com/in/grant-petrosian" },
    ],
  },
];

export const PIPELINE_STAGES: LeadStage[] = ["new", "trialing", "trial ended", "negotiation", "won", "lost"];

export const SALES_KPIS = [
  { label: "Open pipeline", value: "$1.94M", note: "Annualized · 38 active opportunities" },
  { label: "FREE review leads", value: "23", note: "9 enterprise · 14 business" },
  { label: "FREE review → paid conversion", value: "41%", note: "+6 pts vs last quarter" },
  { label: "Auto-populated leads", value: "612", note: "Non-subscribing companies in market" },
];

/**
 * Marketing campaigns for the 3 FREE review acquisition funnel.
 * These replace the former seven-day trial and expiry campaign language.
 */
export const EMAIL_CAMPAIGNS = [
  {
    id: "free-review-follow-up",
    name: "3 FREE reviews — first follow-up",
    trigger: "Automated · after a FREE review lead is captured",
    audience: "FREE review leads without a subscription",
    sent: 184,
    opened: 121,
    clicked: 67,
    converted: 24,
    automated: true,
  },
  {
    id: "free-review-remaining",
    name: "3 FREE reviews — remaining review reminder",
    trigger: "Automated · after a customer has unused FREE reviews",
    audience: "FREE review leads with remaining review capacity",
    sent: 96,
    opened: 58,
    clicked: 31,
    converted: 11,
    automated: true,
  },
  {
    id: "free-review-complete",
    name: "FREE review complete — plan recommendation",
    trigger: "Automated · after a FREE certification review is completed",
    audience: "FREE review leads ready for a plan recommendation",
    sent: 64,
    opened: 47,
    clicked: 26,
    converted: 9,
    automated: true,
  },
  {
    id: "vp-outbound",
    name: "VP of Property Management outbound",
    trigger: "Manual sequence · 4 touches",
    audience: "Auto-populated non-subscribers",
    sent: 940,
    opened: 402,
    clicked: 148,
    converted: 19,
    automated: false,
  },
];

export const LANDING_CLICKS = [
  { company: "Verdant Housing Partners", person: "Bo Randall", title: "VP of Property Management", campaign: "FREE review follow-up", page: "/welcome", when: "18 min ago", visits: 3 },
  { company: "Sunbelt Equity Housing", person: "Jen Whitlow", title: "VP of Property Management", campaign: "VP outbound", page: "/pricing", when: "1 hr ago", visits: 2 },
  { company: "Cascade Affordable Communities", person: "Devon Pike", title: "VP Compliance & Risk", campaign: "FREE review reminder", page: "/welcome", when: "3 hrs ago", visits: 5 },
  { company: "Keystone Bridge Management", person: "Rosalind Fahey", title: "VP of Property Management", campaign: "VP outbound", page: "/welcome", when: "Yesterday", visits: 1 },
  { company: "Lakeshore Property Trust", person: "Grant Petrosian", title: "VP of Property Management", campaign: "FREE review complete", page: "/pricing", when: "2 days ago", visits: 4 },
];

/* ------------------------------------------------------------------ *
 * Landing page instructional video
 * ------------------------------------------------------------------ */

export const PENALTY_RISKS = [
  { risk: "Miscalculated household income", cost: "Unit disqualified · credits recaptured", detail: "A single overlooked bonus, self-employment schedule or asset imputation flips a unit out of compliance for the whole year." },
  { risk: "Late or missing recertification", cost: "IRS Form 8823 finding", detail: "Manual calendars slip. One missed annual recert can put an entire building's set-aside in question." },
  { risk: "Wrong rent or utility allowance", cost: "Gross-rent violation, non-curable", detail: "Applying last year's utility allowance overcharges the resident and permanently loses the credit for that unit." },
  { risk: "Unsigned or expired verifications", cost: "File rejected at audit", detail: "Third-party verifications older than 120 days, missing signatures and blank certifications are the most common findings." },
  { risk: "HOTMA asset & income errors", cost: "Repayment agreements + HUD sanctions", detail: "The $50,000 asset limit, imputed returns and de minimis rules changed the math on every file after 2024." },
  { risk: "Student-status and set-aside mistakes", cost: "Unit non-compliance", detail: "Full-time student households and blended LIHTC/HOME/Section 8 set-asides trip up even experienced reviewers." },
  { risk: "Blended-program conflicts", cost: "Findings under two programs at once", detail: "The stricter rule always wins. Human reviewers routinely apply the wrong program's threshold." },
  { risk: "Inconsistent reviewer judgment", cost: "Unpredictable audit outcomes", detail: "Two reviewers, two answers. CertivoIQ applies the same versioned rule pack to every single file." },
];
