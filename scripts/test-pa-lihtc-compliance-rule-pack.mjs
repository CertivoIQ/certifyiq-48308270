import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePaGrossRent,
  evaluatePaUtilityAllowanceAuthority,
  evaluatePaMinimumSetAsideElection,
  evaluatePaAnnualRecertificationFile,
  paLihtcReleaseEligibility,
} from "../src/lib/pa-lihtc-compliance-rule-pack.mjs";

test("PA gross rent includes tenant-paid utility allowance", () => {
  assert.equal(evaluatePaGrossRent({ monthly_contract_rent: 900, tenant_paid_utility_allowance: 100, maximum_lihtc_gross_rent: 1000 }).finding, "PASS");
  assert.equal(evaluatePaGrossRent({ monthly_contract_rent: 901, tenant_paid_utility_allowance: 100, maximum_lihtc_gross_rent: 1000 }).finding, "FAIL");
});

test("PA HUD and RHS buildings use the corresponding approved utility allowance", () => {
  assert.equal(evaluatePaUtilityAllowanceAuthority({ building_assistance_type: "HUD_PROJECT_BASED", utility_allowance_method: "HUD" }).finding, "PASS");
  assert.equal(evaluatePaUtilityAllowanceAuthority({ building_assistance_type: "HUD_PROJECT_BASED", utility_allowance_method: "PHA" }).finding, "FAIL");
  assert.equal(evaluatePaUtilityAllowanceAuthority({ building_assistance_type: "RHS_PROJECT_OR_TENANT_BASED", utility_allowance_method: "RHS" }).finding, "PASS");
});

test("PA minimum set-aside election cannot be changed after placed in service", () => {
  assert.equal(evaluatePaMinimumSetAsideElection({ form_8609_election: "40_60", proposed_election: "40_60" }).finding, "PASS");
  assert.equal(evaluatePaMinimumSetAsideElection({ form_8609_election: "40_60", proposed_election: "20_50" }).finding, "FAIL");
});

test("PA annual recertification file requires TIC income asset and student review", () => {
  assert.equal(evaluatePaAnnualRecertificationFile({ tenant_income_certification_present: true, income_verification_present: true, asset_verification_present: true, student_status_reviewed: true }).finding, "PASS");
  assert.equal(evaluatePaAnnualRecertificationFile({ tenant_income_certification_present: true, income_verification_present: true, asset_verification_present: false, student_status_reviewed: true }).finding, "FAIL");
});

test("PA release remains blocked until current source identities and reconciliation are complete", () => {
  const result = paLihtcReleaseEligibility({ current_manual_and_qap_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
