export type AcademyModule = {
  title: string;
  minutes: number;
  topics: string[];
  lesson: string;
};

export type AcademyQuestion = {
  q: string;
  options: string[];
  answer: number;
  explain: string;
};

export type AcademyCourse = {
  id: string;
  title: string;
  credential: string;
  track: "Compliance & Asset Management" | "Specialized Certifications" | "Aligned Credentials";
  program: string;
  level: "Foundations" | "Intermediate" | "Advanced";
  hours: number;
  progress: number;
  summary: string;
  modules: AcademyModule[];
  quiz: AcademyQuestion[];
};

export const TRACK_A: AcademyCourse[] = [
  {
    id: "ahcp",
    title: "Affordable Housing Compliance Professional",
    credential: "AHCP",
    track: "Compliance & Asset Management",
    program: "Multi-program",
    level: "Foundations",
    hours: 8,
    progress: 0,
    summary:
      "The core credential: how the major affordable programs fit together, what a compliant file looks like, and how to defend it in an audit.",
    modules: [
      {
        title: "The affordable housing program map",
        minutes: 60,
        topics: ["LIHTC vs. Section 8 vs. HOME", "Who regulates what", "Layered deals"],
        lesson:
          "LIHTC is an IRS tax-credit program monitored by state agencies; Section 8 is a HUD rental-assistance program monitored by contract administrators; HOME is a HUD block grant monitored by participating jurisdictions. Each has its own income limits, rent rules, recertification cadence and penalty regime, and a layered property must satisfy every layer simultaneously — the strictest rule always wins.",
      },
      {
        title: "Anatomy of a compliant tenant file",
        minutes: 55,
        topics: ["Application to certification", "Required documents", "Sequencing"],
        lesson:
          "A defensible file tells a chronological story: application, screening, third-party verifications, calculation worksheets, the signed certification, and the lease with all program riders. Verifications must predate the certification effective date, signatures must predate move-in, and every number on the certification must trace back to a document in the file.",
      },
      {
        title: "Income and asset fundamentals",
        minutes: 70,
        topics: ["Annual income", "Anticipated income", "Asset income"],
        lesson:
          "Annual income is the gross amount anticipated for the twelve months following certification, based on current circumstances rather than last year's actuals. Assets are counted through the income they generate, with imputing required once total net family assets exceed the program threshold, and divested assets counted at their pre-divestiture value for two years.",
      },
      {
        title: "Audit defense and corrective action",
        minutes: 55,
        topics: ["Finding categories", "Cure periods", "Documentation of cures"],
        lesson:
          "Most findings are curable if you respond quickly, document the cure, and explain the control you added to prevent recurrence. Keep a correction log with rule citation, owner, due date and evidence — that log is what turns a monitoring visit into a clean report.",
      },
    ],
    quiz: [
      {
        q: "In a layered LIHTC + HOME unit, which income limit applies?",
        options: ["The higher of the two", "The lower (more restrictive) of the two", "Always the HOME limit", "Whichever the tenant chooses"],
        answer: 1,
        explain: "Layered deals must satisfy every program, so the more restrictive limit governs.",
      },
      {
        q: "Annual income is best described as:",
        options: ["Last year's W-2 total", "Gross income anticipated for the next 12 months", "Net take-home pay", "Income after deductions"],
        answer: 1,
        explain: "Programs project forward from current circumstances using gross income.",
      },
      {
        q: "A third-party verification is dated two weeks AFTER the certification effective date. This is:",
        options: ["Fine, verifications may be dated any time", "A finding — verification must support the effective date", "Only a problem at HOME properties", "Cured by a tenant signature"],
        answer: 1,
        explain: "Verifications must be current as of and support the effective date of the certification.",
      },
      {
        q: "Assets divested for less than fair market value are counted:",
        options: ["Never", "At their pre-divestiture value for two years", "Only if over $100,000", "For five years"],
        answer: 1,
        explain: "Divested assets are counted at the value before divestiture for two years.",
      },
    ],
  },
  {
    id: "compliance-manager",
    title: "Compliance Manager Certification",
    credential: "CMC",
    track: "Compliance & Asset Management",
    program: "Multi-program",
    level: "Intermediate",
    hours: 9,
    progress: 0,
    summary:
      "Run a compliance department: file review workflows, QC sampling, staff training, agency relationships and reporting to ownership.",
    modules: [
      {
        title: "Building a file review workflow",
        minutes: 55,
        topics: ["Pre-move-in review", "Two-tier review", "Turnaround SLAs"],
        lesson:
          "Approve every initial certification before move-in, not after. A two-tier workflow — site prepares, compliance approves — catches income math and missing verifications while they can still be fixed without a household disruption.",
      },
      {
        title: "Quality control sampling",
        minutes: 50,
        topics: ["Sample size", "Risk weighting", "Error rate tracking"],
        lesson:
          "Sample enough files to estimate an error rate, weighting new staff, new acquisitions and complex households more heavily. Track error rate by type and by reviewer so training targets the actual failure mode instead of everything at once.",
      },
      {
        title: "Training and retention of reviewers",
        minutes: 45,
        topics: ["Onboarding curriculum", "Certification tracking", "Knowledge retention"],
        lesson:
          "New reviewers need a structured 90-day curriculum ending in a graded assessment; ongoing staff need refreshers whenever a rule pack changes. Keep a credential matrix showing who holds which certification and when each expires.",
      },
      {
        title: "Reporting to owners and agencies",
        minutes: 50,
        topics: ["Monitoring visits", "Owner certifications", "Risk dashboards"],
        lesson:
          "Owners care about credit recapture exposure, not file counts. Report a portfolio risk score, open findings by severity, upcoming recertification load and any 8823 exposure, then attach the correction plan with dates.",
      },
    ],
    quiz: [
      {
        q: "When should an initial certification be approved?",
        options: ["Within 30 days of move-in", "Before the household moves in", "At the first annual recertification", "Whenever the agency requests it"],
        answer: 1,
        explain: "Initial certifications must be complete and approved before occupancy of the unit.",
      },
      {
        q: "QC sampling should be weighted toward:",
        options: ["Long-tenured staff", "New staff, new acquisitions and complex households", "Studio units", "Files with no findings"],
        answer: 1,
        explain: "Risk-weighted sampling finds more errors per file reviewed.",
      },
      {
        q: "The most useful metric to report to ownership is:",
        options: ["Number of files reviewed", "Portfolio risk and recapture exposure", "Average review minutes", "Number of emails sent"],
        answer: 1,
        explain: "Ownership manages financial exposure; risk and recapture translate compliance into dollars.",
      },
      {
        q: "A rule pack update should trigger:",
        options: ["Nothing until the next audit", "Re-evaluation of affected files and staff refresher training", "Termination of affected households", "A new lease for everyone"],
        answer: 1,
        explain: "Rule changes require both re-evaluation of files and training so the change sticks.",
      },
    ],
  },
  {
    id: "asset-management",
    title: "Affordable Housing Asset Management Certification",
    credential: "AHAM",
    track: "Compliance & Asset Management",
    program: "Multi-program",
    level: "Advanced",
    hours: 10,
    progress: 0,
    summary:
      "Protect the value of an affordable asset: partnership obligations, credit delivery, reserves, year-15 planning and investor reporting.",
    modules: [
      {
        title: "Partnership structure and obligations",
        minutes: 60,
        topics: ["LP/GP roles", "Guarantees", "Reporting covenants"],
        lesson:
          "The limited partnership agreement, not the regulatory agreement, drives most asset-management deadlines: quarterly reporting, operating deficit guarantees, replacement reserve funding and consent rights on major decisions. Compliance failures usually surface first as a covenant breach.",
      },
      {
        title: "Credit delivery and adjusters",
        minutes: 55,
        topics: ["Placed-in-service", "8609 elections", "Credit adjusters"],
        lesson:
          "Investors fund on projected credit delivery; a unit that is out of compliance reduces qualified basis and triggers an adjuster payment from the general partner. Tracking applicable fraction monthly is the cheapest insurance an asset manager can buy.",
      },
      {
        title: "Operating performance and reserves",
        minutes: 55,
        topics: ["NOI drivers", "Replacement reserves", "Deferred maintenance"],
        lesson:
          "Affordable assets have capped revenue, so expense discipline and turnover speed drive NOI. Underfunded replacement reserves show up years later as NSPIRE findings and capital calls.",
      },
      {
        title: "Year 15 and disposition",
        minutes: 60,
        topics: ["Compliance period vs. extended use", "Qualified contract", "Right of first refusal"],
        lesson:
          "The 15-year compliance period ends the recapture risk but not the extended-use restrictions, which typically run 30 years or more. Plan the exit — buyout, resyndication or sale — at least three years out.",
      },
    ],
    quiz: [
      {
        q: "The extended use agreement typically runs for:",
        options: ["5 years", "15 years", "30 years or more", "Until the first sale"],
        answer: 2,
        explain: "Extended use commitments generally run 30+ years beyond the compliance period.",
      },
      {
        q: "A non-compliant unit reduces:",
        options: ["Replacement reserves", "Qualified basis and credit delivery", "The applicable percentage", "The utility allowance"],
        answer: 1,
        explain: "Out-of-compliance units drop out of qualified basis, reducing credits and triggering adjusters.",
      },
      {
        q: "Most asset-management deadlines originate in:",
        options: ["The regulatory agreement", "The partnership agreement", "The lease", "The QAP"],
        answer: 1,
        explain: "Reporting, guarantees and consent rights live in the LP agreement.",
      },
      {
        q: "The compliance period for LIHTC is:",
        options: ["10 years", "15 years", "20 years", "30 years"],
        answer: 1,
        explain: "The compliance period is 15 years; the credit period is 10.",
      },
    ],
  },
  {
    id: "portfolio-compliance",
    title: "Portfolio Compliance Certification",
    credential: "PCC",
    track: "Compliance & Asset Management",
    program: "Multi-program",
    level: "Advanced",
    hours: 8,
    progress: 0,
    summary:
      "Scale compliance across many properties, states and programs: rule pack management, risk scoring, centralized review and audit calendars.",
    modules: [
      {
        title: "Multi-state rule pack management",
        minutes: 50,
        topics: ["QAP variation", "Versioning", "Effective dates"],
        lesson:
          "Every state agency layers its own QAP requirements on top of Section 42 — utility allowance methods, recertification waivers, form sets and monitoring frequency all vary. Version your rule packs and record which version evaluated each file so a later change never invalidates a historic review.",
      },
      {
        title: "Portfolio risk scoring",
        minutes: 45,
        topics: ["Severity weighting", "Property scores", "Trend analysis"],
        lesson:
          "Score properties on open critical findings, document completeness, recertification timeliness and inspection history. A trending score tells ownership whether the portfolio is improving; a snapshot only tells them today's pain.",
      },
      {
        title: "Centralized review operations",
        minutes: 50,
        topics: ["Queue design", "Escalation paths", "Soft approval"],
        lesson:
          "A central queue with automated triage lets specialists handle only the exceptions. AI pre-review can soft-approve clean files and route anything with a critical finding straight to a manager for human final sign-off.",
      },
      {
        title: "Audit and monitoring calendars",
        minutes: 45,
        topics: ["Monitoring cycles", "Owner certifications", "Evidence packets"],
        lesson:
          "Build a rolling calendar of state monitoring visits, owner certification deadlines and inspection windows, and pre-assemble evidence packets 30 days ahead of each. Preparation converts an audit from an event into a routine.",
      },
    ],
    quiz: [
      {
        q: "Rule packs should be versioned because:",
        options: ["Agencies require version numbers", "A later rule change must not invalidate a historic review", "It reduces storage", "Investors require it"],
        answer: 1,
        explain: "Reviews must be reproducible against the rules in effect at the time.",
      },
      {
        q: "Which file should bypass AI soft approval and go to a human manager?",
        options: ["A clean recertification", "A file with an open critical finding", "A studio unit file", "A file with no assets"],
        answer: 1,
        explain: "Critical findings always require human review before any approval.",
      },
      {
        q: "Utility allowance methods are set by:",
        options: ["The IRS only", "State agency policy within federal options", "The tenant", "The investor"],
        answer: 1,
        explain: "States choose among permitted methods, so UA rules vary by state.",
      },
      {
        q: "Portfolio risk scoring is most useful when it is:",
        options: ["A single snapshot", "Trended over time", "Reported annually", "Kept internal to compliance"],
        answer: 1,
        explain: "Trends show whether corrective action is actually working.",
      },
    ],
  },
  {
    id: "hotma-specialist",
    title: "HOTMA Specialist",
    credential: "HOTMA-S",
    track: "Specialized Certifications",
    program: "HOTMA",
    level: "Advanced",
    hours: 7,
    progress: 0,
    summary:
      "Sections 102 and 104 in practice: the new income and asset rules, de minimis thresholds, interim policies and the certification changes they force.",
    modules: [
      {
        title: "Section 102 income changes",
        minutes: 55,
        topics: ["Income exclusions", "Interim recertification triggers", "Safe harbor"],
        lesson:
          "HOTMA narrows what counts as income, adds a fixed list of exclusions, and changes when interim recertifications are required — generally when income increases by a threshold amount rather than at every change. Owners must adopt written interim policies consistent with the rule.",
      },
      {
        title: "Section 104 asset rules",
        minutes: 55,
        topics: ["$50,000 asset cap", "Self-certification", "Real property restriction"],
        lesson:
          "Households with net assets at or below the inflation-adjusted $50,000 threshold may self-certify assets, and households owning suitable real property may be restricted from assistance. Retirement accounts are treated differently than under legacy rules.",
      },
      {
        title: "Implementation and file impact",
        minutes: 45,
        topics: ["Effective dates", "Form changes", "Grandfathering"],
        lesson:
          "Apply HOTMA rules from the effective date forward; do not retroactively recalculate closed certifications. Update forms, worksheets and software so income exclusions and asset self-certification appear where reviewers will actually see them.",
      },
      {
        title: "Common HOTMA findings",
        minutes: 40,
        topics: ["Wrong threshold", "Missing policy", "Improper interim"],
        lesson:
          "The three most common findings are using the pre-HOTMA asset rules, having no written interim recertification policy, and processing interims that the new rule no longer permits.",
      },
    ],
    quiz: [
      {
        q: "Under HOTMA Section 104, households may self-certify assets when net assets are:",
        options: ["Under $5,000", "At or below the inflation-adjusted $50,000 threshold", "Under $100,000", "Any amount"],
        answer: 1,
        explain: "Section 104 permits self-certification below the adjusted $50,000 threshold.",
      },
      {
        q: "HOTMA rules should be applied:",
        options: ["Retroactively to all files", "From the effective date forward", "Only at move-in", "Only at HUD properties"],
        answer: 1,
        explain: "Apply prospectively; do not recalculate closed certifications.",
      },
      {
        q: "An owner with no written interim recertification policy is:",
        options: ["Compliant by default", "Out of compliance with HOTMA", "Only at risk at HUD properties", "Required to terminate interims"],
        answer: 1,
        explain: "HOTMA requires written interim policies consistent with the rule.",
      },
      {
        q: "HOTMA Section 102 primarily changes:",
        options: ["Inspection standards", "Income determination and interim triggers", "Rent limits", "Fair housing rules"],
        answer: 1,
        explain: "Section 102 governs income; Section 104 governs assets.",
      },
    ],
  },
  {
    id: "tracs",
    title: "TRACS Certification",
    credential: "TRACS",
    track: "Specialized Certifications",
    program: "Section 8",
    level: "Intermediate",
    hours: 6,
    progress: 0,
    summary:
      "Transmit clean vouchers: TRACS transaction types, MAT records, tenant certification submission, discrepancies and voucher reconciliation.",
    modules: [
      {
        title: "TRACS and MAT basics",
        minutes: 45,
        topics: ["MAT10 records", "Transaction codes", "Submission cycle"],
        lesson:
          "TRACS receives tenant data (MAT records) and voucher data from the site software and pays subsidy against it. Certifications must be transmitted and accepted before the corresponding voucher line will pay.",
      },
      {
        title: "Certification transactions",
        minutes: 45,
        topics: ["IC, AR, IR, MO, TM", "Effective dates", "Correction transactions"],
        lesson:
          "Each event has a transaction type — initial certification, annual, interim, move-out, termination — and each must carry the correct effective date. Corrections replace the original transaction rather than stacking on top of it.",
      },
      {
        title: "Voucher preparation and reconciliation",
        minutes: 45,
        topics: ["HAP requests", "Adjustments", "Repayment agreements"],
        lesson:
          "The voucher must tie to the accepted tenant certifications, with adjustments explained line by line. Unexplained variances become discrepancies that suspend payment.",
      },
      {
        title: "Fatal errors and discrepancies",
        minutes: 40,
        topics: ["Fatal vs. non-fatal", "Late certifications", "Query resolution"],
        lesson:
          "Fatal errors stop a record from posting; non-fatal errors post but flag. Work the discrepancy report weekly — the older an error is, the harder it is to reconcile against paid vouchers.",
      },
    ],
    quiz: [
      {
        q: "A voucher line will not pay until the related certification is:",
        options: ["Printed", "Transmitted and accepted in TRACS", "Signed by the tenant", "Approved by the state agency"],
        answer: 1,
        explain: "TRACS pays against accepted tenant records.",
      },
      {
        q: "A fatal TRACS error means the record:",
        options: ["Posts with a warning", "Does not post at all", "Posts next month", "Is paid at 50%"],
        answer: 1,
        explain: "Fatal errors block posting entirely.",
      },
      {
        q: "The transaction type for an annual recertification is:",
        options: ["IC", "AR", "IR", "MO"],
        answer: 1,
        explain: "AR is the annual recertification transaction.",
      },
      {
        q: "Discrepancy reports should be worked:",
        options: ["Annually", "Weekly", "Only at audit", "Only when payment stops"],
        answer: 1,
        explain: "Frequent review keeps errors reconcilable against paid vouchers.",
      },
    ],
  },
  {
    id: "nspire",
    title: "REAC / NSPIRE Inspection Training",
    credential: "NSPIRE",
    track: "Specialized Certifications",
    program: "Inspections",
    level: "Intermediate",
    hours: 6,
    progress: 0,
    summary:
      "Prepare for and pass NSPIRE: the three inspectable areas, life-threatening deficiencies, correction timeframes and self-inspection programs.",
    modules: [
      {
        title: "From REAC/UPCS to NSPIRE",
        minutes: 40,
        topics: ["Standards shift", "Unit-first focus", "Scoring changes"],
        lesson:
          "NSPIRE replaces UPCS with a health-and-safety-first framework that weights the inside of the unit most heavily. Deficiencies are defined by standard, severity and correction timeframe rather than by inspector judgment alone.",
      },
      {
        title: "Inspectable areas and standards",
        minutes: 50,
        topics: ["Unit", "Inside", "Outside"],
        lesson:
          "The three inspectable areas are Unit, Inside and Outside. Life-threatening deficiencies — exposed wiring, blocked egress, missing or non-working smoke and CO alarms, gas leaks — must be corrected within 24 hours.",
      },
      {
        title: "Self-inspection and readiness",
        minutes: 45,
        topics: ["Annual self-inspections", "Work order tie-in", "Evidence"],
        lesson:
          "NSPIRE expects owners to inspect every unit annually and to document corrections. Tie self-inspection findings to work orders with photos so the evidence exists before the inspector arrives.",
      },
      {
        title: "Scoring, appeals and follow-up",
        minutes: 40,
        topics: ["Score bands", "Correction certification", "Appeals"],
        lesson:
          "Scores drive inspection frequency and can trigger enforcement. Certify corrections on time and appeal only with documentary evidence — photos, invoices and dated work orders.",
      },
    ],
    quiz: [
      {
        q: "A life-threatening deficiency must be corrected within:",
        options: ["24 hours", "72 hours", "30 days", "Before the next inspection"],
        answer: 0,
        explain: "Life-threatening deficiencies carry a 24-hour correction timeframe.",
      },
      {
        q: "NSPIRE weights which area most heavily?",
        options: ["Outside", "Inside common areas", "The unit", "The site office"],
        answer: 2,
        explain: "NSPIRE is unit-first: resident health and safety inside the home.",
      },
      {
        q: "How often must owners self-inspect units under NSPIRE?",
        options: ["Every 5 years", "Every 3 years", "Annually", "Only at turnover"],
        answer: 2,
        explain: "Annual self-inspection of every unit is expected.",
      },
      {
        q: "The strongest support for an appeal is:",
        options: ["A phone call", "Dated photos, invoices and work orders", "A staff memo", "A tenant letter"],
        answer: 1,
        explain: "Documentary evidence is what reverses a deficiency.",
      },
    ],
  },
  {
    id: "home-lihtc-combined",
    title: "HOME & LIHTC Combined Compliance",
    credential: "HLC",
    track: "Specialized Certifications",
    program: "HOME + LIHTC",
    level: "Advanced",
    hours: 7,
    progress: 0,
    summary:
      "Where the two programs collide: fixed vs. floating units, conflicting rent and income limits, recertification differences and over-income rules.",
    modules: [
      {
        title: "Two rulebooks, one unit",
        minutes: 50,
        topics: ["24 CFR 92 vs. IRC 42", "Monitoring bodies", "Most restrictive rule"],
        lesson:
          "HOME is monitored by the participating jurisdiction under 24 CFR Part 92; LIHTC by the state housing agency under Section 42. When they conflict, apply the more restrictive requirement and document which rule drove the decision.",
      },
      {
        title: "Fixed and floating HOME units",
        minutes: 45,
        topics: ["Designation", "Unit substitution", "Tracking"],
        lesson:
          "HOME units may be fixed to specific apartments or float across comparable units. Floating designations require careful tracking so that the required number and mix of HOME units is occupied by eligible households at all times.",
      },
      {
        title: "Rents, limits and utility allowances",
        minutes: 45,
        topics: ["High/Low HOME rents", "LIHTC gross rent", "UA differences"],
        lesson:
          "HOME sets High and Low HOME rents that may sit below the LIHTC ceiling, and the two programs can require different utility allowance methodologies. Always calculate both and charge the lower resulting rent.",
      },
      {
        title: "Recertification and over-income",
        minutes: 45,
        topics: ["Annual HOME recert", "LIHTC 140% rule", "Rent increase on over-income"],
        lesson:
          "HOME requires annual income recertification with source documentation on a schedule that differs from LIHTC, and over-income HOME households face rent adjustments rather than the LIHTC next-available-unit rule.",
      },
    ],
    quiz: [
      {
        q: "When HOME and LIHTC rules conflict, you apply:",
        options: ["The federal default", "The more restrictive rule", "The LIHTC rule", "The HOME rule"],
        answer: 1,
        explain: "Layered properties must satisfy both, so the stricter rule governs.",
      },
      {
        q: "Floating HOME units require:",
        options: ["No tracking", "Continuous tracking of designation and occupancy", "Annual redesignation by HUD", "Fixed unit numbers in the lease"],
        answer: 1,
        explain: "The required count and mix must be maintained at all times.",
      },
      {
        q: "HOME income recertification with source documentation is generally required:",
        options: ["Never", "Annually", "Every 3 years", "Only at move-in"],
        answer: 1,
        explain: "HOME requires annual recertification, with rules that differ from LIHTC.",
      },
      {
        q: "If High HOME rent is below the LIHTC maximum rent, you charge:",
        options: ["The LIHTC maximum", "The lower of the two", "The average", "Market rent"],
        answer: 1,
        explain: "Charge the lower resulting rent to satisfy both programs.",
      },
    ],
  },
  {
    id: "bond-compliance",
    title: "Bond Compliance (Tax-Exempt Bond / Section 142(d))",
    credential: "BCS",
    track: "Specialized Certifications",
    program: "Bond",
    level: "Advanced",
    hours: 6,
    progress: 0,
    summary:
      "Tax-exempt bond financing rules: set-aside elections, the 95/5 test, continuing disclosure, and how bond rules differ from Section 42.",
    modules: [
      {
        title: "Set-aside elections",
        minutes: 45,
        topics: ["20/50", "40/60", "Irrevocable election"],
        lesson:
          "At the time of the bond issue the owner elects either 20% of units at 50% AMI or 40% at 60% AMI. The election is irrevocable and applies for the qualified project period, independent of the LIHTC minimum set-aside.",
      },
      {
        title: "Bond vs. LIHTC differences",
        minutes: 45,
        topics: ["Available unit rule", "Income limit updates", "Qualified project period"],
        lesson:
          "Bond rules use their own next-available-unit application and do not follow every Section 42 nuance. The qualified project period typically runs the later of 15 years from 50% occupancy or the date the bonds are retired.",
      },
      {
        title: "Monitoring and reporting",
        minutes: 40,
        topics: ["Form 8703", "Issuer reporting", "Continuing disclosure"],
        lesson:
          "Owners file Form 8703 annually with the IRS certifying the set-aside, and separately satisfy issuer and trustee reporting under the regulatory agreement and continuing disclosure undertaking.",
      },
      {
        title: "Failure and remediation",
        minutes: 35,
        topics: ["Noncompliance consequences", "Taxability", "Cure"],
        lesson:
          "Set-aside failure can render the bonds taxable — a far worse outcome than a credit disallowance. Monitor set-aside occupancy monthly and cure vacancies with eligible households immediately.",
      },
    ],
    quiz: [
      {
        q: "The bond set-aside election is:",
        options: ["Changeable annually", "Irrevocable for the qualified project period", "Set by the state agency", "Optional"],
        answer: 1,
        explain: "The 20/50 or 40/60 election is made at issuance and is irrevocable.",
      },
      {
        q: "Owners annually certify bond set-aside compliance on:",
        options: ["Form 8609", "Form 8703", "Form 8823", "Form 50059"],
        answer: 1,
        explain: "Form 8703 is the annual certification for qualified residential rental projects.",
      },
      {
        q: "Failing the bond set-aside can cause:",
        options: ["A credit adjuster only", "The bonds to become taxable", "A REAC deduction", "A fair housing complaint"],
        answer: 1,
        explain: "Loss of tax-exempt status is the primary bond risk.",
      },
      {
        q: "A 40/60 election requires:",
        options: ["40% of units at 50% AMI", "40% of units at 60% AMI", "60% of units at 40% AMI", "20% of units at 60% AMI"],
        answer: 1,
        explain: "40/60 means at least 40% of units occupied at or below 60% AMI.",
      },
    ],
  },
  {
    id: "blended-occupancy",
    title: "Blended Occupancy Compliance (LIHTC + HOME + Section 8)",
    credential: "BOC",
    track: "Specialized Certifications",
    program: "Blended",
    level: "Advanced",
    hours: 8,
    progress: 0,
    summary:
      "Manage a property where three programs govern the same households: stacked eligibility, rent calculation order, recertification calendars and file structure.",
    modules: [
      {
        title: "Stacking eligibility rules",
        minutes: 55,
        topics: ["Eligibility order", "Student rules", "Household composition"],
        lesson:
          "Screen against every applicable program before approving a household — the LIHTC student rule, the HOME income limit and the Section 8 eligibility rules can each disqualify an applicant the others would accept.",
      },
      {
        title: "Rent calculation order",
        minutes: 50,
        topics: ["Contract rent", "Tenant portion", "Gross rent test"],
        lesson:
          "With project-based assistance, gross rent for the LIHTC test is the contract rent plus utility allowance, not the tenant portion. Calculate each program's maximum, then charge the lowest permissible amount.",
      },
      {
        title: "Recertification calendars",
        minutes: 45,
        topics: ["Annual vs. waived", "Interim triggers", "Effective date alignment"],
        lesson:
          "Section 8 and HOME require annual recertification even where the state has waived LIHTC recertification at 100% properties. Align effective dates so one interview satisfies all three programs.",
      },
      {
        title: "File structure for three programs",
        minutes: 50,
        topics: ["Single file, layered tabs", "Cross-references", "Audit navigation"],
        lesson:
          "Keep one household file with clearly tabbed program sections and a cover sheet showing which programs apply to the unit. Auditors from three different bodies should each find their evidence without reorganizing your file.",
      },
    ],
    quiz: [
      {
        q: "At a project-based Section 8 unit, LIHTC gross rent equals:",
        options: ["The tenant portion", "Contract rent plus utility allowance", "Market rent", "The HAP payment only"],
        answer: 1,
        explain: "Gross rent for the LIHTC test is contract rent plus the utility allowance.",
      },
      {
        q: "If the state waived LIHTC annual recertification, Section 8 recertification is:",
        options: ["Also waived", "Still required annually", "Required every 3 years", "Optional"],
        answer: 1,
        explain: "A LIHTC waiver has no effect on Section 8 or HOME requirements.",
      },
      {
        q: "An applicant passing HOME and Section 8 but failing the LIHTC student rule is:",
        options: ["Eligible", "Ineligible for the LIHTC unit", "Eligible with a waiver", "Eligible after 12 months"],
        answer: 1,
        explain: "Every applicable program must be satisfied.",
      },
      {
        q: "The best blended file structure is:",
        options: ["Separate files per program", "One household file with tabbed program sections", "Digital only, unsorted", "Whatever the site prefers"],
        answer: 1,
        explain: "One file with clear program tabs keeps evidence traceable for all three auditors.",
      },
    ],
  },
];
