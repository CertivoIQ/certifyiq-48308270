import assert from "node:assert/strict";
import test from "node:test";
import {
  VT_LIHTC_AIT_SOURCE,
  evaluateVtNinePercentAitEligibility,
  evaluateVtResyndicationAitEligibility,
  evaluateVtBondAitLayering,
  vtLihtcAitReleaseEligibility,
} from "../src/lib/vt-lihtc-ait-rule-pack.mjs";

test("VT 9% AIT eligibility accepts allocations on or after 2020-01-01", () => {
  const result = evaluateVtNinePercentAitEligibility({ credit_type: "9_PERCENT", allocation_date: "2026-05-15", average_income_election_requested: true });
  assert.equal(result.finding, "PASS");
});

test("VT 9% AIT eligibility rejects pre-2020 allocation", () => {
  const result = evaluateVtNinePercentAitEligibility({ credit_type: "9_PERCENT", allocation_date: "2019-12-31", average_income_election_requested: true });
  assert.equal(result.finding, "FAIL");
});

test("VT resyndicated covenanted existing property is not AIT eligible", () => {
  const result = evaluateVtResyndicationAitEligibility({
    average_income_election_requested: true,
    existing_tax_credit_property: true,
    resyndication: true,
    recorded_housing_credit_housing_subsidy_covenant: true,
  });
  assert.equal(result.finding, "FAIL");
});

test("VT 4% bond AIT requires a separate 20/50 or 40/60 bond election", () => {
  const result = evaluateVtBondAitLayering({ credit_type: "4_PERCENT_BOND", average_income_election_requested: true, bond_minimum_set_aside: "AIT" });
  assert.equal(result.finding, "FAIL");
});

test("VT AIT release eligibility is bound to exact policy bytes and external attestation", () => {
  const result = vtLihtcAitReleaseEligibility({
    ait_policy_sha256: VT_LIHTC_AIT_SOURCE.sha256,
    content_validation_complete: true,
    fixture_suite_passed: true,
    two_person_approval_attested: true,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.scope, "AVERAGE_INCOME_TEST_ONLY");
  assert.equal(result.prospective_qap_included, false);
});
