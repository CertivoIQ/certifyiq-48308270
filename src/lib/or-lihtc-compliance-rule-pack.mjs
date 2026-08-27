export const OR_LIHTC_RULE_PACK_BUILD = "or-lihtc-compliance-2026.08.26.1";
export const OR_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const OR_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://www.oregon.gov/ohcs/compliance-monitoring/Pages/compliance-lihtc-program.aspx",
  compliance_manual_2025: "https://www.oregon.gov/ohcs/compliance-monitoring/Documents/compliance/lihtc/LIHTC%20Compliance%20Manual%202025.pdf",
  income_rent_limits_page: "https://www.oregon.gov/ohcs/compliance-monitoring/pages/rent-income-limits.aspx",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateOrMinimumSetAside(input = {}) {
  const { election, total_units, qualifying_units } = input;
  if (!election || total_units == null || qualifying_units == null) return blocked("OR_MINIMUM_SET_ASIDE_INPUT_REQUIRED", ["election", "total_units", "qualifying_units"]);
  const total = Number(total_units);
  const qualifying = Number(qualifying_units);
  if (!Number.isFinite(total) || !Number.isFinite(qualifying) || total <= 0 || qualifying < 0) return blocked("VALID_UNIT_COUNTS_REQUIRED");
  const required = election === "20_50" ? 0.20 : election === "40_60" ? 0.40 : null;
  if (required == null) return blocked("SUPPORTED_MINIMUM_SET_ASIDE_ELECTION_REQUIRED", ["election"]);
  const actual = qualifying / total;
  return Object.freeze({ finding: actual >= required ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OR-LIHTC-MINIMUM-SET-ASIDE", required_fraction: required, actual_fraction: actual });
}

export function evaluateOrAnnualHouseholdReporting(input = {}) {
  if (input.household_data_sheet_submitted == null) return blocked("OR_ANNUAL_HOUSEHOLD_REPORTING_INPUT_REQUIRED", ["household_data_sheet_submitted"]);
  return Object.freeze({ finding: input.household_data_sheet_submitted === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OR-LIHTC-ANNUAL-HOUSEHOLD-DATA", reason: input.household_data_sheet_submitted === true ? undefined : "ANNUAL_HOUSEHOLD_DATA_SHEET_REQUIRED" });
}

export function evaluateOr2026LimitImplementation(input = {}) {
  if (!input.certification_or_rent_event_date || !input.limit_dataset_effective_date) return blocked("OR_2026_LIMIT_INPUT_REQUIRED", ["certification_or_rent_event_date", "limit_dataset_effective_date"]);
  const eventDate = new Date(`${input.certification_or_rent_event_date}T00:00:00Z`);
  const datasetDate = new Date(`${input.limit_dataset_effective_date}T00:00:00Z`);
  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(datasetDate.getTime())) return blocked("VALID_LIMIT_DATES_REQUIRED");
  const mandatoryBy = new Date("2026-06-14T00:00:00Z");
  const currentLimits = new Date("2026-05-01T00:00:00Z");
  const pass = eventDate < mandatoryBy || datasetDate >= currentLimits;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OR-2026-MTSP-IMPLEMENTATION", reason: pass ? undefined : "PRE_2026_MTSP_LIMITS_USED_AFTER_JUNE_14_2026" });
}

export function orLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (OR_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_manual_and_advisories_reconciled !== true) missing.push("current_manual_and_advisories_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "OR", program: "LIHTC", version: OR_LIHTC_RULE_PACK_BUILD, effective_from: OR_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "COMPLIANCE_MONITORING_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
