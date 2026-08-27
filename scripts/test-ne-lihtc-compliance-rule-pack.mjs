import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateNeNoncomplianceResponse,
  evaluateNeAffordabilityPeriodBoundary,
  evaluateNeQualifiedContractDecontrolCertification,
  neLihtcReleaseEligibility,
} from "../src/lib/ne-lihtc-compliance-rule-pack.mjs";

test("NE owner response to a NIFA noncompliance report is due within 60 days with clarification or correction documentation", () => {
  const pass = evaluateNeNoncomplianceResponse({ report_indicates_noncompliance: true, nifa_letter_date: "2026-01-01", owner_response_date: "2026-03-02", clarification_or_correction_documentation_present: true });
  assert.equal(pass.finding, "PASS");
  assert.equal(pass.response_due_date, "2026-03-02");
  assert.equal(evaluateNeNoncomplianceResponse({ report_indicates_noncompliance: true, nifa_letter_date: "2026-01-01", owner_response_date: "2026-03-03", clarification_or_correction_documentation_present: true }).finding, "FAIL");
  assert.equal(evaluateNeNoncomplianceResponse({ report_indicates_noncompliance: false }).response_required, false);
});

test("NE initial compliance and minimum extended-use periods stay active for at least 30 years", () => {
  assert.equal(evaluateNeAffordabilityPeriodBoundary({ year_number_since_credit_period_start: 15 }).phase, "INITIAL_COMPLIANCE_PERIOD");
  assert.equal(evaluateNeAffordabilityPeriodBoundary({ year_number_since_credit_period_start: 16 }).phase, "MINIMUM_EXTENDED_USE_PERIOD");
  assert.equal(evaluateNeAffordabilityPeriodBoundary({ year_number_since_credit_period_start: 30 }).minimum_restriction_active, true);
});

test("NE does not assume affordability ends after year 30 without the verified LURA", () => {
  assert.equal(evaluateNeAffordabilityPeriodBoundary({ year_number_since_credit_period_start: 31 }).finding, "UNABLE_TO_DETERMINE");
  assert.equal(evaluateNeAffordabilityPeriodBoundary({ year_number_since_credit_period_start: 31, verified_lura_total_affordability_years: 35 }).minimum_restriction_active, true);
  assert.equal(evaluateNeAffordabilityPeriodBoundary({ year_number_since_credit_period_start: 36, verified_lura_total_affordability_years: 35 }).minimum_restriction_active, false);
});

test("NE qualified-contract decontrol certification plus rent roll is due January 31", () => {
  assert.equal(evaluateNeQualifiedContractDecontrolCertification({ qualified_contract_decontrol_period_active: false }).required_by_this_rule, false);
  assert.equal(evaluateNeQualifiedContractDecontrolCertification({ qualified_contract_decontrol_period_active: true, reporting_year: 2025, submission_date: "2026-01-31", owner_certification_complete: true, current_rent_roll_attached: true }).finding, "PASS");
  assert.equal(evaluateNeQualifiedContractDecontrolCertification({ qualified_contract_decontrol_period_active: true, reporting_year: 2025, submission_date: "2026-02-01", owner_certification_complete: true, current_rent_roll_attached: true }).finding, "FAIL");
});

test("NE release remains blocked until exact source identities and property gates are complete", () => {
  const result = neLihtcReleaseEligibility({ current_compliance_manual_and_forms_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
