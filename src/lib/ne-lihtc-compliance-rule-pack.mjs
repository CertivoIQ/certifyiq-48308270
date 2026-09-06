export const NE_LIHTC_RULE_PACK_BUILD = "ne-lihtc-compliance-2026.08.26.1";
export const NE_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const NE_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://www.nifa.org/developers-property-managers/lihtc-compliance",
  forms_page: "https://www.nifa.org/developers-property-managers/forms-docs",
  qualified_contract_toolkit: "https://www.nifa.org/developers-property-managers/qualified-contract-toolkit",
  minimum_compliance_years: 15,
  minimum_extended_use_years: 15,
  noncompliance_response_days: 60,
  decontrol_owner_cert_due_month_day: "01-31",
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

export function evaluateNeNoncomplianceResponse(input = {}) {
  if (input.report_indicates_noncompliance == null) return blocked("NE_NONCOMPLIANCE_STATUS_REQUIRED", ["report_indicates_noncompliance"]);
  if (input.report_indicates_noncompliance !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NE-LIHTC-NONCOMPLIANCE-RESPONSE", response_required: false });
  }
  for (const field of ["nifa_letter_date", "owner_response_date", "clarification_or_correction_documentation_present"]) {
    if (input[field] == null) return blocked("NE_NONCOMPLIANCE_RESPONSE_INPUT_REQUIRED", [field]);
  }
  const letter = parseDate(input.nifa_letter_date, "VALID_NE_NIFA_LETTER_DATE_REQUIRED");
  const response = parseDate(input.owner_response_date, "VALID_NE_OWNER_RESPONSE_DATE_REQUIRED");
  if (letter?.status === "BLOCKED") return letter;
  if (response?.status === "BLOCKED") return response;
  if (response < letter) return blocked("NE_RESPONSE_DATE_PRECEDES_NIFA_LETTER_DATE");
  const deadline = new Date(letter);
  deadline.setUTCDate(deadline.getUTCDate() + NE_LIHTC_SOURCES.noncompliance_response_days);
  const documented = input.clarification_or_correction_documentation_present === true;
  const timely = response <= deadline;
  return Object.freeze({ finding: timely && documented ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NE-LIHTC-NONCOMPLIANCE-RESPONSE", response_due_date: deadline.toISOString().slice(0, 10), reason: !timely ? "NIFA_NONCOMPLIANCE_RESPONSE_LATE" : !documented ? "NIFA_RESPONSE_MUST_CLARIFY_OR_DOCUMENT_CORRECTION" : undefined });
}

export function evaluateNeAffordabilityPeriodBoundary(input = {}) {
  if (input.year_number_since_credit_period_start == null) return blocked("NE_AFFORDABILITY_YEAR_REQUIRED", ["year_number_since_credit_period_start"]);
  const year = Number(input.year_number_since_credit_period_start);
  if (!Number.isInteger(year) || year < 1) return blocked("VALID_NE_AFFORDABILITY_YEAR_REQUIRED", ["year_number_since_credit_period_start"]);
  if (year <= NE_LIHTC_SOURCES.minimum_compliance_years) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NE-LIHTC-AFFORDABILITY-PERIOD", phase: "INITIAL_COMPLIANCE_PERIOD", minimum_restriction_active: true, irs_8823_reporting_period: true });
  }
  const minimumEnd = NE_LIHTC_SOURCES.minimum_compliance_years + NE_LIHTC_SOURCES.minimum_extended_use_years;
  if (year <= minimumEnd) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NE-LIHTC-AFFORDABILITY-PERIOD", phase: "MINIMUM_EXTENDED_USE_PERIOD", minimum_restriction_active: true, irs_8823_reporting_period: false });
  }
  if (input.verified_lura_total_affordability_years == null) return blocked("NE_LURA_REQUIRED_BEYOND_MINIMUM_30_YEAR_PERIOD", ["verified_lura_total_affordability_years"]);
  const luraYears = Number(input.verified_lura_total_affordability_years);
  if (!Number.isInteger(luraYears) || luraYears < minimumEnd) return blocked("VALID_NE_LURA_AFFORDABILITY_TERM_REQUIRED", ["verified_lura_total_affordability_years"]);
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NE-LIHTC-AFFORDABILITY-PERIOD", phase: year <= luraYears ? "LURA_EXTENDED_COMMITMENT" : "BEYOND_VERIFIED_LURA_TERM", minimum_restriction_active: year <= luraYears, verified_lura_total_affordability_years: luraYears });
}

export function evaluateNeQualifiedContractDecontrolCertification(input = {}) {
  if (input.qualified_contract_decontrol_period_active == null) return blocked("NE_DECONTROL_STATUS_REQUIRED", ["qualified_contract_decontrol_period_active"]);
  if (input.qualified_contract_decontrol_period_active !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NE-LIHTC-DECONTROL-ANNUAL-CERTIFICATION", required_by_this_rule: false });
  }
  for (const field of ["reporting_year", "submission_date", "owner_certification_complete", "current_rent_roll_attached"]) {
    if (input[field] == null) return blocked("NE_DECONTROL_CERTIFICATION_INPUT_REQUIRED", [field]);
  }
  const dueYear = Number(input.reporting_year) + 1;
  if (!Number.isInteger(dueYear)) return blocked("VALID_NE_REPORTING_YEAR_REQUIRED", ["reporting_year"]);
  const submitted = parseDate(input.submission_date, "VALID_NE_DECONTROL_SUBMISSION_DATE_REQUIRED");
  if (submitted?.status === "BLOCKED") return submitted;
  const due = new Date(`${dueYear}-${NE_LIHTC_SOURCES.decontrol_owner_cert_due_month_day}T23:59:59Z`);
  const complete = input.owner_certification_complete === true && input.current_rent_roll_attached === true;
  return Object.freeze({ finding: complete && submitted <= due ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NE-LIHTC-DECONTROL-ANNUAL-CERTIFICATION", required_by_this_rule: true, due_date: `${dueYear}-${NE_LIHTC_SOURCES.decontrol_owner_cert_due_month_day}`, reason: !complete ? "NE_DECONTROL_CERTIFICATION_AND_RENT_ROLL_REQUIRED" : submitted > due ? "NE_DECONTROL_ANNUAL_CERTIFICATION_LATE" : undefined });
}

export function neLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (NE_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_compliance_manual_and_forms_reconciled !== true) missing.push("current_compliance_manual_and_forms_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "NE", program: "LIHTC", version: NE_LIHTC_RULE_PACK_BUILD, effective_from: NE_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "MONITORING_RESPONSE_AFFORDABILITY_AND_DECONTROL_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
