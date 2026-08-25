/** Controlled federal program-pack coverage and authority registry. */
export const FEDERAL_PROGRAM_PACK_REGISTRY_BUILD =
  "federal-program-pack-registry-2026.08.7";

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
    citation:
      "26 U.S.C. 42(c), 42(g), 42(h)(6), 42(i)(3)(D), and 42(m); 26 CFR 1.42-5",
    officialSources: Object.freeze([
      "https://uscode.house.gov/view.xhtml?req=(title:26%20section:42%20edition:prelim)",
      "https://www.govinfo.gov/link/uscode/26/42",
      "https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/section-1.42-5",
      "https://www.huduser.gov/portal/datasets/mtsp.html",
    ]),
    sourceHierarchy: {
      programGuidance: ["https://www.huduser.gov/portal/datasets/mtsp.html"],
      controllingLaw: [
        "https://uscode.house.gov/view.xhtml?req=(title:26%20section:42%20edition:prelim)",
        "https://www.govinfo.gov/link/uscode/26/42",
        "https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/section-1.42-5",
      ],
    },
    requiredControls: [
      "controlled_income_limit_receipt",
      "project_election",
      "applicable_fraction",
      "unit_income_designation",
      "student_status",
      "rent_and_utility_allowance",
      "next_available_unit_tracking",
      "extended_use_agreement",
      "state_agency_compliance_authority",
    ],
    programBoundaries: Object.freeze([
      "A fixed 60-percent income limit is not universal: the federal minimum-set-aside election may be 20-50, 40-60, or average-income, and average-income units use taxpayer-designated 20-through-80 percent imputed income limitations.",
      "LIHTC participation alone does not activate HOTMA asset restrictions; an independently applicable HUD or other controlling program is required.",
      "A section 42(g)(1)(C) average-income election does not replace the separate issuer election required by section 142(d) for a tax-exempt-bond project.",
      "State QAP, allocation, regulatory-agreement, and extended-use requirements are separate overlays and must not be inferred from the federal baseline.",
    ]),
    verifiedRules: [
      {
        id: "LIHTC-MINIMUM-SET-ASIDE-ELECTION",
        citation: "26 U.S.C. 42(g)(1)",
        requirement: "Apply the taxpayer's irrevocable 20-50, 40-60, or average-income election at project level; for average-income, use only designated 20-through-80 percent increments whose average does not exceed 60 percent.",
        evidenceFields: ["project_election", "election_date", "total_residential_units", "rent_restricted_units", "qualified_households", "unit_income_designations", "average_designation_pct"],
      },
      {
        id: "LIHTC-UNIT-INCOME-AND-RENT",
        citation: "26 U.S.C. 42(g)(1) and 42(g)(2)(A)-(C)",
        requirement: "For each low-income unit, confirm household income against the controlled limit applicable to the project election and unit designation, and keep gross rent including the prescribed utility allowance within 30 percent of the applicable imputed income limitation.",
        evidenceFields: ["controlled_income_limit_receipt", "project_election", "unit_income_designation", "household_size", "household_annual_income", "tenant_paid_rent", "utility_allowance", "applicable_gross_rent_limit"],
      },
      {
        id: "LIHTC-APPLICABLE-FRACTION",
        citation: "26 U.S.C. 42(c)(1)",
        requirement: "Determine qualified basis using the smaller of the building's low-income unit fraction or low-income floor-space fraction at the close of the taxable year.",
        evidenceFields: ["building_id", "low_income_unit_count", "total_residential_unit_count", "low_income_floor_space", "total_residential_floor_space", "applicable_fraction", "qualified_basis"],
      },
      {
        id: "LIHTC-NEXT-AVAILABLE-UNIT",
        citation: "26 U.S.C. 42(g)(2)(D)",
        requirement: "When a low-income household exceeds the applicable 140-percent threshold, preserve low-income-unit status only by satisfying the election-specific next-available-unit rule, including the distinct average-income comparison.",
        evidenceFields: ["project_election", "unit_income_designation", "current_household_income", "controlled_140_percent_threshold", "building_id", "next_available_unit", "next_available_unit_size", "new_household_income", "next_unit_designation"],
      },
      {
        id: "LIHTC-STUDENT-UNIT",
        citation: "26 U.S.C. 42(i)(3)(D)",
        requirement: "Do not treat a unit occupied entirely by full-time students as a low-income unit unless a statutory student exception is documented.",
        evidenceFields: ["household_members", "full_time_student_status", "student_months", "student_exception", "exception_evidence"],
      },
      {
        id: "LIHTC-EXTENDED-USE",
        citation: "26 U.S.C. 42(h)(6)",
        requirement: "Maintain the recorded extended low-income housing commitment for the required extended-use period, subject only to the statutory termination and tenant-protection rules.",
        evidenceFields: ["extended_use_agreement", "recording_date", "compliance_period_start", "extended_use_end_date", "qualified_contract_or_foreclosure_event", "three_year_tenant_protection_end_date"],
      },
      {
        id: "LIHTC-AGENCY-COMPLIANCE-MONITORING",
        citation: "26 U.S.C. 42(m)(1)(B)(iii) and 26 CFR 1.42-5",
        requirement: "Satisfy the state housing credit agency's controlled compliance-monitoring procedure, including required owner certifications, record retention, reviews, inspections, and correction reporting.",
        evidenceFields: ["state_agency_compliance_authority", "owner_annual_certification", "tenant_income_certifications", "rent_records", "record_retention_period", "file_review", "physical_inspection", "noncompliance_notice", "correction_evidence"],
      },
    ],
  }),
  HOME: pack({
    program: "HOME",
    packId: "federal-home",
    activationStatus: "BLOCKED",
    citation: "24 CFR 92.203, 92.252, and 92.253",
    officialSources: Object.freeze([
      "https://www.hudexchange.info/programs/home/",
      "https://www.huduser.gov/portal/datasets/HOME-Income-limits.html",
      "https://www.huduser.gov/portal/datasets/HOME-Rent-limits.html",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-92",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hudexchange.info/programs/home/",
        "https://www.huduser.gov/portal/datasets/HOME-Income-limits.html",
        "https://www.huduser.gov/portal/datasets/HOME-Rent-limits.html",
      ],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-92"],
    },
    requiredControls: ["controlled_home_income_limit_receipt", "controlled_home_rent_limit_receipt", "lease_restrictions", "period_of_affordability"],
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
      "https://www.huduser.gov/portal/datasets/HTF-Income-limits.html",
      "https://www.huduser.gov/portal/datasets/HTF-Rent-limits.html",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-93",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.hudexchange.info/programs/htf/",
        "https://www.huduser.gov/portal/datasets/HTF-Income-limits.html",
        "https://www.huduser.gov/portal/datasets/HTF-Rent-limits.html",
      ],
      controllingLaw: ["https://www.ecfr.gov/current/title-24/subtitle-A/part-93"],
    },
    requiredControls: ["controlled_htf_income_limit_receipt", "controlled_htf_rent_limit_receipt", "controlled_htf_grant_fiscal_year_authority"],
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
    citation:
      "7 CFR 3560.152 through 3560.160, 3560.202 through 3560.205, and 3560.257; 91 FR 18769",
    officialSources: Object.freeze([
      "https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XXXV/part-3560",
      "https://www.federalregister.gov/documents/2026/04/13/2026-07064/revisions-to-the-calculation-of-annual-household-income-and-net-family-assets-in-the-section-515",
      "https://www.usda.gov/guidance-documents/rhs-handbook/rhs/hb-2-3560-mfh-asset-management-handbook",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.603",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.609",
      "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.611",
    ]),
    sourceHierarchy: {
      programGuidance: [
        "https://www.usda.gov/guidance-documents/rhs-handbook/rhs/hb-2-3560-mfh-asset-management-handbook",
      ],
      controllingLaw: [
        "https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XXXV/part-3560",
        "https://www.federalregister.gov/documents/2026/04/13/2026-07064/revisions-to-the-calculation-of-annual-household-income-and-net-family-assets-in-the-section-515",
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.603",
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.609",
        "https://www.ecfr.gov/current/title-24/subtitle-A/part-5/section-5.611",
      ],
    },
    requiredControls: [
      "controlled_usda_income_limit_receipt",
      "controlled_usda_hotma_income_asset_authority",
      "borrower_project_authority",
      "agency_approved_tenant_certification",
      "agency_approved_lease_and_occupancy_rules",
      "agency_approved_rent_and_utility_allowance",
      "rental_assistance_allocation_authority",
    ],
    programBoundaries: Object.freeze([
      "This pack covers direct Rural Development multifamily programs governed by 7 CFR part 3560, including Section 515 and Section 514/516; it does not authorize findings for Section 538 guaranteed properties unless controlling project authority incorporates the same requirement.",
      "The citizenship and qualified-alien phrases in 7 CFR 3560.152(a)(1) and 3560.154(a)(7) have delayed-effective-date notes and must not independently produce an eligibility finding.",
      "HUD Section 8 and LIHTC rules apply only when the household receives those benefits or another controlling project document makes them applicable; they do not replace Rural Development controls.",
      "The rental-assistance priority rule applies only when an RHS rental-assistance unit is available for assignment.",
    ]),
    verifiedRules: [
      {
        id: "RD-TENANT-ELIGIBILITY-AND-CERTIFICATION",
        citation: "7 CFR 3560.152(a) and (e)",
        requirement: "Confirm the household meets the applicable Rural Development income or other-program-benefit eligibility path, execute the Agency-approved tenant certification before occupancy, recertify at least annually and for required income changes, verify supporting information, and timely submit and retain the certification record.",
        evidenceFields: ["controlled_usda_income_limit_receipt", "borrower_project_authority", "household_size", "annual_income", "other_program_benefit", "tenant_certification", "certification_effective_date", "income_change_amount", "verification_record", "agency_submission_date", "tenant_file_retention_date"],
      },
      {
        id: "RD-HOTMA-INCOME-AND-ASSET-CALCULATION",
        citation: "7 CFR 3560.153; 24 CFR 5.603(b), 5.609(a)-(b), and 5.611; 91 FR 18769",
        requirement: "For determinations on or after April 13, 2026, calculate annual income under 24 CFR 5.609(a) and (b), adjusted income under 24 CFR 5.611, and net family assets under 24 CFR 5.603(b), using controlled current authority.",
        evidenceFields: ["determination_date", "controlled_usda_hotma_income_asset_authority", "annual_income_components", "income_exclusions", "adjusted_income", "deductions", "net_family_assets", "asset_records"],
      },
      {
        id: "RD-TENANT-SELECTION-AND-WAITLIST",
        citation: "7 CFR 3560.154(d) through (h)",
        requirement: "Use only Agency-compliant, nonarbitrary selection criteria documented in the management plan; preserve every application's waiting-list disposition and complete-application priority; apply required income and special priorities; and issue timely written selection, waitlist, or rejection notices with appeal rights.",
        evidenceFields: ["management_plan", "tenant_selection_criteria", "application", "application_complete_date_time", "waiting_list", "waiting_list_disposition", "income_priority", "special_priority", "applicant_notice", "notice_date", "hearing_rights_notice"],
      },
      {
        id: "RD-UNIT-ASSIGNMENT-AND-OCCUPANCY",
        citation: "7 CFR 3560.155",
        requirement: "Assign units under the approved occupancy rules, preserve accessible-unit protections, transfer suitable over-housed or under-housed tenants before selecting from the waiting list, and obtain Agency concurrence before implementing occupancy-rule changes.",
        evidenceFields: ["agency_approved_occupancy_rules", "unit_accessibility_features", "applicant_accessibility_need", "accessible_unit_marketing", "household_size", "unit_bedrooms", "over_under_housed_status", "transfer_offer", "waiting_list_selection", "agency_concurrence", "tenant_comment_record"],
      },
      {
        id: "RD-LEASE-TERMINATION-AND-GRIEVANCE",
        citation: "7 CFR 3560.156, 3560.159, and 3560.160",
        requirement: "Execute an Agency-approved written lease before occupancy with required program provisions; limit termination or nonrenewal to documented material noncompliance, occupancy-rule violations, or other good cause after required notice and cure opportunity; and maintain the applicable tenant grievance and adverse-action process.",
        evidenceFields: ["agency_approved_lease", "lease_execution_date", "lease_term", "required_lease_provisions", "termination_basis", "violation_notice", "cure_opportunity", "termination_notice", "supporting_incident_record", "posted_grievance_procedure", "tenant_rights_summary", "adverse_action_notice", "delivery_receipt"],
      },
      {
        id: "RD-AGENCY-APPROVED-RENTS-AND-UTILITIES",
        citation: "7 CFR 3560.202 and 3560.205",
        requirement: "Use only Agency-approved rents and utility allowances; review tenant-paid utility allowances annually with retained support; obtain written Agency approval before implementing changes; and apply approved changes consistently to similar units.",
        evidenceFields: ["agency_approved_note_rent", "agency_approved_basic_rent", "applicable_hud_contract_rent", "applicable_lihtc_rent", "utility_allowance", "utility_allowance_review_date", "utility_support", "rent_change_request", "agency_written_approval", "change_effective_date", "similar_unit_matrix"],
      },
      {
        id: "RD-TENANT-CONTRIBUTION",
        citation: "7 CFR 3560.203",
        requirement: "Set the tenant contribution at the highest applicable regulatory amount, never above note rent; revise it for qualifying household or approved rent/utility changes; and remit overage above basic rent through note rent to the Agency.",
        evidenceFields: ["monthly_adjusted_income", "gross_monthly_income", "public_assistance_shelter_amount", "basic_rent", "note_rent", "rhs_rental_assistance", "tenant_contribution", "household_change_date", "approved_rent_utility_change", "overage_remittance"],
      },
      {
        id: "RD-RENTAL-ASSISTANCE-ASSIGNMENT",
        citation: "7 CFR 3560.257",
        requirement: "When an RHS rental-assistance unit becomes available, assign it promptly using the prescribed very-low-income, low-income, applicant, tenant-burden, and occupancy-waiver priorities, with the required documentation before using lower-priority categories.",
        evidenceFields: ["rental_assistance_allocation_authority", "rental_assistance_availability_date", "eligible_household_inventory", "household_income_category", "adjusted_income", "approved_shelter_cost", "waiting_list", "occupancy_waiver", "priority_assignment", "lower_priority_documentation", "assignment_effective_date"],
      },
    ],
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
