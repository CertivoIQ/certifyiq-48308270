export const NC_LIHTC_RULE_PACK_BUILD = "nc-lihtc-compliance-2026.08.26.1";
export const NC_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const NC_LIHTC_SOURCES = Object.freeze({
  program_compliance: "https://www.nchfa.com/rental-housing-partners/rental-owners-managers/program-compliance",
  income_limits: "https://www.nchfa.com/rental-housing-partners/rental-owners-managers/income-limits",
  compliance_manual_page: "https://www.nchfa.com/rental-housing-partners/rental-owners-managers/policies-resources-forms/compliance-manual-training-resources",
  qap_2026: "https://www.nchfa.com/sites/default/files/forms_resources/2025-12/2026FinalQAP.pdf",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateNcRcrsReporting(input = {}) {
  if (input.unit_event_date == null || input.reported_date == null) return blocked("NC_RCRS_REPORTING_DATES_REQUIRED", ["unit_event_date", "reported_date"]);
  const eventDate = new Date(`${input.unit_event_date}T00:00:00Z`);
  const reportedDate = new Date(`${input.reported_date}T00:00:00Z`);
  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(reportedDate.getTime())) return blocked("VALID_RCRS_DATES_REQUIRED");
  const days = Math.floor((reportedDate - eventDate) / 86400000);
  if (days < 0) return blocked("RCRS_REPORT_PRECEDES_EVENT_DATE");
  return Object.freeze({ finding: days <= 30 ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NC-LIHTC-RCRS-30-DAY", days_to_report: days, reason: days <= 30 ? undefined : "UNIT_EVENT_NOT_REPORTED_WITHIN_30_DAYS" });
}

export function evaluateNcAnnualOwnerCertification(input = {}) {
  if (input.owner_certification_completed == null) return blocked("NC_ANNUAL_OWNER_CERTIFICATION_INPUT_REQUIRED", ["owner_certification_completed"]);
  return Object.freeze({ finding: input.owner_certification_completed === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NC-LIHTC-ANNUAL-OWNER-CERT", reason: input.owner_certification_completed === true ? undefined : "ANNUAL_OWNER_CERTIFICATION_REQUIRED" });
}

export function evaluateNcFullTimeStudentHousehold(input = {}) {
  if (input.household_entirely_full_time_students == null) return blocked("NC_STUDENT_HOUSEHOLD_INPUT_REQUIRED", ["household_entirely_full_time_students"]);
  if (input.household_entirely_full_time_students !== true) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NC-LIHTC-STUDENT-HOUSEHOLD", exception_required: false });
  if (input.valid_section42_student_exception == null) return blocked("NC_STUDENT_EXCEPTION_STATUS_REQUIRED", ["valid_section42_student_exception"]);
  return Object.freeze({ finding: input.valid_section42_student_exception === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NC-LIHTC-STUDENT-HOUSEHOLD", exception_required: true, reason: input.valid_section42_student_exception === true ? undefined : "FULL_TIME_STUDENT_HOUSEHOLD_REQUIRES_VALID_EXCEPTION" });
}

export function evaluateNcMixedIncome140PercentRule(input = {}) {
  for (const field of ["mixed_income_property", "household_income", "current_applicable_income_limit"]) {
    if (input[field] == null) return blocked("NC_140_PERCENT_INPUT_REQUIRED", [field]);
  }
  if (input.mixed_income_property !== true) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NC-LIHTC-140-PERCENT", next_available_unit_rule_triggered: false });
  const income = Number(input.household_income);
  const limit = Number(input.current_applicable_income_limit);
  if (!Number.isFinite(income) || !Number.isFinite(limit) || limit <= 0) return blocked("VALID_INCOME_AND_LIMIT_REQUIRED");
  const triggered = income > limit * 1.4;
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NC-LIHTC-140-PERCENT", next_available_unit_rule_triggered: triggered, ratio: income / limit });
}

export function evaluateNc2026ProjectSpecificLimits(input = {}) {
  if (!input.event_date || !input.limit_dataset_effective_date || input.limit_source !== "RCRS_PROJECT_SPECIFIC") return blocked("NC_2026_PROJECT_SPECIFIC_LIMIT_INPUT_REQUIRED", ["event_date", "limit_dataset_effective_date", "limit_source"]);
  const eventDate = new Date(`${input.event_date}T00:00:00Z`);
  const datasetDate = new Date(`${input.limit_dataset_effective_date}T00:00:00Z`);
  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(datasetDate.getTime())) return blocked("VALID_LIMIT_DATES_REQUIRED");
  const effective = new Date("2026-05-01T00:00:00Z");
  const pass = eventDate < effective || datasetDate >= effective;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NC-2026-PROJECT-SPECIFIC-LIMITS", reason: pass ? undefined : "PRE_2026_LIMITS_USED_ON_OR_AFTER_MAY_1_2026" });
}

export function ncLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (NC_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_2026_qap_manual_and_updates_reconciled !== true) missing.push("current_2026_qap_manual_and_updates_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "NC", program: "LIHTC", version: NC_LIHTC_RULE_PACK_BUILD, effective_from: NC_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "COMPLIANCE_MONITORING_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
