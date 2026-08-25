/** Controlled federal program-pack coverage and authority registry. */
export const FEDERAL_PROGRAM_PACK_REGISTRY_BUILD =
  "federal-program-pack-registry-2026.08.1";

const pack = (entry) => Object.freeze({ ...entry, requiredControls: Object.freeze(entry.requiredControls) });

export const FEDERAL_PROGRAM_RULE_PACKS = Object.freeze({
  LIHTC: pack({
    program: "LIHTC",
    packId: "federal-lihtc",
    activationStatus: "PARTIAL",
    citation: "26 U.S.C. 42(g); HUD MTSP income limits",
    officialSources: Object.freeze([
      "https://www.govinfo.gov/link/uscode/26/42",
      "https://www.huduser.gov/portal/datasets/mtsp.html",
    ]),
    requiredControls: ["controlled_income_limit_receipt", "project_election", "student_status", "rent_and_utility_allowance"],
  }),
  HOME: pack({
    program: "HOME",
    packId: "federal-home",
    activationStatus: "BLOCKED",
    citation: "24 CFR 92.203, 92.252, and 92.253",
    officialSources: Object.freeze(["https://www.ecfr.gov/current/title-24/subtitle-A/part-92"]),
    requiredControls: ["controlled_home_income_limit_receipt", "home_rent_limit", "lease_restrictions", "period_of_affordability"],
  }),
  HTF: pack({
    program: "HTF",
    packId: "federal-htf",
    activationStatus: "BLOCKED",
    citation: "24 CFR 93.151 and 93.302",
    officialSources: Object.freeze(["https://www.ecfr.gov/current/title-24/subtitle-A/part-93"]),
    requiredControls: ["controlled_htf_income_limit_receipt", "htf_rent_limit", "extremely_low_income_targeting"],
  }),
  HCV_TENANT_BASED: pack({
    program: "HCV_TENANT_BASED",
    packId: "federal-hcv",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.609, 24 CFR 5.618, and 24 CFR 982.516; Notice PIH 2023-27",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
    ]),
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
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_implementation_authority", "hap_contract_authority", "asset_enforcement_policy"],
  }),
  HUD_MFH_PROJECT_BASED: pack({
    program: "HUD_MFH_PROJECT_BASED",
    packId: "federal-hud-multifamily",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.609 and 5.618; Notice H 2025-07",
    officialSources: Object.freeze(["https://www.hud.gov/hud-partners/multifamily-hotma"]),
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
    ]),
    requiredControls: ["controlled_public_housing_income_limit", "admissions_and_continued_occupancy_policy", "asset_enforcement_policy", "over_income_period"],
  }),
  RURAL_DEVELOPMENT: pack({
    program: "RURAL_DEVELOPMENT",
    packId: "federal-usda-rd",
    activationStatus: "BLOCKED",
    citation: "7 CFR 3560.152 and 3560.202",
    officialSources: Object.freeze(["https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XXXV/part-3560"]),
    requiredControls: ["controlled_usda_income_limit_receipt", "borrower_project_authority", "occupancy_and_rent_controls"],
  }),
  TAX_EXEMPT_BOND: pack({
    program: "TAX_EXEMPT_BOND",
    packId: "federal-tax-exempt-bond",
    activationStatus: "BLOCKED",
    citation: "26 U.S.C. 142(d)",
    officialSources: Object.freeze(["https://www.govinfo.gov/link/uscode/26/142"]),
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
    missingControls: entry.requiredControls,
    evaluate: () => ({
      status: "UNABLE_TO_DETERMINE",
      explanation: `The ${entry.program} production pack is inactive pending controlled authority for: ${entry.requiredControls.join(", ")}.`,
    }),
  });
}
