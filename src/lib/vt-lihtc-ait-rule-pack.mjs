export const VT_LIHTC_AIT_RULE_PACK_BUILD = "vt-lihtc-ait-2026.08.26.1";
export const VT_LIHTC_AIT_EFFECTIVE_FROM = "2026-08-27";

export const VT_LIHTC_AIT_SOURCE = Object.freeze({
  title: "VHFA Average Income Test Policy",
  url: "https://www.vhfa.org/sites/default/files/documents/multifamily/AIT%20Policy%202023.07.pdf",
  sha256: "745e6b16c6a3ca981cc1f53650ca085f024a5a76218a64721bd2d7af021c6f66",
  revision: "2023-07",
  citations: Object.freeze({
    ninePercentEligibility: "AIT Policy page 4",
    resyndicationExclusion: "AIT Policy page 4",
    bondLayering: "AIT Policy page 4",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateVtNinePercentAitEligibility(input = {}) {
  for (const field of ["credit_type", "allocation_date", "average_income_election_requested"]) {
    if (input[field] == null) return blocked("VT_AIT_ELIGIBILITY_INPUT_REQUIRED", [field]);
  }
  if (input.average_income_election_requested !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "VT-LIHTC-AIT-9PCT", policy_applicable: false });
  }
  if (input.credit_type !== "9_PERCENT") {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "VT-LIHTC-AIT-9PCT", policy_applicable: false });
  }
  const eligibleDate = new Date("2020-01-01T00:00:00Z");
  const allocationDate = new Date(`${input.allocation_date}T00:00:00Z`);
  if (Number.isNaN(allocationDate.getTime())) return blocked("VALID_ALLOCATION_DATE_REQUIRED", ["allocation_date"]);
  return Object.freeze({
    finding: allocationDate >= eligibleDate ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "VT-LIHTC-AIT-9PCT",
    reason: allocationDate >= eligibleDate ? undefined : "VHFA_9_PERCENT_AIT_REQUIRES_ALLOCATION_ON_OR_AFTER_2020_01_01",
  });
}

export function evaluateVtResyndicationAitEligibility(input = {}) {
  if (input.average_income_election_requested !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "VT-LIHTC-AIT-RESYNDICATION", policy_applicable: false });
  }
  if (input.existing_tax_credit_property == null || input.resyndication == null || input.recorded_housing_credit_housing_subsidy_covenant == null) {
    return blocked("VT_RESYNDICATION_SCOPE_REQUIRED", ["existing_tax_credit_property", "resyndication", "recorded_housing_credit_housing_subsidy_covenant"]);
  }
  const excluded = input.existing_tax_credit_property === true && input.resyndication === true && input.recorded_housing_credit_housing_subsidy_covenant === true;
  return Object.freeze({
    finding: excluded ? "FAIL" : "PASS",
    status: "EVALUATED",
    rule_id: "VT-LIHTC-AIT-RESYNDICATION",
    reason: excluded ? "VHFA_RESYNDICATED_COVENANTED_PROPERTY_NOT_ELIGIBLE_FOR_AIT" : undefined,
  });
}

export function evaluateVtBondAitLayering(input = {}) {
  if (input.credit_type !== "4_PERCENT_BOND" || input.average_income_election_requested !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "VT-LIHTC-AIT-BOND", policy_applicable: false });
  }
  if (!["20/50", "40/60"].includes(input.bond_minimum_set_aside)) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "VT-LIHTC-AIT-BOND", reason: "BOND_MINIMUM_SET_ASIDE_ELECTION_REQUIRED_IN_ADDITION_TO_AIT" });
  }
  if (input.bond_restricted_units_meet_selected_election == null) {
    return blocked("BOND_RESTRICTED_UNIT_COMPLIANCE_REQUIRED", ["bond_restricted_units_meet_selected_election"]);
  }
  return Object.freeze({
    finding: input.bond_restricted_units_meet_selected_election === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "VT-LIHTC-AIT-BOND",
    bond_minimum_set_aside: input.bond_minimum_set_aside,
  });
}

export function vtLihtcAitReleaseEligibility(input = {}) {
  const missing = [];
  if (input.ait_policy_sha256 !== VT_LIHTC_AIT_SOURCE.sha256) missing.push("ait_policy_sha256");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  return Object.freeze({
    state: "VT",
    program: "LIHTC",
    version: VT_LIHTC_AIT_RULE_PACK_BUILD,
    effective_from: VT_LIHTC_AIT_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    scope: "AVERAGE_INCOME_TEST_ONLY",
    prospective_qap_included: false,
    property_figure_verification_required: true,
  });
}
