import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWvMinimumSetAside,
  evaluateWvNextAvailableUnit140,
  evaluateWvAnnualRecertification,
  wvLihtcReleaseEligibility,
} from "../src/lib/wv-lihtc-deterministic-rule-pack.mjs";

test("minimum set-aside follows verified Form 8609 election", () => {
  assert.equal(evaluateWvMinimumSetAside({ form8609_verified: true, minimum_set_aside: "20/50", initial_compliance_deadline_met: true }).finding, "PASS");
  assert.equal(evaluateWvMinimumSetAside({ form8609_verified: true, minimum_set_aside: "40/60", initial_compliance_deadline_met: false }).finding, "FAIL");
  assert.equal(evaluateWvMinimumSetAside({ minimum_set_aside: "40/60" }).finding, "UNABLE_TO_DETERMINE");
});

test("140 percent boundary is not over-income; greater than boundary activates next-available-unit rule", () => {
  const boundary = evaluateWvNextAvailableUnit140({ household_income: 70000, current_applicable_income_limit: 50000, unit_rent_restricted: true, next_comparable_unit_available: true, next_comparable_unit_rented_to_qualified_household: false });
  assert.equal(boundary.finding, "PASS");
  assert.equal(boundary.over_income, false);

  const fail = evaluateWvNextAvailableUnit140({ household_income: 70001, current_applicable_income_limit: 50000, unit_rent_restricted: true, next_comparable_unit_available: true, next_comparable_unit_rented_to_qualified_household: false });
  assert.equal(fail.finding, "FAIL");
  assert.equal(fail.over_income, true);

  const pass = evaluateWvNextAvailableUnit140({ household_income: 70001, current_applicable_income_limit: 50000, unit_rent_restricted: true, next_comparable_unit_available: true, next_comparable_unit_rented_to_qualified_household: true });
  assert.equal(pass.finding, "PASS");
});

test("140 percent rule fails if an over-income unit stops being rent restricted", () => {
  const result = evaluateWvNextAvailableUnit140({ household_income: 80000, current_applicable_income_limit: 50000, unit_rent_restricted: false, next_comparable_unit_available: false });
  assert.equal(result.finding, "FAIL");
  assert.equal(result.reason, "OVER_INCOME_UNIT_NOT_RENT_RESTRICTED");
});

test("waiver cannot replace the first full annual recertification", () => {
  const result = evaluateWvAnnualRecertification({ residency_year: 2, initial_certification_completed: true, waiver_active: true, self_certification_completed: true, full_annual_recertification_completed: false });
  assert.equal(result.finding, "FAIL");
  assert.equal(result.required_method, "FULL_ANNUAL_RECERTIFICATION");
});

test("year three waiver path requires self-certification plus student, composition, and 140 percent reviews", () => {
  const pass = evaluateWvAnnualRecertification({ residency_year: 3, initial_certification_completed: true, waiver_active: true, self_certification_completed: true, student_status_reviewed: true, household_composition_reviewed: true, rule_140_reviewed: true });
  assert.equal(pass.finding, "PASS");
  const fail = evaluateWvAnnualRecertification({ residency_year: 3, initial_certification_completed: true, waiver_active: true, self_certification_completed: true, student_status_reviewed: true, household_composition_reviewed: true, rule_140_reviewed: false });
  assert.equal(fail.finding, "FAIL");
});

test("WV LIHTC release binds exact official index identity and keeps property figures separate", () => {
  const result = wvLihtcReleaseEligibility({ official_index_sha256: "4ab159460dc302f6d255bb12520a0fd1ed44bad3b7aa4798d0725071c23c9973", content_validation_complete: true, fixture_suite_passed: true, two_person_approval_attested: true });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.property_figure_verification_required, true);
  assert.equal(result.home_htf_included, false);
});
