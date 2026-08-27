import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateScAnnualRecertification,
  evaluateScRecertificationWaiver,
  evaluateScOverIncomeRule,
  evaluateScUtilityAllowanceChange,
  scLihtcReleaseEligibility,
} from "../src/lib/sc-lihtc-compliance-rule-pack.mjs";

test("SC annual recertification passes at 365 days and fails after", () => {
  assert.equal(evaluateScAnnualRecertification({ previous_certification_date: "2025-01-01", current_certification_date: "2026-01-01" }).finding, "PASS");
  assert.equal(evaluateScAnnualRecertification({ previous_certification_date: "2025-01-01", current_certification_date: "2026-01-02" }).finding, "FAIL");
});

test("SC annual recertification fails closed without both dates", () => {
  assert.equal(evaluateScAnnualRecertification({ previous_certification_date: "2025-01-01" }).finding, "UNABLE_TO_DETERMINE");
});

test("SC recertification waiver requires 100 percent LIHTC, prior written approval, and income-verification-only scope", () => {
  assert.equal(evaluateScRecertificationWaiver({ development_is_100_percent_lihtc: true, sc_housing_written_approval: true, waiver_used_for_income_verification_only: true }).finding, "PASS");
  assert.equal(evaluateScRecertificationWaiver({ development_is_100_percent_lihtc: true, sc_housing_written_approval: false, waiver_used_for_income_verification_only: true }).finding, "FAIL");
});

test("SC over-income rule triggers only when income is greater than 140 percent", () => {
  assert.equal(evaluateScOverIncomeRule({ household_income: 70000, current_applicable_income_limit: 50000 }).next_available_unit_rule_triggered, false);
  assert.equal(evaluateScOverIncomeRule({ household_income: 70001, current_applicable_income_limit: 50000 }).next_available_unit_rule_triggered, true);
});

test("SC utility allowance changes must be reflected within 90 days", () => {
  assert.equal(evaluateScUtilityAllowanceChange({ method: "PHA", change_effective_date: "2026-01-01", gross_rent_recalculated_date: "2026-04-01" }).finding, "PASS");
  assert.equal(evaluateScUtilityAllowanceChange({ method: "PHA", change_effective_date: "2026-01-01", gross_rent_recalculated_date: "2026-04-02" }).finding, "FAIL");
});

test("SC alternative utility methods require written SC Housing approval", () => {
  assert.equal(evaluateScUtilityAllowanceChange({ method: "HUD_UTILITY_SCHEDULE_MODEL", change_effective_date: "2026-01-01", gross_rent_recalculated_date: "2026-02-01", sc_housing_written_approval: false }).finding, "FAIL");
});

test("SC release stays blocked until exact compliance-manual hash is registered", () => {
  const result = scLihtcReleaseEligibility({ content_validation_complete: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_manual_sha256_not_registered"));
  assert.equal(result.qap_allocation_rules_included, false);
});
