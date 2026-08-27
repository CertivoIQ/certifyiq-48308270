export const SD_LIHTC_RULE_PACK_BUILD = "sd-lihtc-program-2026.08.26.1";
export const SD_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const SD_LIHTC_SOURCE = Object.freeze({
  program_page: "https://www.sdhousing.org/develop-housing/available-development-programs/housing-tax-credits",
  qap_url: "https://www.sdhousing.org/s/2026-2027-HTC-QAP-Final-072026.pdf",
  compliance_manual_url: "https://www.sdhousing.org/s/2025HTC.pdf",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateSdMinimumSetAside(input = {}) {
  const { election, total_units, qualifying_units } = input;
  if (!election || total_units == null || qualifying_units == null) return blocked("SD_MINIMUM_SET_ASIDE_INPUT_REQUIRED", ["election", "total_units", "qualifying_units"]);
  const total = Number(total_units);
  const qualifying = Number(qualifying_units);
  if (!Number.isFinite(total) || !Number.isFinite(qualifying) || total <= 0 || qualifying < 0) return blocked("VALID_UNIT_COUNTS_REQUIRED");
  const required = election === "20_50" ? 0.20 : election === "40_60" ? 0.40 : null;
  if (required == null) return blocked("SUPPORTED_MINIMUM_SET_ASIDE_ELECTION_REQUIRED", ["election"]);
  const actual = qualifying / total;
  return Object.freeze({
    finding: actual >= required ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "SD-LIHTC-MINIMUM-SET-ASIDE",
    required_fraction: required,
    actual_fraction: actual,
  });
}

export function evaluateSdIncomeAveragingAvailability(input = {}) {
  if (!input.placed_in_service_date) return blocked("PLACED_IN_SERVICE_DATE_REQUIRED", ["placed_in_service_date"]);
  const pis = new Date(`${input.placed_in_service_date}T00:00:00Z`);
  if (Number.isNaN(pis.getTime())) return blocked("VALID_PLACED_IN_SERVICE_DATE_REQUIRED");
  const threshold = new Date("2018-08-01T00:00:00Z");
  return Object.freeze({
    finding: "PASS",
    status: "EVALUATED",
    rule_id: "SD-LIHTC-INCOME-AVERAGING-AVAILABILITY",
    income_averaging_available: pis > threshold,
    threshold_date: "2018-08-01",
  });
}

export function evaluateSdGrossRentCap(input = {}) {
  if (input.gross_rent == null || input.qualifying_monthly_income == null) return blocked("SD_GROSS_RENT_INPUT_REQUIRED", ["gross_rent", "qualifying_monthly_income"]);
  const rent = Number(input.gross_rent);
  const income = Number(input.qualifying_monthly_income);
  if (!Number.isFinite(rent) || !Number.isFinite(income) || rent < 0 || income <= 0) return blocked("VALID_RENT_AND_INCOME_REQUIRED");
  const cap = income * 0.30;
  return Object.freeze({
    finding: rent <= cap ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "SD-LIHTC-GROSS-RENT-CAP",
    maximum_gross_rent: cap,
  });
}

export function evaluateSd2026UtilityAllowanceMethod(input = {}) {
  if (!input.method) return blocked("UTILITY_ALLOWANCE_METHOD_REQUIRED", ["method"]);
  const permitted = new Set(["SERVICE_PROVIDER_DOCUMENTATION", "HUD_UTILITY_SCHEDULE_MODEL", "SD_HOUSING_WORKSHEET"]);
  if (input.method === "LOCAL_PHA") {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "SD-2026-UA-METHOD", reason: "LOCAL_PHA_CALCULATIONS_NOT_ACCEPTED_FOR_2026" });
  }
  if (!permitted.has(input.method)) return blocked("SUPPORTED_2026_UTILITY_ALLOWANCE_METHOD_REQUIRED", ["method"]);
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "SD-2026-UA-METHOD", method: input.method });
}

export function evaluateSdExtendedUseCommitment(input = {}) {
  if (input.initial_compliance_years == null || input.additional_affordability_years == null) return blocked("SD_EXTENDED_USE_INPUT_REQUIRED", ["initial_compliance_years", "additional_affordability_years"]);
  const initial = Number(input.initial_compliance_years);
  const additional = Number(input.additional_affordability_years);
  if (!Number.isFinite(initial) || !Number.isFinite(additional)) return blocked("VALID_AFFORDABILITY_PERIODS_REQUIRED");
  return Object.freeze({
    finding: initial >= 15 && additional >= 15 ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "SD-LIHTC-EXTENDED-USE",
    total_years: initial + additional,
  });
}

export function sdLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (SD_LIHTC_SOURCE.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({
    state: "SD",
    program: "LIHTC",
    version: SD_LIHTC_RULE_PACK_BUILD,
    effective_from: SD_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    scope: "PROGRAM_AND_ELIGIBILITY_RULES_ONLY",
    qap_allocation_scoring_included: false,
    property_figure_verification_required: true,
  });
}
