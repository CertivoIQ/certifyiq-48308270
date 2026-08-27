export const PA_LIHTC_RULE_PACK_BUILD = "pa-lihtc-compliance-2026.08.26.1";
export const PA_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const PA_LIHTC_SOURCES = Object.freeze({
  program_page: "https://www.phfa.org/mhp/developers/lihtc.aspx",
  compliance_manual_chapter_2: "https://www.phfa.org/forms/housing_management/tax_credits/manuals_and_documents/chapters/tc_chptr_02.pdf",
  qap_2025_2026: "https://www.phfa.org/forms/multifamily_program_notices/qap/2025_and_2026/2025-2026-lihtc-qap.pdf",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluatePaGrossRent(input = {}) {
  for (const field of ["monthly_contract_rent", "tenant_paid_utility_allowance", "maximum_lihtc_gross_rent"]) {
    if (input[field] == null) return blocked("PA_GROSS_RENT_INPUT_REQUIRED", [field]);
  }
  const contractRent = Number(input.monthly_contract_rent);
  const utility = Number(input.tenant_paid_utility_allowance);
  const maximum = Number(input.maximum_lihtc_gross_rent);
  if (![contractRent, utility, maximum].every(Number.isFinite) || contractRent < 0 || utility < 0 || maximum < 0) return blocked("VALID_RENT_VALUES_REQUIRED");
  const grossRent = contractRent + utility;
  return Object.freeze({ finding: grossRent <= maximum ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "PA-LIHTC-GROSS-RENT", gross_rent: grossRent, maximum_lihtc_gross_rent: maximum });
}

export function evaluatePaUtilityAllowanceAuthority(input = {}) {
  if (!input.building_assistance_type) return blocked("PA_UTILITY_ALLOWANCE_ASSISTANCE_TYPE_REQUIRED", ["building_assistance_type"]);
  const type = input.building_assistance_type;
  const requiredMethod = type === "HUD_PROJECT_BASED" ? "HUD" : type === "RHS_PROJECT_OR_TENANT_BASED" ? "RHS" : null;
  if (requiredMethod) {
    if (!input.utility_allowance_method) return blocked("PA_UTILITY_ALLOWANCE_METHOD_REQUIRED", ["utility_allowance_method"]);
    return Object.freeze({ finding: input.utility_allowance_method === requiredMethod ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "PA-LIHTC-UA-AUTHORITY", required_method: requiredMethod, reason: input.utility_allowance_method === requiredMethod ? undefined : "UTILITY_ALLOWANCE_METHOD_DOES_NOT_MATCH_BUILDING_AUTHORITY" });
  }
  return blocked("PROPERTY_SPECIFIC_UTILITY_ALLOWANCE_METHOD_REQUIRED", ["property_specific_utility_allowance_authority"]);
}

export function evaluatePaMinimumSetAsideElection(input = {}) {
  if (!input.form_8609_election || input.proposed_election == null) return blocked("PA_MINIMUM_SET_ASIDE_ELECTION_REQUIRED", ["form_8609_election", "proposed_election"]);
  const election = String(input.form_8609_election);
  const proposed = String(input.proposed_election);
  return Object.freeze({ finding: election === proposed ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "PA-LIHTC-MINIMUM-SET-ASIDE-ELECTION", reason: election === proposed ? undefined : "MINIMUM_SET_ASIDE_ELECTION_CANNOT_CHANGE_AFTER_PLACED_IN_SERVICE" });
}

export function evaluatePaAnnualRecertificationFile(input = {}) {
  const required = ["tenant_income_certification_present", "income_verification_present", "asset_verification_present", "student_status_reviewed"];
  for (const field of required) if (input[field] == null) return blocked("PA_ANNUAL_RECERTIFICATION_FILE_INPUT_REQUIRED", [field]);
  const pass = required.every((field) => input[field] === true);
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "PA-LIHTC-ANNUAL-RECERT-FILE", reason: pass ? undefined : "ANNUAL_RECERTIFICATION_FILE_INCOMPLETE" });
}

export function paLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (PA_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_manual_and_qap_reconciled !== true) missing.push("current_manual_and_qap_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "PA", program: "LIHTC", version: PA_LIHTC_RULE_PACK_BUILD, effective_from: PA_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "COMPLIANCE_MONITORING_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
