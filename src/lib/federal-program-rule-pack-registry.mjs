/** Controlled federal program-pack coverage and authority registry. */
export const FEDERAL_PROGRAM_PACK_REGISTRY_BUILD =
  "federal-program-pack-registry-2026.08.4";

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

const stateOverlay = (entry) =>
  Object.freeze({
    ...entry,
    officialSources: Object.freeze(entry.officialSources),
    requiredControls: Object.freeze(entry.requiredControls),
    verifiedRules: Object.freeze(
      entry.verifiedRules.map((rule) =>
        Object.freeze({ ...rule, evidenceFields: Object.freeze(rule.evidenceFields) }),
      ),
    ),
  });

export const FEDERAL_JURISDICTION_DIRECTORY = Object.freeze({
  role: "JURISDICTION_DISCOVERY_ONLY",
  url: "https://www.hud.gov/states/",
  complianceRuleAuthority: false,
});

export const STATE_PROGRAM_OVERLAYS = Object.freeze({
  CA_TAX_EXEMPT_BOND_CDLAC: stateOverlay({
    jurisdiction: "CA",
    program: "TAX_EXEMPT_BOND",
    role: "STATE_PROGRAM_OVERLAY",
    url: "https://www.treasurer.ca.gov/cdlac",
    federalBaselineAuthority: false,
    activationStatus: "BLOCKED",
    citation: "4 CCR 5000 et seq., including sections 5107 and 5112",
    officialSources: [
      "https://www.treasurer.ca.gov/cdlac/qrrp",
      "https://www.treasurer.ca.gov/cdlac/regulations",
      "https://www.treasurer.ca.gov/sites/default/files/2026-03/approved.pdf",
      "https://www.treasurer.ca.gov/cdlac/compliance",
    ],
    requiredControls: [
      "controlled_cdlac_regulations_receipt",
      "cdlac_committee_resolution",
      "recorded_bond_regulatory_agreement",
      "controlled_cdlac_reporting_notice",
    ],
    verifiedRules: [
      {
        id: "CA-CDLAC-QRRP-MINIMUM-INCOME-RESTRICTION",
        citation: "4 CCR 5107(a)(1)",
        requirement: "Restrict gross rents for at least 10 percent of project units to households with income no greater than 50 percent of AMI, with the required unit distribution and bedroom mix.",
        evidenceFields: ["cdlac_committee_resolution", "total_residential_units", "restricted_50_ami_units", "unit_distribution", "bedroom_mix"],
      },
      {
        id: "CA-CDLAC-QRRP-GROSS-RENT-AND-UTILITY-EVIDENCE",
        citation: "4 CCR 5107(a)(2) and 5107(c)",
        requirement: "Apply the Committee Resolution's rent restrictions using gross rent and support the applicable utility allowance with current permitted evidence.",
        evidenceFields: ["cdlac_committee_resolution", "tenant_paid_rent", "utility_allowance", "utility_allowance_source", "rent_comparability_matrix", "unit_type"],
      },
      {
        id: "CA-CDLAC-QRRP-MINIMUM-RESTRICTION-TERM",
        citation: "4 CCR 5107(d) and 5112(c)(2)",
        requirement: "Maintain the resolution's income and rent restrictions for the 55-year CDLAC qualified project period, or the applicable 50-year Native American Lands term or approved tenant-homeownership exception.",
        evidenceFields: ["fifty_percent_occupancy_date", "cdlac_qualified_project_period_start", "native_american_lands_status", "recorded_restriction_end_date", "tenant_homeownership_exception"],
      },
      {
        id: "CA-CDLAC-QRRP-REGULATORY-AGREEMENT",
        citation: "4 CCR 5112(a) and 5112(c)",
        requirement: "Execute and record a Bond Regulatory Agreement that incorporates the CDLAC resolution, applicable income and affordability restrictions, and required change/default notices.",
        evidenceFields: ["recorded_bond_regulatory_agreement", "cdlac_committee_resolution", "recording_date", "ownership_change_notice", "default_notice"],
      },
      {
        id: "CA-CDLAC-QRRP-COMPLIANCE-REPORTING",
        citation: "4 CCR 5013 through 5015 and current CDLAC compliance guidance",
        requirement: "Submit the applicable sponsor and issuer compliance certifications on the cadence and deadline stated in the current controlled CDLAC reporting notice.",
        evidenceFields: ["controlled_cdlac_reporting_notice", "certificate_of_completion_date", "sponsor_certification", "issuer_self_certification", "submission_date"],
      },
    ],
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
    citation: "24 CFR 5.609, 24 CFR 5.618, and 24 CFR 982.516; Notice PIH 2023-27 Revision 3 and Notice PIH 2024-38",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
      "https://www.hud.gov/helping-americans/housing-choice-vouchers",
      "https://www.hud.gov/hud-partners/hotma",
      "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-982",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hud.gov/helping-americans/housing-choice-vouchers",
        "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
        "https://www.hud.gov/hud-partners/hotma",
      ],
      controllingLaw: [
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
        "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-982",
      ],
    },
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_implementation_authority", "asset_enforcement_policy", "real_property_restriction"],
    verifiedRules: [
      {
        id: "HCV-ADMISSION-ELIGIBILITY",
        citation: "24 CFR 982.201 and 24 CFR 5.618(a)",
        requirement: "Determine program, income, citizenship, social-security-number, and admission asset eligibility before HCV admission.",
        evidenceFields: ["controlled_section8_income_limit_receipt", "annual_income", "household_size", "citizenship_status", "ssn_disclosure_status", "net_family_assets", "real_property_ownership"],
      },
      {
        id: "HCV-INCOME-REEXAMINATION",
        citation: "24 CFR 982.516",
        requirement: "Conduct annual and required interim income/composition examinations with the prescribed verification and effective-date treatment.",
        evidenceFields: ["last_reexamination_date", "income_change_date", "adjusted_income_change_percent", "third_party_verification", "pha_reexamination_policy"],
      },
      {
        id: "HCV-ASSET-RESTRICTION-AND-POLICY",
        citation: "24 CFR 5.618",
        requirement: "Apply the asset and suitable-real-property restrictions at admission; at reexamination, apply the PHA's written enforcement or exception policy.",
        evidenceFields: ["determination_type", "net_family_assets", "controlled_asset_threshold", "real_property_ownership", "real_property_suitability", "pha_asset_enforcement_policy"],
      },
    ],
  }),
  HUD_PBV: pack({
    program: "HUD_PBV",
    packId: "federal-hud-pbv",
    activationStatus: "BLOCKED",
    citation: "24 CFR parts 5 and 983; Notice PIH 2024-19",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-983",
      "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-982/subpart-K/section-982.516",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.hud.gov/helping-americans/housing-choice-vouchers-project",
    ]),
    sourceHierarchy: {
      programGuidance: ["https://www.hud.gov/helping-americans/housing-choice-vouchers-project"],
      controllingLaw: [
        "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-983",
        "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-982/subpart-K/section-982.516",
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      ],
    },
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_implementation_authority", "hap_contract_authority", "asset_enforcement_policy"],
    verifiedRules: [
      {
        id: "PBV-PARTICIPANT-ELIGIBILITY",
        citation: "24 CFR 983.251 and 24 CFR 982.201",
        requirement: "Determine PBV eligibility using current verified information and confirm total tenant payment is below gross rent before assistance begins.",
        evidenceFields: ["eligibility_determination_date", "controlled_section8_income_limit_receipt", "annual_income", "household_size", "total_tenant_payment", "gross_rent"],
      },
      {
        id: "PBV-CONTRACT-UNIT-ELIGIBILITY",
        citation: "24 CFR 983.52, 983.53, and 983.208",
        requirement: "Use only eligible contract units, avoid prohibited subsidy combinations, and maintain units under the applicable HAP/HQS requirements.",
        evidenceFields: ["hap_contract", "unit_subsidy_inventory", "unit_occupancy", "inspection_date", "inspection_standard", "deficiency_cure_status"],
      },
      {
        id: "PBV-LEASE",
        citation: "24 CFR 983.256",
        requirement: "Use an executed written lease with the HUD tenancy addendum and all required unit, rent, utility, service, and term provisions.",
        evidenceFields: ["lease", "hud_tenancy_addendum", "initial_lease_term", "lease_unit", "tenant_rent", "utility_responsibility"],
      },
      {
        id: "PBV-REASONABLE-RENT",
        citation: "24 CFR 983.301 through 983.305",
        requirement: "Keep rent to owner within the applicable cap and reasonable-rent determination supported by current comparability evidence.",
        evidenceFields: ["rent_to_owner", "rent_cap", "reasonable_rent_determination", "comparable_units", "utility_responsibility", "hap_contract_anniversary"],
      },
      {
        id: "PBV-HOTMA-INCOME-AND-ASSETS",
        citation: "24 CFR 5.618 and 24 CFR 982.516",
        requirement: "Apply HCV income-review and asset rules, including the admission/reexamination policy distinction, to PBV families.",
        evidenceFields: ["determination_type", "last_reexamination_date", "net_family_assets", "controlled_asset_threshold", "real_property_ownership", "pha_asset_enforcement_policy"],
      },
    ],
  }),
  HUD_MFH_PROJECT_BASED: pack({
    program: "HUD_MFH_PROJECT_BASED",
    packId: "federal-hud-multifamily",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.609, 5.618, 5.657, and 5.659; Notice H 2025-07 and Notice PIH 2023-27 Revision 3",
    officialSources: Object.freeze([
      "https://www.hud.gov/hud-partners/multifamily",
      "https://www.hud.gov/hud-partners/multifamily-hotma",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/subpart-F/section-5.657",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/subpart-F/section-5.659",
      "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hud.gov/hud-partners/multifamily",
        "https://www.hud.gov/hud-partners/multifamily-hotma",
        "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
      ],
      controllingLaw: [
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/subpart-F/section-5.657",
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/subpart-F/section-5.659",
      ],
    },
    requiredControls: ["controlled_section8_income_limit_receipt", "hotma_adoption_status", "tenant_selection_plan", "asset_enforcement_policy"],
    mandatoryComplianceDate: "2027-01-01",
    verifiedRules: [
      {
        id: "MFH-HOTMA-IMPLEMENTATION-STATUS",
        citation: "Notice H 2025-07; Notice PIH 2023-27 Revision 3, section 6.2",
        requirement: "Track property-level HOTMA adoption; full compliance is mandatory January 1, 2027, with required TSP/EIV and tenant-file steps for early adoption.",
        evidenceFields: ["mfh_program_subtype", "hotma_adoption_date", "tenant_selection_plan_revision", "eiv_policy_revision", "tracs_version", "tenant_file_annotation"],
      },
      {
        id: "MFH-INCOME-REEXAMINATION",
        citation: "24 CFR 5.657 and 5.659",
        requirement: "Conduct at least annual income/composition reexaminations and retain the required family information and verification.",
        evidenceFields: ["mfh_program_subtype", "last_reexamination_date", "annual_income", "adjusted_income", "third_party_verification", "consent_form"],
      },
      {
        id: "MFH-ASSET-RESTRICTION-APPLICABILITY",
        citation: "24 CFR 5.618; Notice PIH 2023-27 Revision 3, sections 2 and 4",
        requirement: "Apply Section 104 asset restrictions only to applicable Multifamily subtypes, including Section 8 PBRA and 202/8, and not to listed PRAC/PRA/PAC/SPRAC programs.",
        evidenceFields: ["mfh_program_subtype", "determination_type", "net_family_assets", "controlled_asset_threshold", "real_property_ownership", "owner_asset_enforcement_policy"],
      },
    ],
  }),
  PUBLIC_HOUSING: pack({
    program: "PUBLIC_HOUSING",
    packId: "federal-public-housing",
    activationStatus: "BLOCKED",
    citation: "24 CFR 5.618 and 24 CFR part 960; HOTMA sections 102-104; Notice PIH 2023-27 Revision 3",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
      "https://www.hud.gov/hud-partners/hotma",
      "https://www.hud.gov/helping-americans/public-housing",
      "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-960",
      "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hud.gov/helping-americans/public-housing",
        "https://www.hud.gov/hud-partners/hotma",
        "https://www.hud.gov/sites/dfiles/PIH/documents/PIH%202023-27%20HOTMA.pdf",
      ],
      controllingLaw: [
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.618",
        "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-IX/part-960",
      ],
    },
    requiredControls: ["controlled_public_housing_income_limit", "admissions_and_continued_occupancy_policy", "asset_enforcement_policy", "over_income_period"],
    verifiedRules: [
      {
        id: "PUBLIC-HOUSING-ADMISSION-ELIGIBILITY",
        citation: "24 CFR 960.201 and 24 CFR 5.618(a)",
        requirement: "Admit only eligible low-income families after applying the required program, income, and admission asset restrictions.",
        evidenceFields: ["controlled_public_housing_income_limit", "annual_income", "household_size", "net_family_assets", "real_property_ownership", "admission_eligibility_record"],
      },
      {
        id: "PUBLIC-HOUSING-INCOME-REEXAMINATION",
        citation: "24 CFR 960.257 and 960.259",
        requirement: "Conduct the applicable annual, triennial, and interim examinations and retain the prescribed verification.",
        evidenceFields: ["rent_option", "last_reexamination_date", "income_change_date", "adjusted_income_change_percent", "third_party_verification", "acop_reexamination_policy"],
      },
      {
        id: "PUBLIC-HOUSING-ASSET-RESTRICTION-AND-POLICY",
        citation: "24 CFR 5.618",
        requirement: "Apply the asset and suitable-real-property restrictions at admission; at reexamination, apply the PHA's written enforcement or exception policy.",
        evidenceFields: ["determination_type", "net_family_assets", "controlled_asset_threshold", "real_property_ownership", "real_property_suitability", "acop_asset_enforcement_policy"],
      },
      {
        id: "PUBLIC-HOUSING-OVER-INCOME-PERIOD",
        citation: "24 CFR 960.507",
        requirement: "Track consecutive over-income months and issue the prescribed notices and continued-occupancy action at 12 and 24 months.",
        evidenceFields: ["controlled_very_low_income_limit", "over_income_start_date", "income_examination_dates", "notice_dates", "acop_over_income_policy", "continued_occupancy_action"],
      },
    ],
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
      "https://www.govinfo.gov/link/uscode/26/142",
    ]),
    sourceHierarchy: {
      programGuidance: [],
      controllingLaw: [
        "https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section142",
        "https://www.govinfo.gov/link/uscode/26/142",
      ],
    },
    requiredControls: [
      "controlled_income_limit_receipt",
      "bond_election_document",
      "qualified_project_period",
      "current_income_determinations",
      "next_available_unit_tracking",
      "annual_irs_certification",
    ],
    programBoundaries: Object.freeze([
      "A 26 U.S.C. 42(g)(1)(C) average-income election does not replace the issuer's 20-50 or 40-60 election under 26 U.S.C. 142(d)(1).",
      "The baseline 20-50 and 40-60 tests in 26 U.S.C. 142(d)(1) do not independently impose a federal gross-rent limit; rent findings require a deep-rent-skewing election or another controlling program, regulatory agreement, or state overlay.",
      "When section 42 credit is allowed, section 142(d)(3)(C) changes the next-available-unit comparison scope from project to section 42 building.",
    ]),
    verifiedRules: [
      {
        id: "TEB-QRR-SET-ASIDE-ELECTION",
        citation: "26 U.S.C. 142(d)(1)",
        requirement: "Throughout the qualified project period, satisfy the issuer's issue-date election of either at least 20 percent of units occupied by households at or below 50 percent of AMGI or at least 40 percent at or below 60 percent of AMGI.",
        evidenceFields: ["bond_issue_date", "bond_election_document", "bond_election", "total_residential_units", "qualified_units", "controlled_income_limit_receipt", "household_income_by_unit"],
      },
      {
        id: "TEB-QRR-QUALIFIED-PROJECT-PERIOD",
        citation: "26 U.S.C. 142(d)(2)(A)",
        requirement: "Track the qualified project period from the first day 10 percent of units are occupied through the latest statutory end date tied to 15 years after 50 percent occupancy, bond retirement, or termination of section 8 assistance.",
        evidenceFields: ["ten_percent_occupancy_date", "fifty_percent_occupancy_date", "tax_exempt_bond_outstanding_date", "section_8_assistance_termination_date", "qualified_project_period"],
      },
      {
        id: "TEB-QRR-CURRENT-INCOME-DETERMINATION",
        citation: "26 U.S.C. 142(d)(2)(B) and 142(d)(3)(A)",
        requirement: "Determine household income using the section 8-consistent, family-size-adjusted method and complete at least annual current-income determinations unless the statutory no-over-limit-new-resident exception applies for that year.",
        evidenceFields: ["controlled_income_limit_receipt", "household_size", "current_household_income", "income_determination_date", "new_resident_income_inventory", "annual_recertification_exception"],
      },
      {
        id: "TEB-QRR-NEXT-AVAILABLE-UNIT",
        citation: "26 U.S.C. 142(d)(3)(B)-(C)",
        requirement: "After a qualifying resident exceeds 140 percent of the applicable limit, do not rent a comparable or smaller available unit to a new over-limit household; use section 42 building scope instead of project scope when section 42 credit is allowed.",
        evidenceFields: ["over_income_unit", "current_household_income", "controlled_140_percent_limit", "next_available_unit", "next_available_unit_size", "new_resident_income", "section_42_credit_allowed", "section_42_building_id"],
      },
      {
        id: "TEB-QRR-ANNUAL-IRS-CERTIFICATION",
        citation: "26 U.S.C. 142(d)(7)",
        requirement: "The project operator must submit the prescribed annual certification to the Secretary stating whether the project continues to meet section 142(d).",
        evidenceFields: ["annual_irs_certification", "certification_period", "submission_date", "submission_receipt"],
      },
    ],
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
