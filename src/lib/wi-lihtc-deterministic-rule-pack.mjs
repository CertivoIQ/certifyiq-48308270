export const WI_LIHTC_RULE_PACK_BUILD = "wi-lihtc-2026.08.26.1";
export const WI_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const WI_LIHTC_SOURCE = Object.freeze({
  title: "WHEDA Housing Tax Credit Program Compliance Manual",
  url: "https://www.wheda.com/globalassets/documents/forms-manuals-resources/htc-forms/monitoring/htc-monitoring-manual.pdf",
  sha256: "bf01cc3b61b2862954950d6e400509718b3b03c59a774630250d50970603e28a",
  revision: "2026-08",
  citations: Object.freeze({
    minimumSetAside: "PDF pages 13-14 / manual section 3.1 A",
    recertification: "PDF pages 29-30 / manual section 3.4 A",
    availableUnitRule: "PDF pages 30-31 / manual section 3.4 B",
    annualRentIncrease: "PDF page 36 / manual section 3.4 F",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateWiMinimumSetAside(input = {}) {
  if (input.form8609_verified !== true) return blocked("FORM_8609_REQUIRED", ["form8609_verified"]);
  if (!["20/50", "40/60", "AIT"].includes(input.minimum_set_aside)) {
    return blocked("WISCONSIN_MINIMUM_SET_ASIDE_ELECTION_REQUIRED", ["minimum_set_aside"]);
  }
  if (input.minimum_set_aside === "AIT" && input.project_is_100_percent_low_income !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WI-LIHTC-MINIMUM-SET-ASIDE", reason: "WISCONSIN_AIT_REQUIRES_100_PERCENT_LOW_INCOME" });
  }
  if (input.minimum_set_aside_met == null) return blocked("MINIMUM_SET_ASIDE_COMPLIANCE_REQUIRED", ["minimum_set_aside_met"]);
  return Object.freeze({
    finding: input.minimum_set_aside_met ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WI-LIHTC-MINIMUM-SET-ASIDE",
    election: input.minimum_set_aside,
  });
}

export function evaluateWiAnnualRecertification(input = {}) {
  if (input.initial_certification_completed !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WI-LIHTC-RECERT", reason: "INITIAL_CERTIFICATION_MISSING" });
  }
  if (input.project_is_100_percent_low_income == null) return blocked("PROJECT_LOW_INCOME_SCOPE_REQUIRED", ["project_is_100_percent_low_income"]);
  if (input.annual_student_status_certified !== true || input.annual_household_composition_certified !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WI-LIHTC-RECERT", reason: "ANNUAL_STUDENT_OR_COMPOSITION_CERTIFICATION_MISSING" });
  }
  if (input.project_is_100_percent_low_income) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WI-LIHTC-RECERT", income_recertification_required: false });
  }
  if (input.days_since_last_certification == null) return blocked("DAYS_SINCE_LAST_CERTIFICATION_REQUIRED", ["days_since_last_certification"]);
  return Object.freeze({
    finding: Number(input.days_since_last_certification) <= 365 && input.full_income_recertification_completed === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WI-LIHTC-RECERT",
    income_recertification_required: true,
  });
}

export function evaluateWiAvailableUnitRule(input = {}) {
  for (const field of ["household_income", "current_maximum_income", "building_at_or_below_applicable_fraction", "unit_rent_restricted"]) {
    if (input[field] == null) return blocked("WI_AUR_INPUT_REQUIRED", [field]);
  }
  const threshold = Number(input.current_maximum_income) * 1.4;
  const overIncome = Number(input.household_income) > threshold;
  if (!overIncome || input.building_at_or_below_applicable_fraction !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WI-LIHTC-AUR", aur_active: false, threshold });
  }
  if (input.unit_rent_restricted !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WI-LIHTC-AUR", aur_active: true, reason: "OVER_INCOME_UNIT_NOT_RENT_RESTRICTED", threshold });
  }
  if (input.next_comparable_or_smaller_unit_available == null) return blocked("NEXT_COMPARABLE_OR_SMALLER_UNIT_STATUS_REQUIRED", ["next_comparable_or_smaller_unit_available"]);
  if (input.next_comparable_or_smaller_unit_available === false) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WI-LIHTC-AUR", aur_active: true, threshold });
  }
  if (input.next_comparable_or_smaller_unit_rented_to_qualified_household == null) return blocked("NEXT_UNIT_TENANT_ELIGIBILITY_REQUIRED", ["next_comparable_or_smaller_unit_rented_to_qualified_household"]);
  return Object.freeze({
    finding: input.next_comparable_or_smaller_unit_rented_to_qualified_household ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WI-LIHTC-AUR",
    aur_active: true,
    threshold,
  });
}

export function evaluateWiAnnualRentIncrease(input = {}) {
  if (input.existing_tenant !== true) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WI-LIHTC-RENT-INCREASE", policy_applicable: false });
  if (input.prior_lease_rent_plus_mandatory_fees == null || input.new_lease_rent_plus_mandatory_fees == null) {
    return blocked("RENT_INCREASE_AMOUNTS_REQUIRED", ["prior_lease_rent_plus_mandatory_fees", "new_lease_rent_plus_mandatory_fees"]);
  }
  const prior = Number(input.prior_lease_rent_plus_mandatory_fees);
  const next = Number(input.new_lease_rent_plus_mandatory_fees);
  if (!(prior > 0) || next < 0) return blocked("VALID_RENT_AMOUNTS_REQUIRED", ["prior_lease_rent_plus_mandatory_fees", "new_lease_rent_plus_mandatory_fees"]);
  const percentIncrease = ((next - prior) / prior) * 100;
  if (percentIncrease <= 5) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WI-LIHTC-RENT-INCREASE", percent_increase: percentIncrease, required_notice_days: 0 });
  if (Number(input.resident_notice_days) < 90) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WI-LIHTC-RENT-INCREASE", percent_increase: percentIncrease, required_notice_days: 90, reason: "RESIDENT_90_DAY_NOTICE_REQUIRED" });
  }
  if (Number(input.allocation_year) >= 2023 && Number(input.wheda_exception_request_lead_days) < 120) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WI-LIHTC-RENT-INCREASE", percent_increase: percentIncrease, required_notice_days: 90, required_wheda_request_lead_days: 120, reason: "WHEDA_120_DAY_EXCEPTION_REQUEST_REQUIRED" });
  }
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WI-LIHTC-RENT-INCREASE", percent_increase: percentIncrease, required_notice_days: 90 });
}

export function wiLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (input.compliance_manual_sha256 !== WI_LIHTC_SOURCE.sha256) missing.push("compliance_manual_sha256");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  return Object.freeze({
    state: "WI",
    program: "LIHTC",
    version: WI_LIHTC_RULE_PACK_BUILD,
    effective_from: WI_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    qap_allocation_rules_included: false,
    property_figure_verification_required: true,
  });
}
