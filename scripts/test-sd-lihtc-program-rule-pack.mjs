import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSdMinimumSetAside,
  evaluateSdIncomeAveragingAvailability,
  evaluateSdGrossRentCap,
  evaluateSd2026UtilityAllowanceMethod,
  evaluateSdExtendedUseCommitment,
  sdLihtcReleaseEligibility,
} from "../src/lib/sd-lihtc-program-rule-pack.mjs";

test("SD minimum set-aside supports 20/50 and 40/60", () => {
  assert.equal(evaluateSdMinimumSetAside({ election: "20_50", total_units: 100, qualifying_units: 20 }).finding, "PASS");
  assert.equal(evaluateSdMinimumSetAside({ election: "40_60", total_units: 100, qualifying_units: 39 }).finding, "FAIL");
});

test("SD income averaging is available only for developments placed in service after August 1 2018", () => {
  assert.equal(evaluateSdIncomeAveragingAvailability({ placed_in_service_date: "2018-08-01" }).income_averaging_available, false);
  assert.equal(evaluateSdIncomeAveragingAvailability({ placed_in_service_date: "2018-08-02" }).income_averaging_available, true);
});

test("SD gross rent cannot exceed 30 percent of qualifying monthly income", () => {
  assert.equal(evaluateSdGrossRentCap({ gross_rent: 900, qualifying_monthly_income: 3000 }).finding, "PASS");
  assert.equal(evaluateSdGrossRentCap({ gross_rent: 901, qualifying_monthly_income: 3000 }).finding, "FAIL");
});

test("SD 2026 utility allowance method rejects local PHA calculations", () => {
  assert.equal(evaluateSd2026UtilityAllowanceMethod({ method: "LOCAL_PHA" }).finding, "FAIL");
  assert.equal(evaluateSd2026UtilityAllowanceMethod({ method: "HUD_UTILITY_SCHEDULE_MODEL" }).finding, "PASS");
  assert.equal(evaluateSd2026UtilityAllowanceMethod({ method: "SD_HOUSING_WORKSHEET" }).finding, "PASS");
});

test("SD extended use requires at least 15 additional years after initial 15-year compliance period", () => {
  assert.equal(evaluateSdExtendedUseCommitment({ initial_compliance_years: 15, additional_affordability_years: 15 }).finding, "PASS");
  assert.equal(evaluateSdExtendedUseCommitment({ initial_compliance_years: 15, additional_affordability_years: 14 }).finding, "FAIL");
});

test("SD release remains blocked until exact binary identities are registered", () => {
  const result = sdLihtcReleaseEligibility({ content_validation_complete: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
