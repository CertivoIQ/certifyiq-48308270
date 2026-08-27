import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRiNonSection8RentIncrease,
  evaluateRiTenantDataReporting,
  evaluateRiAverageIncomeEligibility,
  evaluateRiAitDocumentation,
  riLihtcReleaseEligibility,
} from "../src/lib/ri-lihtc-compliance-rule-pack.mjs";

test("RI non-Section 8 rent increases are capped at 5 percent every 12 months", () => {
  assert.equal(evaluateRiNonSection8RentIncrease({ has_section8_project_based_assistance: false, current_rent: 1000, proposed_rent: 1050, months_since_last_increase: 12 }).finding, "PASS");
  assert.equal(evaluateRiNonSection8RentIncrease({ has_section8_project_based_assistance: false, current_rent: 1000, proposed_rent: 1051, months_since_last_increase: 12 }).finding, "FAIL");
  assert.equal(evaluateRiNonSection8RentIncrease({ has_section8_project_based_assistance: false, current_rent: 1000, proposed_rent: 1040, months_since_last_increase: 11 }).finding, "FAIL");
});

test("RI LIHTC HOME and ancillary tenant data must be reported in Procorem", () => {
  assert.equal(evaluateRiTenantDataReporting({ receives_lihtc_home_or_ancillary_funding: true, reported_in_procorem: true }).finding, "PASS");
  assert.equal(evaluateRiTenantDataReporting({ receives_lihtc_home_or_ancillary_funding: true, reported_in_procorem: false }).finding, "FAIL");
});

test("RI AIT policy is limited to 100 percent LIHTC projects before Form 8609 execution", () => {
  assert.equal(evaluateRiAverageIncomeEligibility({ project_is_100_percent_lihtc: false, form_8609_executed: false, total_units: 100, qualified_ait_units: 40, qualified_ait_designation_sum: 2400 }).finding, "FAIL");
  assert.equal(evaluateRiAverageIncomeEligibility({ project_is_100_percent_lihtc: true, form_8609_executed: true, total_units: 100, qualified_ait_units: 40, qualified_ait_designation_sum: 2400 }).finding, "FAIL");
});

test("RI AIT requires at least 40 percent qualified units averaging no more than 60 percent AMI", () => {
  assert.equal(evaluateRiAverageIncomeEligibility({ project_is_100_percent_lihtc: true, form_8609_executed: false, total_units: 100, qualified_ait_units: 40, qualified_ait_designation_sum: 2400 }).finding, "PASS");
  assert.equal(evaluateRiAverageIncomeEligibility({ project_is_100_percent_lihtc: true, form_8609_executed: false, total_units: 100, qualified_ait_units: 39, qualified_ait_designation_sum: 2340 }).finding, "FAIL");
  assert.equal(evaluateRiAverageIncomeEligibility({ project_is_100_percent_lihtc: true, form_8609_executed: false, total_units: 100, qualified_ait_units: 40, qualified_ait_designation_sum: 2420 }).finding, "FAIL");
});

test("RI AIT election and unit designations must be documented and reported", () => {
  assert.equal(evaluateRiAitDocumentation({ management_plan_documents_ait: true, tenant_selection_plan_documents_ait: true, unit_designations_reported_to_rihousing: true }).finding, "PASS");
  assert.equal(evaluateRiAitDocumentation({ management_plan_documents_ait: true, tenant_selection_plan_documents_ait: false, unit_designations_reported_to_rihousing: true }).finding, "FAIL");
});

test("RI release remains blocked until exact binary identities are registered", () => {
  const result = riLihtcReleaseEligibility({ content_validation_complete: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
