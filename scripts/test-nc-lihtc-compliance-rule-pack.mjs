import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateNcRcrsReporting,
  evaluateNcAnnualOwnerCertification,
  evaluateNcFullTimeStudentHousehold,
  evaluateNcMixedIncome140PercentRule,
  evaluateNc2026ProjectSpecificLimits,
  ncLihtcReleaseEligibility,
} from "../src/lib/nc-lihtc-compliance-rule-pack.mjs";

test("NC RCRS unit events are reported within 30 days", () => {
  assert.equal(evaluateNcRcrsReporting({ unit_event_date: "2026-01-01", reported_date: "2026-01-31" }).finding, "PASS");
  assert.equal(evaluateNcRcrsReporting({ unit_event_date: "2026-01-01", reported_date: "2026-02-01" }).finding, "FAIL");
});

test("NC annual owner certification is required", () => {
  assert.equal(evaluateNcAnnualOwnerCertification({ owner_certification_completed: true }).finding, "PASS");
  assert.equal(evaluateNcAnnualOwnerCertification({ owner_certification_completed: false }).finding, "FAIL");
});

test("NC full-time student households require a valid Section 42 exception", () => {
  assert.equal(evaluateNcFullTimeStudentHousehold({ household_entirely_full_time_students: false }).finding, "PASS");
  assert.equal(evaluateNcFullTimeStudentHousehold({ household_entirely_full_time_students: true, valid_section42_student_exception: false }).finding, "FAIL");
  assert.equal(evaluateNcFullTimeStudentHousehold({ household_entirely_full_time_students: true, valid_section42_student_exception: true }).finding, "PASS");
});

test("NC mixed-income 140 percent trigger is strict greater-than", () => {
  assert.equal(evaluateNcMixedIncome140PercentRule({ mixed_income_property: true, household_income: 70000, current_applicable_income_limit: 50000 }).next_available_unit_rule_triggered, false);
  assert.equal(evaluateNcMixedIncome140PercentRule({ mixed_income_property: true, household_income: 70001, current_applicable_income_limit: 50000 }).next_available_unit_rule_triggered, true);
});

test("NC 2026 project-specific limits are effective May 1 2026", () => {
  assert.equal(evaluateNc2026ProjectSpecificLimits({ event_date: "2026-04-30", limit_dataset_effective_date: "2025-04-01", limit_source: "RCRS_PROJECT_SPECIFIC" }).finding, "PASS");
  assert.equal(evaluateNc2026ProjectSpecificLimits({ event_date: "2026-05-01", limit_dataset_effective_date: "2025-04-01", limit_source: "RCRS_PROJECT_SPECIFIC" }).finding, "FAIL");
  assert.equal(evaluateNc2026ProjectSpecificLimits({ event_date: "2026-05-01", limit_dataset_effective_date: "2026-05-01", limit_source: "RCRS_PROJECT_SPECIFIC" }).finding, "PASS");
});

test("NC release remains blocked until exact source identities are registered", () => {
  const result = ncLihtcReleaseEligibility({ current_2026_qap_manual_and_updates_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
