export const NJ_LIHTC_RULE_PACK_BUILD = "nj-lihtc-compliance-2026.08.26.1";
export const NJ_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const NJ_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/",
  qap_page: "https://www.nj.gov/dca/hmfa/developers/lihtc/qap/",
  limits_page: "https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/incomelimits.shtml",
  annual_owner_due_month_day: "01-31",
  audited_financial_due_month_day: "05-01",
  passbook_rate_effective_date: "2026-01-01",
  passbook_rate_percent: 0.4,
  utility_schedule_2025_effective_date: "2025-10-01",
  utility_schedule_2025_latest_implementation_date: "2026-01-01",
  compliance_manual_status: "UNDER_REVISION",
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

export function evaluateNjAnnualOwnerCertification(input = {}) {
  for (const field of ["reporting_year", "submission_date", "certification_complete"]) {
    if (input[field] == null) return blocked("NJ_ANNUAL_OWNER_CERT_INPUT_REQUIRED", [field]);
  }
  const dueYear = Number(input.reporting_year) + 1;
  if (!Number.isInteger(dueYear)) return blocked("VALID_NJ_REPORTING_YEAR_REQUIRED", ["reporting_year"]);
  const submitted = parseDate(input.submission_date, "VALID_NJ_OWNER_CERT_SUBMISSION_DATE_REQUIRED");
  if (submitted?.status === "BLOCKED") return submitted;
  const due = new Date(`${dueYear}-${NJ_LIHTC_SOURCES.annual_owner_due_month_day}T23:59:59Z`);
  const complete = input.certification_complete === true;
  return Object.freeze({
    finding: complete && submitted <= due ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "NJ-LIHTC-ANNUAL-OWNER-CERTIFICATION",
    due_date: `${dueYear}-${NJ_LIHTC_SOURCES.annual_owner_due_month_day}`,
    reason: !complete ? "NJ_ANNUAL_OWNER_CERTIFICATION_INCOMPLETE" : submitted > due ? "NJ_ANNUAL_OWNER_CERTIFICATION_LATE" : undefined,
  });
}

export function evaluateNjAuditedFinancialStatement(input = {}) {
  if (input.compliance_period_year == null) return blocked("NJ_COMPLIANCE_PERIOD_YEAR_REQUIRED", ["compliance_period_year"]);
  const periodYear = Number(input.compliance_period_year);
  if (!Number.isInteger(periodYear) || periodYear < 1) return blocked("VALID_NJ_COMPLIANCE_PERIOD_YEAR_REQUIRED", ["compliance_period_year"]);
  if (periodYear > 15) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NJ-LIHTC-AUDITED-FINANCIALS", required_by_this_rule: false });
  for (const field of ["submission_year", "submission_date", "lihtc_number_present", "project_name_present", "detailed_income_expense_schedule_present", "vacancy_rate_calculation_present"]) {
    if (input[field] == null) return blocked("NJ_AUDITED_FINANCIAL_INPUT_REQUIRED", [field]);
  }
  const submissionYear = Number(input.submission_year);
  if (!Number.isInteger(submissionYear)) return blocked("VALID_NJ_FINANCIAL_SUBMISSION_YEAR_REQUIRED", ["submission_year"]);
  const submitted = parseDate(input.submission_date, "VALID_NJ_FINANCIAL_SUBMISSION_DATE_REQUIRED");
  if (submitted?.status === "BLOCKED") return submitted;
  const due = new Date(`${submissionYear}-${NJ_LIHTC_SOURCES.audited_financial_due_month_day}T23:59:59Z`);
  const complete = input.lihtc_number_present === true && input.project_name_present === true && input.detailed_income_expense_schedule_present === true && input.vacancy_rate_calculation_present === true;
  return Object.freeze({ finding: complete && submitted <= due ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NJ-LIHTC-AUDITED-FINANCIALS", required_by_this_rule: true, due_date: `${submissionYear}-${NJ_LIHTC_SOURCES.audited_financial_due_month_day}`, reason: !complete ? "NJ_AUDITED_FINANCIAL_STATEMENT_PACKAGE_INCOMPLETE" : submitted > due ? "NJ_AUDITED_FINANCIAL_STATEMENT_LATE" : undefined });
}

export function evaluateNjPassbookRate2026(input = {}) {
  for (const field of ["certification_date", "passbook_rate_percent"]) {
    if (input[field] == null) return blocked("NJ_PASSBOOK_RATE_INPUT_REQUIRED", [field]);
  }
  const certification = parseDate(input.certification_date, "VALID_NJ_CERTIFICATION_DATE_REQUIRED");
  if (certification?.status === "BLOCKED") return certification;
  const effective = new Date(`${NJ_LIHTC_SOURCES.passbook_rate_effective_date}T00:00:00Z`);
  if (certification < effective) return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NJ-LIHTC-PASSBOOK-2026", rate_required_by_this_rule: false });
  const pass = Number(input.passbook_rate_percent) === NJ_LIHTC_SOURCES.passbook_rate_percent;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NJ-LIHTC-PASSBOOK-2026", rate_required_by_this_rule: true, required_rate_percent: NJ_LIHTC_SOURCES.passbook_rate_percent, reason: pass ? undefined : "NJ_2026_PASSBOOK_RATE_MUST_BE_0_40_PERCENT" });
}

export function evaluateNj2025UtilityAllowanceImplementation(input = {}) {
  if (input.implementation_date == null) return blocked("NJ_UTILITY_ALLOWANCE_IMPLEMENTATION_DATE_REQUIRED", ["implementation_date"]);
  const implemented = parseDate(input.implementation_date, "VALID_NJ_UTILITY_ALLOWANCE_IMPLEMENTATION_DATE_REQUIRED");
  if (implemented?.status === "BLOCKED") return implemented;
  const effective = new Date(`${NJ_LIHTC_SOURCES.utility_schedule_2025_effective_date}T00:00:00Z`);
  const latest = new Date(`${NJ_LIHTC_SOURCES.utility_schedule_2025_latest_implementation_date}T23:59:59Z`);
  const pass = implemented >= effective && implemented <= latest;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NJ-LIHTC-UA-2025-IMPLEMENTATION", schedule_effective_date: NJ_LIHTC_SOURCES.utility_schedule_2025_effective_date, latest_implementation_date: NJ_LIHTC_SOURCES.utility_schedule_2025_latest_implementation_date, reason: pass ? undefined : "NJ_2025_UTILITY_ALLOWANCE_IMPLEMENTATION_OUTSIDE_ALLOWED_WINDOW" });
}

export function njLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (NJ_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (NJ_LIHTC_SOURCES.compliance_manual_status !== "CURRENT_VALIDATED") missing.push("current_compliance_manual_validated");
  if (input.current_qap_and_compliance_sources_reconciled !== true) missing.push("current_qap_and_compliance_sources_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "NJ", program: "LIHTC", version: NJ_LIHTC_RULE_PACK_BUILD, effective_from: NJ_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "ANNUAL_REPORTING_FINANCIALS_AND_2026_POLICY_BOUNDARIES", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
