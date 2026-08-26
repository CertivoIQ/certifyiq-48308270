export const TX_LIHTC_RULE_PACK_BUILD = "tx-lihtc-monitoring-2026.08.26.1";
export const TX_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const TX_LIHTC_SOURCE = Object.freeze({
  title: "Texas Administrative Code Title 10 Chapter 10 Subchapter F - Compliance Monitoring",
  url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/CM-SubCh-F-Searchable.pdf",
  sha256: "2bfceae19671d1ec69fc7d318f4f31ca431aa8dc7c8b4e55763bc059f3569c2f",
  effective_date: "2025-01-02",
  citations: Object.freeze({
    annualOwnerComplianceReport: "10 TAC §10.607(b)-(e), PDF pages 10-11",
    quarterlyUnitStatusReport: "10 TAC §10.607(f), PDF page 11",
    form8609Submission: "10 TAC §10.607(i), PDF pages 11-12",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateTxAocr(input = {}) {
  for (const field of ["award_year", "report_year", "submitted_via_cmts", "submitted_date"]) {
    if (input[field] == null) return blocked("TX_AOCR_INPUT_REQUIRED", [field]);
  }
  const firstDueYear = Number(input.award_year) + 2;
  if (Number(input.report_year) < firstDueYear) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "TX-LIHTC-AOCR", report_required: false, first_due_year: firstDueYear });
  }
  if (input.submitted_via_cmts !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "TX-LIHTC-AOCR", report_required: true, reason: "AOCR_MUST_BE_SUBMITTED_THROUGH_CMTS" });
  }
  const submitted = new Date(`${input.submitted_date}T00:00:00Z`);
  const deadline = new Date(`${input.report_year}-04-30T23:59:59Z`);
  if (Number.isNaN(submitted.getTime())) return blocked("VALID_AOCR_SUBMISSION_DATE_REQUIRED", ["submitted_date"]);
  return Object.freeze({
    finding: submitted <= deadline ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "TX-LIHTC-AOCR",
    report_required: true,
    due_date: `${input.report_year}-04-30`,
    reason: submitted <= deadline ? undefined : "AOCR_SUBMITTED_AFTER_APRIL_30",
  });
}

export function evaluateTxQuarterlyUsr(input = {}) {
  if (input.leasing_activity_commenced !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "TX-LIHTC-USR", report_required: false });
  }
  for (const field of ["report_due_month", "submitted_date", "occupancy_as_of_date", "submitted_via_cmts"]) {
    if (input[field] == null) return blocked("TX_USR_INPUT_REQUIRED", [field]);
  }
  if (![1, 4, 7, 10].includes(Number(input.report_due_month))) {
    return blocked("VALID_QUARTERLY_REPORT_MONTH_REQUIRED", ["report_due_month"]);
  }
  if (input.submitted_via_cmts !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "TX-LIHTC-USR", reason: "USR_MUST_BE_SUBMITTED_THROUGH_CMTS" });
  }
  const submitted = new Date(`${input.submitted_date}T00:00:00Z`);
  const occupancy = new Date(`${input.occupancy_as_of_date}T00:00:00Z`);
  if (Number.isNaN(submitted.getTime()) || Number.isNaN(occupancy.getTime())) return blocked("VALID_USR_DATES_REQUIRED", ["submitted_date", "occupancy_as_of_date"]);
  const due = new Date(Date.UTC(submitted.getUTCFullYear(), Number(input.report_due_month) - 1, 10));
  const expectedOccupancy = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), 0));
  const timely = submitted <= due;
  const correctSnapshot = occupancy.toISOString().slice(0, 10) === expectedOccupancy.toISOString().slice(0, 10);
  return Object.freeze({
    finding: timely && correctSnapshot ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "TX-LIHTC-USR",
    due_date: due.toISOString().slice(0, 10),
    expected_occupancy_as_of: expectedOccupancy.toISOString().slice(0, 10),
    reason: !timely ? "USR_SUBMITTED_LATE" : !correctSnapshot ? "USR_OCCUPANCY_SNAPSHOT_DATE_INCORRECT" : undefined,
  });
}

export function evaluateTxForm8609Submission(input = {}) {
  if (input.monitoring_review_number == null) return blocked("MONITORING_REVIEW_NUMBER_REQUIRED", ["monitoring_review_number"]);
  if (Number(input.monitoring_review_number) < 2) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "TX-LIHTC-8609", submission_required_yet: false });
  }
  if (input.form8609_part_ii_complete == null || input.submitted_through_cmts == null) {
    return blocked("FORM_8609_SUBMISSION_STATUS_REQUIRED", ["form8609_part_ii_complete", "submitted_through_cmts"]);
  }
  const pass = input.form8609_part_ii_complete === true && input.submitted_through_cmts === true;
  return Object.freeze({
    finding: pass ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "TX-LIHTC-8609",
    submission_required_yet: true,
    reason: pass ? undefined : "FORM_8609_PART_II_REQUIRED_THROUGH_CMTS_BY_SECOND_MONITORING_REVIEW",
  });
}

export function txLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (input.subchapter_f_sha256 !== TX_LIHTC_SOURCE.sha256) missing.push("subchapter_f_sha256");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  return Object.freeze({
    state: "TX",
    program: "LIHTC",
    version: TX_LIHTC_RULE_PACK_BUILD,
    effective_from: TX_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    scope: "REPORTING_AND_MONITORING_ONLY",
    qap_allocation_rules_included: false,
    property_figure_verification_required: true,
  });
}
