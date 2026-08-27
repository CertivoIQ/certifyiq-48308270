export const NH_LIHTC_RULE_PACK_BUILD = "nh-lihtc-compliance-2026.08.26.1";
export const NH_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const NH_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://www.nhhousing.org/developer-financing/asset-management/low-income-housing-tax-credit/",
  household_certification_requirements: "https://www.nhhousing.org/wp-content/uploads/2026/05/Household-Certification-Requirements.pdf",
  qap_page: "https://www.nhhousing.org/developer-financing/lihtc/",
  annual_due_month_day: "03-01",
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

export function evaluateNhAnnualHdsSubmission(input = {}) {
  for (const field of ["reporting_year", "submission_date", "calendar_year_data_complete"]) {
    if (input[field] == null) return blocked("NH_HDS_ANNUAL_SUBMISSION_INPUT_REQUIRED", [field]);
  }
  const dueYear = Number(input.reporting_year) + 1;
  if (!Number.isInteger(dueYear)) return blocked("VALID_NH_REPORTING_YEAR_REQUIRED", ["reporting_year"]);
  const submitted = parseDate(input.submission_date, "VALID_NH_HDS_SUBMISSION_DATE_REQUIRED");
  if (submitted?.status === "BLOCKED") return submitted;
  const due = new Date(`${dueYear}-${NH_LIHTC_SOURCES.annual_due_month_day}T23:59:59Z`);
  const complete = input.calendar_year_data_complete === true;
  const timely = submitted <= due;
  return Object.freeze({
    finding: complete && timely ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "NH-LIHTC-HDS-ANNUAL-SUBMISSION",
    due_date: `${dueYear}-${NH_LIHTC_SOURCES.annual_due_month_day}`,
    reason: !complete ? "HDS_CALENDAR_YEAR_DATA_INCOMPLETE" : !timely ? "HDS_ANNUAL_SUBMISSION_LATE" : undefined,
  });
}

export function evaluateNhAnnualOwnerCertification(input = {}) {
  for (const field of ["reporting_year", "submission_date", "owner_certification_complete", "management_training_certification_complete"]) {
    if (input[field] == null) return blocked("NH_ANNUAL_CERTIFICATION_INPUT_REQUIRED", [field]);
  }
  const dueYear = Number(input.reporting_year) + 1;
  if (!Number.isInteger(dueYear)) return blocked("VALID_NH_REPORTING_YEAR_REQUIRED", ["reporting_year"]);
  const submitted = parseDate(input.submission_date, "VALID_NH_ANNUAL_CERTIFICATION_DATE_REQUIRED");
  if (submitted?.status === "BLOCKED") return submitted;
  const due = new Date(`${dueYear}-${NH_LIHTC_SOURCES.annual_due_month_day}T23:59:59Z`);
  const complete = input.owner_certification_complete === true && input.management_training_certification_complete === true;
  return Object.freeze({
    finding: complete && submitted <= due ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "NH-LIHTC-ANNUAL-OWNER-CERTIFICATION",
    due_date: `${dueYear}-${NH_LIHTC_SOURCES.annual_due_month_day}`,
    reason: !complete ? "NH_ANNUAL_CERTIFICATION_PACKAGE_INCOMPLETE" : submitted > due ? "NH_ANNUAL_CERTIFICATION_SUBMITTED_LATE" : undefined,
  });
}

export function evaluateNhAnnualRecertificationRequirement(input = {}) {
  if (input.project_type == null) return blocked("NH_PROJECT_TYPE_REQUIRED", ["project_type"]);
  if (input.project_type === "MIXED_INCOME") {
    if (input.annual_income_recertification_complete == null) return blocked("NH_MIXED_INCOME_RECERTIFICATION_STATUS_REQUIRED", ["annual_income_recertification_complete"]);
    return Object.freeze({ finding: input.annual_income_recertification_complete === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NH-LIHTC-ANNUAL-RECERTIFICATION", annual_income_recertification_required: true, reason: input.annual_income_recertification_complete === true ? undefined : "MIXED_INCOME_LOW_INCOME_HOUSEHOLDS_REQUIRE_ANNUAL_RECERTIFICATION" });
  }
  if (input.project_type !== "ONE_HUNDRED_PERCENT_LOW_INCOME") return blocked("VALID_NH_PROJECT_TYPE_REQUIRED", ["project_type"]);
  for (const field of ["form8609_project_scope_verified", "all_units_in_compliance", "annual_student_status_complete", "annual_household_composition_complete"]) {
    if (input[field] == null) return blocked("NH_100_PERCENT_RECERTIFICATION_INPUT_REQUIRED", [field]);
  }
  if (input.form8609_project_scope_verified !== true || input.all_units_in_compliance !== true) {
    return blocked("NH_100_PERCENT_RECERTIFICATION_EXEMPTION_NOT_ESTABLISHED", ["verified_form8609_line_8b_project_scope", "all_units_in_compliance"]);
  }
  const annualNonIncomeComplete = input.annual_student_status_complete === true && input.annual_household_composition_complete === true;
  return Object.freeze({
    finding: annualNonIncomeComplete ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "NH-LIHTC-ANNUAL-RECERTIFICATION",
    annual_income_recertification_required: false,
    annual_student_and_household_certification_required: true,
    reason: annualNonIncomeComplete ? undefined : "ANNUAL_STUDENT_STATUS_AND_HOUSEHOLD_COMPOSITION_REQUIRED",
  });
}

export function evaluateNhInitialTicTiming(input = {}) {
  for (const field of ["effective_date", "last_required_signature_date", "acquisition_rehab_existing_household"]) {
    if (input[field] == null) return blocked("NH_INITIAL_TIC_TIMING_INPUT_REQUIRED", [field]);
  }
  const effective = parseDate(input.effective_date, "VALID_NH_TIC_EFFECTIVE_DATE_REQUIRED");
  const signed = parseDate(input.last_required_signature_date, "VALID_NH_TIC_SIGNATURE_DATE_REQUIRED");
  if (effective?.status === "BLOCKED") return effective;
  if (signed?.status === "BLOCKED") return signed;
  if (input.acquisition_rehab_existing_household === true) {
    const deadline = new Date(effective);
    deadline.setUTCDate(deadline.getUTCDate() + 120);
    return Object.freeze({ finding: signed <= deadline ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NH-LIHTC-INITIAL-TIC-TIMING", acquisition_rehab_exception_applied: true, deadline: deadline.toISOString().slice(0, 10), reason: signed <= deadline ? undefined : "ACQUISITION_REHAB_TIC_SIGNED_AFTER_120_DAY_EXCEPTION" });
  }
  return Object.freeze({ finding: signed <= effective ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NH-LIHTC-INITIAL-TIC-TIMING", acquisition_rehab_exception_applied: false, reason: signed <= effective ? undefined : "INITIAL_TIC_MUST_BE_FULLY_SIGNED_ON_OR_BEFORE_EFFECTIVE_DATE" });
}

export function nhLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (NH_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_qap_and_compliance_sources_reconciled !== true) missing.push("current_qap_and_compliance_sources_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "NH", program: "LIHTC", version: NH_LIHTC_RULE_PACK_BUILD, effective_from: NH_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "REPORTING_AND_HOUSEHOLD_CERTIFICATION_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
