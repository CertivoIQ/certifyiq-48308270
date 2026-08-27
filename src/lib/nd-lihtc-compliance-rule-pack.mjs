export const ND_LIHTC_RULE_PACK_BUILD = "nd-lihtc-compliance-2026.08.26.1";
export const ND_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const ND_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://www.ndhousing.nd.gov/compliance",
  compliance_manual: "https://www.ndhousing.nd.gov/sites/www/files/documents/Plans/LIHTCComplianceManual.pdf",
  compliance_forms: "https://www.ndhousing.nd.gov/compliance-forms",
  limit_effective_date_2026: "2026-05-01",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

function parseDate(value, reason) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return blocked(reason);
  return parsed;
}

export function evaluateNdUtilityAllowanceAnnualReview(input = {}) {
  for (const field of ["calendar_year", "review_date"]) {
    if (input[field] == null) return blocked("ND_UA_ANNUAL_REVIEW_INPUT_REQUIRED", [field]);
  }
  const review = parseDate(input.review_date, "VALID_ND_UA_REVIEW_DATE_REQUIRED");
  if (review?.status === "BLOCKED") return review;
  const year = Number(input.calendar_year);
  if (!Number.isInteger(year)) return blocked("VALID_ND_UA_CALENDAR_YEAR_REQUIRED", ["calendar_year"]);
  return Object.freeze({ finding: review.getUTCFullYear() === year ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "ND-LIHTC-UA-ANNUAL-REVIEW", review_required_each_calendar_year: true, reason: review.getUTCFullYear() === year ? undefined : "UTILITY_ALLOWANCE_NOT_REVIEWED_IN_REQUIRED_CALENDAR_YEAR" });
}

export function evaluateNdUtilityAllowanceMethodChange(input = {}) {
  if (input.method_changed == null) return blocked("ND_UA_METHOD_CHANGE_STATUS_REQUIRED", ["method_changed"]);
  if (input.method_changed !== true) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "ND-LIHTC-UA-METHOD-CHANGE", notification_required: false });
  for (const field of ["ndhfa_notified", "new_method"]) if (input[field] == null) return blocked("ND_UA_METHOD_CHANGE_INPUT_REQUIRED", [field]);
  if (input.new_method === "AGENCY_ESTIMATE") return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "ND-LIHTC-UA-METHOD-CHANGE", reason: "NDHFA_AGENCY_ESTIMATE_NOT_CURRENTLY_AVAILABLE" });
  if (input.ndhfa_notified !== true) return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "ND-LIHTC-UA-METHOD-CHANGE", reason: "NDHFA_NOTIFICATION_REQUIRED_FOR_UTILITY_ALLOWANCE_METHOD_CHANGE" });
  if (input.new_method === "ENERGY_CONSUMPTION_MODEL") {
    if (input.ndhfa_preuse_review_complete == null) return blocked("NDHFA_PREUSE_REVIEW_STATUS_REQUIRED", ["ndhfa_preuse_review_complete"]);
    if (input.ndhfa_preuse_review_complete !== true) return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "ND-LIHTC-UA-METHOD-CHANGE", reason: "NDHFA_PREUSE_REVIEW_REQUIRED_FOR_ENERGY_CONSUMPTION_MODEL" });
  }
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "ND-LIHTC-UA-METHOD-CHANGE", notification_required: true });
}

export function evaluateNdUtilityAllowanceImplementation(input = {}) {
  for (const field of ["allowance_effective_date", "implemented_date"]) if (input[field] == null) return blocked("ND_UA_IMPLEMENTATION_INPUT_REQUIRED", [field]);
  const effective = parseDate(input.allowance_effective_date, "VALID_ND_UA_EFFECTIVE_DATE_REQUIRED");
  const implemented = parseDate(input.implemented_date, "VALID_ND_UA_IMPLEMENTATION_DATE_REQUIRED");
  if (effective?.status === "BLOCKED") return effective;
  if (implemented?.status === "BLOCKED") return implemented;
  const required = new Date(effective);
  required.setUTCDate(required.getUTCDate() + 90);
  return Object.freeze({ finding: implemented.getTime() === required.getTime() ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "ND-LIHTC-UA-90-DAY-PERIOD", required_implementation_date: required.toISOString().slice(0, 10), reason: implemented.getTime() === required.getTime() ? undefined : "UTILITY_ALLOWANCE_MUST_BE_IMPLEMENTED_IMMEDIATELY_AFTER_90_DAY_PERIOD" });
}

export function evaluateNdLimitSelectionBoundary(input = {}) {
  for (const field of ["placed_in_service_date", "event_date"]) if (input[field] == null) return blocked("ND_LIMIT_SELECTION_INPUT_REQUIRED", [field]);
  const placedInService = parseDate(input.placed_in_service_date, "VALID_ND_PLACED_IN_SERVICE_DATE_REQUIRED");
  const event = parseDate(input.event_date, "VALID_ND_LIMIT_EVENT_DATE_REQUIRED");
  if (placedInService?.status === "BLOCKED") return placedInService;
  if (event?.status === "BLOCKED") return event;
  if (event < placedInService) return blocked("EVENT_DATE_PRECEDES_PLACED_IN_SERVICE_DATE");
  const heraBoundary = new Date("2009-01-01T00:00:00Z");
  if (placedInService < heraBoundary) return blocked("HERA_SPECIAL_LIMIT_SELECTION_REQUIRES_PROPERTY_SPECIFIC_VERIFICATION", ["validated_hera_special_limit_record"]);
  return blocked("HISTORICAL_HIGHEST_MTSP_SELECTION_REQUIRES_PROPERTY_SPECIFIC_VERIFICATION", ["validated_limit_history", "selected_highest_applicable_limit_record"]);
}

export function ndLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (ND_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_manual_and_allocation_cycle_reconciled !== true) missing.push("current_manual_and_allocation_cycle_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "ND", program: "LIHTC", version: ND_LIHTC_RULE_PACK_BUILD, effective_from: ND_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "UTILITY_ALLOWANCE_RULES_ONLY_WITH_LIMIT_SELECTION_FAIL_CLOSED", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
