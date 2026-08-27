import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOh2026AnnualOwnerCertification,
  evaluateOhExtendedUseStudentVerification,
  evaluateOhHotmaCertificationDate,
  ohLihtcReleaseEligibility,
} from "../src/lib/oh-lihtc-compliance-rule-pack.mjs";

test("OH 2026 annual owner certification is due March 1", () => {
  assert.equal(evaluateOh2026AnnualOwnerCertification({ submission_date: "2026-03-01" }).finding, "PASS");
  assert.equal(evaluateOh2026AnnualOwnerCertification({ submission_date: "2026-03-02" }).finding, "FAIL");
});

test("OH extended-use student verification applies to new move-ins", () => {
  assert.equal(evaluateOhExtendedUseStudentVerification({ project_in_extended_use_period: true, tenant_is_new_move_in: false, student_status_verified: false }).finding, "PASS");
  assert.equal(evaluateOhExtendedUseStudentVerification({ project_in_extended_use_period: true, tenant_is_new_move_in: true, student_status_verified: false }).finding, "FAIL");
  assert.equal(evaluateOhExtendedUseStudentVerification({ project_in_extended_use_period: true, tenant_is_new_move_in: true, student_status_verified: true }).finding, "PASS");
});

test("OHFA HOTMA method is required for certifications on or after May 1 2025", () => {
  assert.equal(evaluateOhHotmaCertificationDate({ certification_date: "2025-04-30", hotma_method_used: false }).finding, "PASS");
  assert.equal(evaluateOhHotmaCertificationDate({ certification_date: "2025-05-01", hotma_method_used: false }).finding, "FAIL");
  assert.equal(evaluateOhHotmaCertificationDate({ certification_date: "2025-05-01", hotma_method_used: true }).finding, "PASS");
});

test("OH release remains blocked until exact source identities are registered", () => {
  const result = ohLihtcReleaseEligibility({ manual_effective_date_and_current_updates_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
