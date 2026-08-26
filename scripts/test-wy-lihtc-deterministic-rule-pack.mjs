import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWyMinimumSetAside,
  evaluateWyAvailableUnit140,
  evaluateWyStudentStatus,
  evaluateWyRecertification,
  wyLihtcReleaseEligibility,
} from "../src/lib/wy-lihtc-deterministic-rule-pack.mjs";

test("Wyoming accepts only its three current minimum set-aside elections", () => {
  for (const election of ["20/50", "40/60", "AIT"]) {
    assert.equal(evaluateWyMinimumSetAside({ form8609_verified: true, minimum_set_aside: election, minimum_set_aside_met: true }).finding, "PASS");
  }
  assert.equal(evaluateWyMinimumSetAside({ form8609_verified: true, minimum_set_aside: "NYC-25/60", minimum_set_aside_met: true }).finding, "UNABLE_TO_DETERMINE");
});

test("140 percent threshold is strict greater-than and uses the next comparable or smaller unit in the building", () => {
  const boundary = evaluateWyAvailableUnit140({ household_income: 70000, current_applicable_income_limit: 50000, unit_rent_restricted: true, next_comparable_or_smaller_unit_available: true, next_comparable_or_smaller_unit_rented_to_qualified_household: false });
  assert.equal(boundary.finding, "PASS");
  assert.equal(boundary.over_income, false);

  const fail = evaluateWyAvailableUnit140({ household_income: 70001, current_applicable_income_limit: 50000, unit_rent_restricted: true, next_comparable_or_smaller_unit_available: true, next_comparable_or_smaller_unit_rented_to_qualified_household: false });
  assert.equal(fail.finding, "FAIL");

  const pass = evaluateWyAvailableUnit140({ household_income: 70001, current_applicable_income_limit: 50000, unit_rent_restricted: true, next_comparable_or_smaller_unit_available: true, next_comparable_or_smaller_unit_rented_to_qualified_household: true });
  assert.equal(pass.finding, "PASS");
});

test("annual student verification is required and full-time-student households need a verified exception", () => {
  assert.equal(evaluateWyStudentStatus({ all_household_members_full_time_students: false, annual_student_status_verified: false }).finding, "FAIL");
  assert.equal(evaluateWyStudentStatus({ all_household_members_full_time_students: true, annual_student_status_verified: true, student_exception_verified: false }).finding, "FAIL");
  assert.equal(evaluateWyStudentStatus({ all_household_members_full_time_students: true, annual_student_status_verified: true, student_exception_verified: true }).finding, "PASS");
});

test("100 percent LIHTC properties may self-certify after initial qualification but mixed projects retain full annual third-party recertification", () => {
  const allLihtc = evaluateWyRecertification({ initial_certification_completed: true, project_is_100_percent_lihtc: true, self_certification_completed: true, annual_student_status_verified: true });
  assert.equal(allLihtc.finding, "PASS");
  assert.equal(allLihtc.required_method, "SELF_CERTIFICATION_ALLOWED_AFTER_INITIAL");

  const mixedFail = evaluateWyRecertification({ initial_certification_completed: true, project_is_100_percent_lihtc: false, self_certification_completed: true, annual_student_status_verified: true, full_third_party_recertification_completed: false });
  assert.equal(mixedFail.finding, "FAIL");
  assert.equal(mixedFail.required_method, "FULL_THIRD_PARTY_ANNUAL_RECERTIFICATION");

  const mixedPass = evaluateWyRecertification({ initial_certification_completed: true, project_is_100_percent_lihtc: false, annual_student_status_verified: true, full_third_party_recertification_completed: true });
  assert.equal(mixedPass.finding, "PASS");
});

test("release is bound to current 2026 sources and excludes prospective/third-party figure authority", () => {
  const result = wyLihtcReleaseEligibility({
    compliance_manual_sha256: "adccb3dfd15b31d8b7876e57b5c224de9abd087176f67e4c8d0e1b881af58311",
    allocation_plan_sha256: "b56fc8109700bf76ee8b2e75773fa7b50a959b1e23e00bdcb624e718a78e69b1",
    content_validation_complete: true,
    fixture_suite_passed: true,
    two_person_approval_attested: true,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.prospective_2027_sources_included, false);
  assert.equal(result.third_party_limit_calculator_is_rule_authority, false);
  assert.equal(result.property_figure_verification_required, true);
});
