export const TN_LIHTC_RULE_PACK_BUILD = "tn-lihtc-monitoring-2026.08.26.1";
export const TN_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const TN_LIHTC_SOURCE = Object.freeze({
  title: "Tennessee Housing Development Agency 2026 Qualified Allocation Plan",
  url: "https://thda.org/wp-content/uploads/2026/02/2026_MF_QAP-STYLE-GUIDE-VERSION-WITH-SIGNATUREE.pdf",
  sha256: "7de2d24910bf2552742b25ccaf0d9a1f3a388abb9be04d433095776f3e055c56",
  approvals: Object.freeze({ board: "2025-09-23", governor: "2025-12-17" }),
  citations: Object.freeze({
    annualOwnerCertification: "2026 QAP Section 10.A, QAP page 56",
    annualHouseholdIncomeCertification: "2026 QAP Section 10.A.5, QAP page 56",
    utilityAllowanceApproval: "2026 QAP Section 10.A.6, QAP page 56",
  }),
});

export const TN_LIHTC_COMPLIANCE_PAGE = Object.freeze({
  title: "THDA Housing Credit Compliance",
  url: "https://thda.org/rental-housing-partn/housing-credit-compliance/",
  scope: "ANNUAL_AND_ONSITE_MONITORING_PROCESS",
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateTnOwnerAnnualCertification(input = {}) {
  if (input.in_lurc_term !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "TN-LIHTC-OAC", certification_required: false });
  }
  for (const field of ["report_year", "submitted_date", "thda_deadline", "certified_all_required_items"]) {
    if (input[field] == null) return blocked("TN_OAC_INPUT_REQUIRED", [field]);
  }
  const submitted = new Date(`${input.submitted_date}T00:00:00Z`);
  const deadline = new Date(`${input.thda_deadline}T23:59:59Z`);
  if (Number.isNaN(submitted.getTime()) || Number.isNaN(deadline.getTime())) {
    return blocked("VALID_TN_OAC_DATES_REQUIRED", ["submitted_date", "thda_deadline"]);
  }
  if (input.certified_all_required_items !== true && !input.detailed_explanation_provided) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "TN-LIHTC-OAC", certification_required: true, reason: "DETAILED_EXPLANATION_REQUIRED_FOR_UNCERTIFIED_ITEM" });
  }
  return Object.freeze({
    finding: submitted <= deadline ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "TN-LIHTC-OAC",
    certification_required: true,
    due_date: input.thda_deadline,
    reason: submitted <= deadline ? undefined : "OWNER_ANNUAL_CERTIFICATION_SUBMITTED_AFTER_THDA_DEADLINE",
  });
}

export function evaluateTnAnnualHouseholdIncomeCertification(input = {}) {
  for (const field of ["low_income_household", "certification_year", "initial_occupancy_year", "annual_income_certification_present"]) {
    if (input[field] == null) return blocked("TN_HOUSEHOLD_CERT_INPUT_REQUIRED", [field]);
  }
  if (input.low_income_household !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "TN-LIHTC-HOUSEHOLD-CERT", certification_required: false });
  }
  const required = Number(input.certification_year) >= Number(input.initial_occupancy_year);
  if (!required) return blocked("CERTIFICATION_YEAR_PRECEDES_INITIAL_OCCUPANCY", ["certification_year", "initial_occupancy_year"]);
  return Object.freeze({
    finding: input.annual_income_certification_present === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "TN-LIHTC-HOUSEHOLD-CERT",
    certification_required: true,
    reason: input.annual_income_certification_present === true ? undefined : "ANNUAL_HOUSEHOLD_INCOME_CERTIFICATION_REQUIRED",
  });
}

export function evaluateTnUtilityAllowanceApproval(input = {}) {
  if (input.utility_allowance_applies == null) return blocked("UTILITY_ALLOWANCE_APPLICABILITY_REQUIRED", ["utility_allowance_applies"]);
  if (input.utility_allowance_applies !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "TN-LIHTC-UA-APPROVAL", approval_required: false });
  }
  if (input.thda_approval_documented == null) return blocked("THDA_UTILITY_ALLOWANCE_APPROVAL_STATUS_REQUIRED", ["thda_approval_documented"]);
  return Object.freeze({
    finding: input.thda_approval_documented === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "TN-LIHTC-UA-APPROVAL",
    approval_required: true,
    reason: input.thda_approval_documented === true ? undefined : "PROPER_UTILITY_ALLOWANCE_APPROVAL_REQUIRED",
  });
}

export function tnLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (input.qap_sha256 !== TN_LIHTC_SOURCE.sha256) missing.push("qap_sha256");
  if (input.compliance_page_current_verified !== true) missing.push("compliance_page_current_verified");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({
    state: "TN",
    program: "LIHTC",
    version: TN_LIHTC_RULE_PACK_BUILD,
    effective_from: TN_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    scope: "COMPLIANCE_AND_MONITORING_ONLY",
    qap_allocation_scoring_included: false,
    property_figure_verification_required: true,
  });
}
