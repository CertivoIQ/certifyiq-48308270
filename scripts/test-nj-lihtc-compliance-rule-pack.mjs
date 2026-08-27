import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateNjAnnualOwnerCertification,
  evaluateNjAuditedFinancialStatement,
  evaluateNjPassbookRate2026,
  evaluateNj2025UtilityAllowanceImplementation,
  njLihtcReleaseEligibility,
} from "../src/lib/nj-lihtc-compliance-rule-pack.mjs";

test("NJ annual owner compliance certification is due January 31", () => {
  assert.equal(evaluateNjAnnualOwnerCertification({ reporting_year: 2025, submission_date: "2026-01-31", certification_complete: true }).finding, "PASS");
  assert.equal(evaluateNjAnnualOwnerCertification({ reporting_year: 2025, submission_date: "2026-02-01", certification_complete: true }).finding, "FAIL");
});

test("NJ audited financial statements are due May 1 during the first 15 compliance years and require the stated package", () => {
  assert.equal(evaluateNjAuditedFinancialStatement({ compliance_period_year: 10, submission_year: 2026, submission_date: "2026-05-01", lihtc_number_present: true, project_name_present: true, detailed_income_expense_schedule_present: true, vacancy_rate_calculation_present: true }).finding, "PASS");
  assert.equal(evaluateNjAuditedFinancialStatement({ compliance_period_year: 10, submission_year: 2026, submission_date: "2026-05-02", lihtc_number_present: true, project_name_present: true, detailed_income_expense_schedule_present: true, vacancy_rate_calculation_present: true }).finding, "FAIL");
  assert.equal(evaluateNjAuditedFinancialStatement({ compliance_period_year: 10, submission_year: 2026, submission_date: "2026-05-01", lihtc_number_present: true, project_name_present: true, detailed_income_expense_schedule_present: false, vacancy_rate_calculation_present: true }).finding, "FAIL");
  assert.equal(evaluateNjAuditedFinancialStatement({ compliance_period_year: 16 }).required_by_this_rule, false);
});

test("NJ certifications on or after January 1 2026 use the 0.40 percent passbook rate", () => {
  assert.equal(evaluateNjPassbookRate2026({ certification_date: "2026-01-01", passbook_rate_percent: 0.4 }).finding, "PASS");
  assert.equal(evaluateNjPassbookRate2026({ certification_date: "2026-01-01", passbook_rate_percent: 0.45 }).finding, "FAIL");
  assert.equal(evaluateNjPassbookRate2026({ certification_date: "2025-12-31", passbook_rate_percent: 0.45 }).rate_required_by_this_rule, false);
});

test("NJ 2025 DCA utility allowance schedule is implemented no later than January 1 2026", () => {
  assert.equal(evaluateNj2025UtilityAllowanceImplementation({ implementation_date: "2025-12-30" }).finding, "PASS");
  assert.equal(evaluateNj2025UtilityAllowanceImplementation({ implementation_date: "2026-01-01" }).finding, "PASS");
  assert.equal(evaluateNj2025UtilityAllowanceImplementation({ implementation_date: "2026-01-02" }).finding, "FAIL");
});

test("NJ release remains blocked while the compliance manual is under revision and exact identities are absent", () => {
  const result = njLihtcReleaseEligibility({ current_qap_and_compliance_sources_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("current_compliance_manual_validated"));
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
