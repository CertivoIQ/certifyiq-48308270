import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateNhAnnualHdsSubmission,
  evaluateNhAnnualOwnerCertification,
  evaluateNhAnnualRecertificationRequirement,
  evaluateNhInitialTicTiming,
  nhLihtcReleaseEligibility,
} from "../src/lib/nh-lihtc-compliance-rule-pack.mjs";

test("NH completed calendar-year HDS data is due March 1 of the following year", () => {
  assert.equal(evaluateNhAnnualHdsSubmission({ reporting_year: 2025, submission_date: "2026-03-01", calendar_year_data_complete: true }).finding, "PASS");
  assert.equal(evaluateNhAnnualHdsSubmission({ reporting_year: 2025, submission_date: "2026-03-02", calendar_year_data_complete: true }).finding, "FAIL");
  assert.equal(evaluateNhAnnualHdsSubmission({ reporting_year: 2025, submission_date: "2026-03-01", calendar_year_data_complete: false }).finding, "FAIL");
});

test("NH annual owner and management training certifications are due March 1", () => {
  assert.equal(evaluateNhAnnualOwnerCertification({ reporting_year: 2025, submission_date: "2026-03-01", owner_certification_complete: true, management_training_certification_complete: true }).finding, "PASS");
  assert.equal(evaluateNhAnnualOwnerCertification({ reporting_year: 2025, submission_date: "2026-03-01", owner_certification_complete: true, management_training_certification_complete: false }).finding, "FAIL");
});

test("NH mixed-income low-income households require annual recertification", () => {
  assert.equal(evaluateNhAnnualRecertificationRequirement({ project_type: "MIXED_INCOME", annual_income_recertification_complete: true }).finding, "PASS");
  assert.equal(evaluateNhAnnualRecertificationRequirement({ project_type: "MIXED_INCOME", annual_income_recertification_complete: false }).finding, "FAIL");
});

test("NH 100 percent LIHTC income-recertification exemption requires verified project scope and preserves annual student and household certifications", () => {
  const blocked = evaluateNhAnnualRecertificationRequirement({ project_type: "ONE_HUNDRED_PERCENT_LOW_INCOME", form8609_project_scope_verified: false, all_units_in_compliance: true, annual_student_status_complete: true, annual_household_composition_complete: true });
  assert.equal(blocked.finding, "UNABLE_TO_DETERMINE");
  const pass = evaluateNhAnnualRecertificationRequirement({ project_type: "ONE_HUNDRED_PERCENT_LOW_INCOME", form8609_project_scope_verified: true, all_units_in_compliance: true, annual_student_status_complete: true, annual_household_composition_complete: true });
  assert.equal(pass.finding, "PASS");
  assert.equal(pass.annual_income_recertification_required, false);
  assert.equal(evaluateNhAnnualRecertificationRequirement({ project_type: "ONE_HUNDRED_PERCENT_LOW_INCOME", form8609_project_scope_verified: true, all_units_in_compliance: true, annual_student_status_complete: false, annual_household_composition_complete: true }).finding, "FAIL");
});

test("NH initial TIC signatures are due by effective date except the acquisition rehab existing-household 120-day rule", () => {
  assert.equal(evaluateNhInitialTicTiming({ effective_date: "2026-01-01", last_required_signature_date: "2026-01-01", acquisition_rehab_existing_household: false }).finding, "PASS");
  assert.equal(evaluateNhInitialTicTiming({ effective_date: "2026-01-01", last_required_signature_date: "2026-01-02", acquisition_rehab_existing_household: false }).finding, "FAIL");
  assert.equal(evaluateNhInitialTicTiming({ effective_date: "2026-01-01", last_required_signature_date: "2026-05-01", acquisition_rehab_existing_household: true }).finding, "PASS");
  assert.equal(evaluateNhInitialTicTiming({ effective_date: "2026-01-01", last_required_signature_date: "2026-05-02", acquisition_rehab_existing_household: true }).finding, "FAIL");
});

test("NH release remains blocked until exact source identities and property gates are complete", () => {
  const result = nhLihtcReleaseEligibility({ current_qap_and_compliance_sources_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
