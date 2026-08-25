/** Controlled federal program-pack coverage and authority registry. */
export const FEDERAL_PROGRAM_PACK_REGISTRY_BUILD =
  "federal-program-pack-registry-2026.08.2";

const pack = (entry) =>
  Object.freeze({
    ...entry,
    officialSources: Object.freeze(entry.officialSources),
    requiredControls: Object.freeze(entry.requiredControls),
    verifiedRules: Object.freeze(
      (entry.verifiedRules ?? []).map((rule) =>
        Object.freeze({ ...rule, evidenceFields: Object.freeze(rule.evidenceFields) }),
      ),
    ),
    sourceHierarchy: Object.freeze({
      programGuidance: Object.freeze(entry.sourceHierarchy.programGuidance),
      controllingLaw: Object.freeze(entry.sourceHierarchy.controllingLaw),
    }),
  });

export const FEDERAL_JURISDICTION_DIRECTORY = Object.freeze({
  role: "JURISDICTION_DISCOVERY_ONLY",
  url: "https://www.hud.gov/states/",
  complianceRuleAuthority: false,
});

export const STATE_PROGRAM_OVERLAYS = Object.freeze({
  CA_TAX_EXEMPT_BOND_CDLAC: Object.freeze({
    jurisdiction: "CA",
    program: "TAX_EXEMPT_BOND",
    role: "STATE_PROGRAM_OVERLAY",
    url: "https://www.treasurer.ca.gov/cdlac",
    federalBaselineAuthority: false,
  }),
});

export const FEDERAL_PROGRAM_RULE_PACKS = Object.freeze({
  LIHTC: pack({
    program: "LIHTC",
    packId: "federal-lihtc",
    activationStatus: "PARTIAL",
    citation: "26 U.S.C. 42(g); HUD MTSP income limits",
    officialSources: Object.freeze([
      "https://uscode.house.gov/view.xhtml?req=(title:26%20section:42%20edition:prelim)",
      "https://www.huduser.gov/portal/datasets/mtsp.html",
    ]),
    sourceHierarchy: {
      programGuidance: ["https://www.huduser.gov/portal/datasets/mtsp.html"],
      controllingLaw: ["https://uscode.house.gov/view.xhtml?req=(title:26%20section:42%20edition:prelim)"],
    },
    requiredControls: ["controlled_income_limit_receipt", "project_election", "student_status", "rent_and_utility_allowance"],
  }),
  HOME: pack({
    program: "HOME",
    packId: "federal-home",
    activationStatus: "BLOCKED",
    citation: "24 CFR 92.203, 92.252, and 92.253",
    officialSources: Object.freeze([
      "https://www.hudexchange.info/programs/home/",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-92",
    ]),
    sourceHierarchy: {
      programGuidance: ["https://www.hudexchange.info/programs/home/"],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-92"],
    },
    requiredControls: ["controlled_home_income_limit_receipt", "home_rent_limit", "lease_restrictions", "period_of_affordability"],
    verifiedRules: [
      {
        id: "HOME-INCOME-DETERMINATION",
        citation: "24 CFR 92.203 and 92.252(g)",
        requirement: "Determine income initially and re-examine it on the applicable cycle during the affordability period.",
        evidenceFields: ["income_determination_source", "income_determination_date", "annual_income", "household_size"],
      },
      {
        id: "HOME-RENT-LIMIT",
        citation: "24 CFR 92.252(a)-(c)",
        requirement: "Tenant rent plus the applicable utility allowance must not exceed the controlled HOME rent limit.",
        evidenceFields: ["controlled_home_rent_limit_receipt", "tenant_rent", "utility_allowance", "unit_bedrooms", "rent_designation"],
      },
      {
        id: "HOME-AFFORDABILITY-PERIOD",
        citation: "24 CFR 92.252(d)",
        requirement: "Recorded affordability restrictions must remain in force for the applicable 5-, 10-, 15-, or 20-year minimum period.",
        evidenceFields: ["project_completion_date", "rental_activity", "home_funds_per_unit", "recorded_restriction_end_date"],
      },
      {
        id: "HOME-LEASE-AND-TENANT-PROTECTIONS",
        citation: "24 CFR 92.253",
        requirement: "Use a written lease, exclude prohibited terms, and follow the required tenancy and selection protections.",
        evidenceFields: ["lease", "lease_term", "vawa_addendum", "tenant_selection_policy", "termination_notice"],
      },
    ],
  }),
  HTF: pack({
    program: "HTF",
    packId: "federal-htf",
    activationStatus: "BLOCKED",
    citation: "24 CFR 93.151 and 93.302",
    officialSources: Object.freeze([
      "https://www.hudexchange.info/programs/htf/",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-93",
    ]),
    sourceHierarchy: {
      programGuidance: ["https://www.hudexchange.info/programs/htf/"],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-93"],
    },
    requiredControls: ["controlled_htf_income_limit_receipt", "htf_rent_limit", "extremely_low_income_targeting"],
    verifiedRules: [
      {
        id: "HTF-INCOME-DETERMINATION",
        citation: "24 CFR 93.151, 93.250, and 93.302(a)",
        requirement: "Determine each assisted household's annual income and apply the fiscal-year HTF income-targeting rule.",
        evidenceFields: ["income_determination_source", "income_determination_date", "annual_income", "household_size", "htf_grant_fiscal_year"],
      },
      {
        id: "HTF-RENT-LIMIT",
        citation: "24 CFR 93.302(b)-(c)",
        requirement: "HTF rent plus utilities must not exceed the controlled HTF rent limit, subject to the project-based subsidy exception.",
        evidenceFields: ["controlled_htf_rent_limit_receipt", "tenant_rent", "utility_allowance", "unit_bedrooms", "project_based_subsidy"],
      },
      {
        id: "HTF-AFFORDABILITY-PERIOD",
        citation: "24 CFR 93.302(d)",
        requirement: "HTF-assisted rental units must remain affordable for at least 30 years after project completion under a recorded restriction.",
        evidenceFields: ["project_completion_date", "recorded_restriction_start_date", "recorded_restriction_end_date"],
      },
      {
        id: "HTF-ANNUAL-INCOME-REEXAMINATION",
        citation: "24 CFR 93.302(e)",
        requirement: "Re-examine each tenant's annual income every year during the affordability period using the grantee-selected method.",
        evidenceFields: ["last_income_reexamination_date", "review_due_date", "grantee_income_method"],
      },
      {
        id: "HTF-LEASE-AND-TENANT-PROTECTIONS",
        citation: "24 CFR 93.303",
        requirement: "Use a written lease, exclude prohibited terms, and follow the required tenancy and selection protections.",
        evidenceFields: ["lease", "lease_term", "vawa_addendum", "tenant_selection_policy", "termination_notice"],
      },
    ],
  }),
  HCV_TENANT_BASED: pack({
    program: "HCV_TENANT_BASED",
    packId: "federal-hcv",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.609, 5.618, and 982.516; Notice PIH 2023-27",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
      "https://www.hud.gov/helping-americans/housing-choice-vouchers",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hud.gov/helping-americans/housing-choice-vouchers",
        "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
      ],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618"],
    },
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_implementation_authority", "asset_enforcement_policy", "real_property_restriction"],
  }),
  HUD_PBV: pack({
    program: "HUD_PBV",
    packId: "federal-hud-pbv",
    activationStatus: "BLOCKED",
    citation: "24 CFR parts 5 and 983; Notice PIH 2024-19",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-983",
      "https://www.hud.gov/helping-americans/housing-choice-vouchers-project",
    ]),
    sourceHierarchy: {
      programGuidance: ["https://www.hud.gov/helping-americans/housing-choice-vouchers-project"],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-983"],
    },
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_implementation_authority", "hap_contract_authority", "asset_enforcement_policy"],
  }),
  HUD_MFH_PROJECT_BASED: pack({
    program: "HUD_MFH_PROJECT_BASED",
    packId: "federal-hud-multifamily",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.609 and 5.618; Notice H 2025-07",
    officialSources: Object.freeze([
      "https://www.hud.gov/hud-partners/multifamily",
      "https://www.hud.gov/hud-partners/multifamily-hotma",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hud.gov/hud-partners/multifamily",
        "https://www.hud.gov/hud-partners/multifamily-hotma",
      ],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618"],
    },
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_adoption_status", "tenant_selection_plan", "asset_enforcement_policy"],
    mandatoryComplianceDate: "2027-01-01",
  }),
  PUBLIC_HOUSING: pack({
    program: "PUBLIC_HOUSING",
    packId: "federal-public-housing",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.618 and part 960; HOTMA sections 102-104",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.hud.gov/hud-partners/hotma",
      "https://www.hud.gov/helping-americans/public-housing",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hud.gov/helping-americans/public-housing",
        "https://www.hud.gov/hud-partners/hotma",
      ],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618"],
    },
    requiredControls: ["controlled_public_housing_income_limit", "admissions_and_continued_occupancy_policy", "asset_enforcement_policy", "over_income_period"],
  }),
  RURAL_DEVELOPMENT: pack({
    program: "RURAL_DEVELOPMENT",
    packId: "federal-usda-rd",
    activationStatus: "BLOCKED",
    citation: "7 CFR 3560.152 and 3560.202",
    officialSources: Object.freeze(["https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XXXV/part-3560"]),
    sourceHierarchy: {
      programGuidance: [],
      controllingLaw: ["https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XXXV/part-3560"],
    },
    requiredControls: ["controlled_usda_income_limit_receipt", "borrower_project_authority", "occupancy_and_rent_controls"],
  }),
  TAX_EXEMPT_BOND: pack({
    program: "TAX_EXEMPT_BOND",
    packId: "federal-tax-exempt-bond",
    activationStatus: "BLOCKED",
    citation: "26 U.S.C. 142(d)",
    officialSources: Object.freeze([
      "https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section142",
    ]),
    sourceHierarchy: {
      programGuidance: [],
      controllingLaw: ["https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section142"],
    },
    requiredControls: ["controlled_income_limit_receipt", "bond_election", "next_available_unit_rule", "set_aside_fraction"],
  }),
});

export function federalProgramPackStatus(program) {
  return FEDERAL_PROGRAM_RULE_PACKS[String(program ?? "").toUpperCase()] ?? null;
}

export function federalProgramPackGate(program) {
  const entry = federalProgramPackStatus(program);
  if (!entry) throw new RangeError(`Unsupported federal program pack: ${program}`);
  return Object.freeze({
    id: `FED-${entry.program}-SUBSTANTIVE-PACK-GATE`,
    version: FEDERAL_PROGRAM_PACK_REGISTRY_BUILD,
    jurisdiction: "federal",
    severity: "critical",
    requires: Object.freeze([]),
    citation: entry.citation,
    description: `A validated substantive ${entry.program} rule pack is required.`,
    activationStatus: "blocked",
    officialSources: entry.officialSources,
    verifiedRules: entry.verifiedRules,
    missingControls: entry.requiredControls,
    evaluate: () => ({
      status: "UNABLE_TO_DETERMINE",
      explanation: `The ${entry.program} production pack is inactive pending controlled authority for: ${entry.requiredControls.join(", ")}.`,
    }),
  });
}
