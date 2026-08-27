export const RI_LIHTC_RULE_PACK_BUILD = "ri-lihtc-compliance-2026.08.26.1";
export const RI_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const RI_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://www.rihousing.com/partners/property-managers-owners/compliance/",
  average_income_policy: "https://www.rihousing.com/wp-content/uploads/2026-Section-12A-Average-Income-Test-Policy.pdf",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateRiNonSection8RentIncrease(input = {}) {
  for (const field of ["has_section8_project_based_assistance", "current_rent", "proposed_rent", "months_since_last_increase"]) {
    if (input[field] == null) return blocked("RI_RENT_INCREASE_INPUT_REQUIRED", [field]);
  }
  if (input.has_section8_project_based_assistance === true) return blocked("RI_NON_SECTION8_RULE_NOT_APPLICABLE", ["applicable_program_guidelines"]);
  const current = Number(input.current_rent);
  const proposed = Number(input.proposed_rent);
  const months = Number(input.months_since_last_increase);
  if (![current, proposed, months].every(Number.isFinite) || current <= 0 || proposed < current || months < 0) return blocked("VALID_RENT_INCREASE_VALUES_REQUIRED");
  const increasePct = ((proposed - current) / current) * 100;
  const pass = months >= 12 && increasePct <= 5 + Number.EPSILON;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "RI-NON-SECTION8-RENT-INCREASE", increase_percent: increasePct, months_since_last_increase: months, reason: pass ? undefined : months < 12 ? "RENT_INCREASE_WITHIN_12_MONTHS" : "RENT_INCREASE_EXCEEDS_5_PERCENT" });
}

export function evaluateRiTenantDataReporting(input = {}) {
  for (const field of ["receives_lihtc_home_or_ancillary_funding", "reported_in_procorem"]) {
    if (input[field] == null) return blocked("RI_TENANT_REPORTING_INPUT_REQUIRED", [field]);
  }
  if (input.receives_lihtc_home_or_ancillary_funding !== true) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "RI-PROCOREM-TENANT-REPORTING", reporting_required: false });
  return Object.freeze({ finding: input.reported_in_procorem === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "RI-PROCOREM-TENANT-REPORTING", reporting_required: true, reason: input.reported_in_procorem === true ? undefined : "TENANT_DATA_MUST_BE_REPORTED_IN_PROCOREM" });
}

export function evaluateRiAverageIncomeEligibility(input = {}) {
  for (const field of ["project_is_100_percent_lihtc", "form_8609_executed", "total_units", "qualified_ait_units", "qualified_ait_designation_sum"]) {
    if (input[field] == null) return blocked("RI_AIT_INPUT_REQUIRED", [field]);
  }
  if (input.project_is_100_percent_lihtc !== true) return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "RI-AIT-ELIGIBILITY", reason: "RI_AIT_POLICY_APPLIES_TO_100_PERCENT_LIHTC_PROJECTS_ONLY" });
  if (input.form_8609_executed === true) return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "RI-AIT-ELIGIBILITY", reason: "AIT_POLICY_REQUIRES_PROJECT_NOT_YET_EXECUTED_FORM_8609" });
  const total = Number(input.total_units);
  const qualified = Number(input.qualified_ait_units);
  const sum = Number(input.qualified_ait_designation_sum);
  if (![total, qualified, sum].every(Number.isFinite) || total <= 0 || qualified <= 0 || qualified > total) return blocked("VALID_AIT_UNIT_COUNTS_REQUIRED");
  const qualifiedFraction = qualified / total;
  const averageDesignation = sum / qualified;
  const pass = qualifiedFraction >= 0.40 && averageDesignation <= 60;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "RI-AIT-ELIGIBILITY", qualified_fraction: qualifiedFraction, average_designation_ami: averageDesignation, reason: pass ? undefined : qualifiedFraction < 0.40 ? "FEWER_THAN_40_PERCENT_QUALIFIED_AIT_UNITS" : "AVERAGE_AIT_DESIGNATION_EXCEEDS_60_PERCENT_AMI" });
}

export function evaluateRiAitDocumentation(input = {}) {
  for (const field of ["management_plan_documents_ait", "tenant_selection_plan_documents_ait", "unit_designations_reported_to_rihousing"]) {
    if (input[field] == null) return blocked("RI_AIT_DOCUMENTATION_INPUT_REQUIRED", [field]);
  }
  const pass = input.management_plan_documents_ait === true && input.tenant_selection_plan_documents_ait === true && input.unit_designations_reported_to_rihousing === true;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "RI-AIT-DOCUMENTATION", reason: pass ? undefined : "AIT_ELECTION_AND_UNIT_DESIGNATIONS_MUST_BE_DOCUMENTED_AND_REPORTED" });
}

export function riLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (RI_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "RI", program: "LIHTC", version: RI_LIHTC_RULE_PACK_BUILD, effective_from: RI_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "COMPLIANCE_AND_AIT_POLICY_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
