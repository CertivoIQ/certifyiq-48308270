export const SC_LIHTC_RULE_PACK_BUILD = "sc-lihtc-compliance-2026.08.26.1";
export const SC_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const SC_LIHTC_SOURCE = Object.freeze({
  title: "SC Housing LIHTC Compliance Manual - Revised 2/12/2026",
  url: "https://schousing.sc.gov/sites/schousing/files/Documents/Development/Manuals%20and%20Forms/LIHTC%20Compliance%20Manual%20-%20Revised%202.12.2026.pdf",
  sha256: null,
  observed_pages: 81,
  citations: Object.freeze({
    annualRecertification: "LIHTC Compliance Manual, page 69",
    recertificationWaiver: "LIHTC Compliance Manual, page 69",
    overIncomeRule: "LIHTC Compliance Manual, pages 69-70",
    utilityAllowance: "LIHTC Compliance Manual, pages 44-46",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateScAnnualRecertification(input = {}) {
  if (!input.previous_certification_date || !input.current_certification_date) {
    return blocked("SC_ANNUAL_RECERTIFICATION_DATES_REQUIRED", ["previous_certification_date", "current_certification_date"]);
  }
  const prior = new Date(`${input.previous_certification_date}T00:00:00Z`);
  const current = new Date(`${input.current_certification_date}T00:00:00Z`);
  if (Number.isNaN(prior.getTime()) || Number.isNaN(current.getTime())) return blocked("VALID_CERTIFICATION_DATES_REQUIRED");
  const days = Math.floor((current - prior) / 86400000);
  if (days < 0) return blocked("CURRENT_CERTIFICATION_PRECEDES_PRIOR_CERTIFICATION");
  return Object.freeze({
    finding: days <= 365 ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "SC-LIHTC-ANNUAL-RECERT",
    days_between_certifications: days,
    reason: days <= 365 ? undefined : "CERTIFICATION_COMPLETED_AFTER_365_DAYS",
  });
}

export function evaluateScRecertificationWaiver(input = {}) {
  for (const field of ["development_is_100_percent_lihtc", "sc_housing_written_approval", "waiver_used_for_income_verification_only"]) {
    if (input[field] == null) return blocked("SC_RECERTIFICATION_WAIVER_INPUT_REQUIRED", [field]);
  }
  const pass = input.development_is_100_percent_lihtc === true && input.sc_housing_written_approval === true && input.waiver_used_for_income_verification_only === true;
  return Object.freeze({
    finding: pass ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "SC-LIHTC-RECERT-WAIVER",
    reason: pass ? undefined : "RECERTIFICATION_WAIVER_REQUIREMENTS_NOT_MET",
  });
}

export function evaluateScOverIncomeRule(input = {}) {
  if (input.household_income == null || input.current_applicable_income_limit == null) {
    return blocked("SC_OVER_INCOME_INPUT_REQUIRED", ["household_income", "current_applicable_income_limit"]);
  }
  const income = Number(input.household_income);
  const limit = Number(input.current_applicable_income_limit);
  if (!Number.isFinite(income) || !Number.isFinite(limit) || limit <= 0) return blocked("VALID_INCOME_AND_LIMIT_REQUIRED");
  const ratio = income / limit;
  return Object.freeze({
    finding: "PASS",
    status: "EVALUATED",
    rule_id: "SC-LIHTC-140-PERCENT",
    over_140_percent: ratio > 1.4,
    next_available_unit_rule_triggered: ratio > 1.4,
    ratio,
  });
}

export function evaluateScUtilityAllowanceChange(input = {}) {
  for (const field of ["method", "change_effective_date", "gross_rent_recalculated_date"]) {
    if (input[field] == null) return blocked("SC_UTILITY_ALLOWANCE_INPUT_REQUIRED", [field]);
  }
  const requiresApproval = ["UTILITY_COMPANY_ESTIMATE", "HUD_UTILITY_SCHEDULE_MODEL", "ENERGY_CONSUMPTION_MODEL"].includes(input.method);
  if (requiresApproval && input.sc_housing_written_approval !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "SC-LIHTC-UA", reason: "SC_HOUSING_WRITTEN_APPROVAL_REQUIRED" });
  }
  const effective = new Date(`${input.change_effective_date}T00:00:00Z`);
  const recalculated = new Date(`${input.gross_rent_recalculated_date}T00:00:00Z`);
  if (Number.isNaN(effective.getTime()) || Number.isNaN(recalculated.getTime())) return blocked("VALID_UTILITY_ALLOWANCE_DATES_REQUIRED");
  const days = Math.floor((recalculated - effective) / 86400000);
  if (days < 0) return blocked("GROSS_RENT_RECALCULATION_PRECEDES_EFFECTIVE_DATE");
  return Object.freeze({
    finding: days <= 90 ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "SC-LIHTC-UA",
    days_to_recalculate: days,
    reason: days <= 90 ? undefined : "UPDATED_UTILITY_ALLOWANCE_NOT_APPLIED_WITHIN_90_DAYS",
  });
}

export function scLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (!SC_LIHTC_SOURCE.sha256) missing.push("exact_manual_sha256_not_registered");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({
    state: "SC",
    program: "LIHTC",
    version: SC_LIHTC_RULE_PACK_BUILD,
    effective_from: SC_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    scope: "COMPLIANCE_MONITORING_ONLY",
    qap_allocation_rules_included: false,
    property_figure_verification_required: true,
  });
}
