export const WY_LIHTC_RULE_PACK_BUILD = "wy-lihtc-2026.08.26.1";
export const WY_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const WY_LIHTC_SOURCES = Object.freeze({
  complianceManual: Object.freeze({
    title: "WCDA 2025-2026 Affordable Rental Housing Compliance Manual",
    url: "https://www.wyomingcda.com/wp-content/uploads/2025/08/WCDA-2025-2026-Compliance-Manual.pdf",
    sha256: "adccb3dfd15b31d8b7876e57b5c224de9abd087176f67e4c8d0e1b881af58311",
    applicableNoLaterThan: "2026-01-01",
    citations: Object.freeze({
      minimumSetAside: "PDF page 14 / printed page 12",
      availableUnit140: "PDF page 20 / printed page 18",
      studentEligibility: "PDF pages 22-23 / printed pages 20-21",
      recertification: "PDF pages 25-26 / printed pages 23-24",
    }),
  }),
  allocationPlan2026: Object.freeze({
    title: "2026 Affordable Housing Allocation Plan",
    url: "https://www.wyomingcda.com/wp-content/uploads/2025/07/2026-AHAP-Final-UPDATED.pdf",
    sha256: "b56fc8109700bf76ee8b2e75773fa7b50a959b1e23e00bdcb624e718a78e69b1",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({
    finding: "UNABLE_TO_DETERMINE",
    status: "BLOCKED",
    reason,
    missing: Object.freeze([...missing]),
  });
}

export function evaluateWyMinimumSetAside(input = {}) {
  if (input.form8609_verified !== true) return blocked("FORM_8609_REQUIRED", ["form8609_verified"]);
  if (!["20/50", "40/60", "AIT"].includes(input.minimum_set_aside)) {
    return blocked("WYOMING_MINIMUM_SET_ASIDE_ELECTION_REQUIRED", ["minimum_set_aside"]);
  }
  if (input.minimum_set_aside_met == null) {
    return blocked("MINIMUM_SET_ASIDE_COMPLIANCE_REQUIRED", ["minimum_set_aside_met"]);
  }
  return Object.freeze({
    finding: input.minimum_set_aside_met ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WY-LIHTC-MINIMUM-SET-ASIDE",
    election: input.minimum_set_aside,
  });
}

export function evaluateWyAvailableUnit140(input = {}) {
  for (const field of ["household_income", "current_applicable_income_limit", "unit_rent_restricted"]) {
    if (input[field] == null) return blocked("WY_140_RULE_INPUT_REQUIRED", [field]);
  }
  const threshold = Number(input.current_applicable_income_limit) * 1.4;
  const overIncome = Number(input.household_income) > threshold;
  if (!overIncome) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WY-LIHTC-140", over_income: false, threshold });
  }
  if (input.unit_rent_restricted !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WY-LIHTC-140", over_income: true, threshold, reason: "OVER_INCOME_UNIT_NOT_RENT_RESTRICTED" });
  }
  if (input.next_comparable_or_smaller_unit_available == null) {
    return blocked("NEXT_COMPARABLE_OR_SMALLER_UNIT_STATUS_REQUIRED", ["next_comparable_or_smaller_unit_available"]);
  }
  if (input.next_comparable_or_smaller_unit_available === false) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WY-LIHTC-140", over_income: true, threshold, reason: "NO_COMPARABLE_OR_SMALLER_UNIT_AVAILABLE_YET" });
  }
  if (input.next_comparable_or_smaller_unit_rented_to_qualified_household == null) {
    return blocked("NEXT_UNIT_TENANT_ELIGIBILITY_REQUIRED", ["next_comparable_or_smaller_unit_rented_to_qualified_household"]);
  }
  return Object.freeze({
    finding: input.next_comparable_or_smaller_unit_rented_to_qualified_household ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WY-LIHTC-140",
    over_income: true,
    threshold,
  });
}

export function evaluateWyStudentStatus(input = {}) {
  if (input.all_household_members_full_time_students == null) {
    return blocked("STUDENT_STATUS_REQUIRED", ["all_household_members_full_time_students"]);
  }
  if (input.annual_student_status_verified !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WY-LIHTC-STUDENT", reason: "ANNUAL_STUDENT_VERIFICATION_MISSING" });
  }
  if (!input.all_household_members_full_time_students) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WY-LIHTC-STUDENT" });
  }
  if (input.student_exception_verified == null) {
    return blocked("FULL_TIME_STUDENT_EXCEPTION_VERIFICATION_REQUIRED", ["student_exception_verified"]);
  }
  return Object.freeze({
    finding: input.student_exception_verified ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WY-LIHTC-STUDENT",
  });
}

export function evaluateWyRecertification(input = {}) {
  if (input.initial_certification_completed !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WY-LIHTC-RECERT", reason: "INITIAL_CERTIFICATION_MISSING" });
  }
  if (input.project_is_100_percent_lihtc == null) {
    return blocked("PROJECT_LIHTC_OCCUPANCY_SCOPE_REQUIRED", ["project_is_100_percent_lihtc"]);
  }
  if (input.project_is_100_percent_lihtc) {
    const pass = input.self_certification_completed === true && input.annual_student_status_verified === true;
    return Object.freeze({
      finding: pass ? "PASS" : "FAIL",
      status: "EVALUATED",
      rule_id: "WY-LIHTC-RECERT",
      required_method: "SELF_CERTIFICATION_ALLOWED_AFTER_INITIAL",
    });
  }
  return Object.freeze({
    finding: input.full_third_party_recertification_completed === true && input.annual_student_status_verified === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WY-LIHTC-RECERT",
    required_method: "FULL_THIRD_PARTY_ANNUAL_RECERTIFICATION",
  });
}

export function wyLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (input.compliance_manual_sha256 !== WY_LIHTC_SOURCES.complianceManual.sha256) missing.push("compliance_manual_sha256");
  if (input.allocation_plan_sha256 !== WY_LIHTC_SOURCES.allocationPlan2026.sha256) missing.push("allocation_plan_sha256");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  return Object.freeze({
    state: "WY",
    program: "LIHTC",
    version: WY_LIHTC_RULE_PACK_BUILD,
    effective_from: WY_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    prospective_2027_sources_included: false,
    third_party_limit_calculator_is_rule_authority: false,
    property_figure_verification_required: true,
  });
}
