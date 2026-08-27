export const OK_LIHTC_RULE_PACK_BUILD = "ok-lihtc-compliance-2026.08.26.1";
export const OK_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const OK_LIHTC_SOURCES = Object.freeze({
  program_page: "https://www.ohfa.org/affordable-housing-tax-credits/",
  limits_page: "https://www.ohfa.org/tax-credit-income-rent-limits/",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateOkAnnualOwnerCertification(input = {}) {
  for (const field of ["reporting_year", "quarterly_reporting_to_compliance", "aoc_submitted_date"]) {
    if (input[field] == null) return blocked("OK_AOC_INPUT_REQUIRED", [field]);
  }
  if (Number(input.reporting_year) !== 2025) return blocked("OK_2025_AOC_RULE_ONLY", ["applicable_reporting_year_rule"]);
  if (input.quarterly_reporting_to_compliance === true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "OK-2025-AOC", aoc_required: false });
  }
  const submitted = new Date(`${input.aoc_submitted_date}T00:00:00Z`);
  const deadline = new Date("2026-02-15T23:59:59Z");
  if (Number.isNaN(submitted.getTime())) return blocked("VALID_AOC_SUBMISSION_DATE_REQUIRED");
  return Object.freeze({
    finding: submitted <= deadline ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "OK-2025-AOC",
    aoc_required: true,
    deadline: "2026-02-15",
    reason: submitted <= deadline ? undefined : "ANNUAL_OWNER_CERTIFICATION_LATE",
  });
}

export function evaluateOkCertificationPortalReporting(input = {}) {
  for (const field of ["reporting_year", "unsigned_aoc_report_uploaded", "all_tenant_certifications_uploaded", "submission_date"]) {
    if (input[field] == null) return blocked("OK_CERTIFICATION_PORTAL_INPUT_REQUIRED", [field]);
  }
  if (Number(input.reporting_year) !== 2025) return blocked("OK_2025_CERTIFICATION_PORTAL_RULE_ONLY", ["applicable_reporting_year_rule"]);
  const submitted = new Date(`${input.submission_date}T00:00:00Z`);
  const deadline = new Date("2026-02-15T23:59:59Z");
  if (Number.isNaN(submitted.getTime())) return blocked("VALID_CERTIFICATION_PORTAL_DATE_REQUIRED");
  const complete = input.unsigned_aoc_report_uploaded === true && input.all_tenant_certifications_uploaded === true;
  const timely = submitted <= deadline;
  return Object.freeze({
    finding: complete && timely ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "OK-2025-CERTIFICATION-PORTAL",
    deadline: "2026-02-15",
    reason: complete && timely ? undefined : !complete ? "CERTIFICATION_PORTAL_REPORT_INCOMPLETE" : "CERTIFICATION_PORTAL_REPORT_LATE",
  });
}

export function evaluateOk2026LimitEffectiveDate(input = {}) {
  if (!input.event_date || !input.limit_dataset_effective_date) return blocked("OK_2026_LIMIT_INPUT_REQUIRED", ["event_date", "limit_dataset_effective_date"]);
  const eventDate = new Date(`${input.event_date}T00:00:00Z`);
  const datasetDate = new Date(`${input.limit_dataset_effective_date}T00:00:00Z`);
  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(datasetDate.getTime())) return blocked("VALID_LIMIT_DATES_REQUIRED");
  const effective = new Date("2026-05-01T00:00:00Z");
  const pass = eventDate < effective || datasetDate >= effective;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OK-2026-LIMIT-EFFECTIVE-DATE", reason: pass ? undefined : "PRE_2026_LIMITS_USED_ON_OR_AFTER_MAY_1_2026" });
}

export function okLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (OK_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_2026_qap_and_compliance_sources_reconciled !== true) missing.push("current_2026_qap_and_compliance_sources_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "OK", program: "LIHTC", version: OK_LIHTC_RULE_PACK_BUILD, effective_from: OK_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "COMPLIANCE_REPORTING_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
