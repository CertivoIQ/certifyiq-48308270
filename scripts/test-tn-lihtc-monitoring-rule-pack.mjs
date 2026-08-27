import assert from "node:assert/strict";
import test from "node:test";
import {
  TN_LIHTC_SOURCE,
  evaluateTnOwnerAnnualCertification,
  evaluateTnAnnualHouseholdIncomeCertification,
  evaluateTnUtilityAllowanceApproval,
  tnLihtcReleaseEligibility,
} from "../src/lib/tn-lihtc-monitoring-rule-pack.mjs";

test("TN OAC passes when submitted by the THDA-established deadline", () => {
  const result = evaluateTnOwnerAnnualCertification({
    in_lurc_term: true,
    report_year: 2026,
    submitted_date: "2027-03-01",
    thda_deadline: "2027-03-01",
    certified_all_required_items: true,
  });
  assert.equal(result.finding, "PASS");
  assert.equal(result.certification_required, true);
});

test("TN OAC fails when an uncertified item has no detailed explanation", () => {
  const result = evaluateTnOwnerAnnualCertification({
    in_lurc_term: true,
    report_year: 2026,
    submitted_date: "2027-02-15",
    thda_deadline: "2027-03-01",
    certified_all_required_items: false,
    detailed_explanation_provided: false,
  });
  assert.equal(result.finding, "FAIL");
  assert.equal(result.reason, "DETAILED_EXPLANATION_REQUIRED_FOR_UNCERTIFIED_ITEM");
});

test("TN OAC fails closed when THDA deadline is not supplied", () => {
  const result = evaluateTnOwnerAnnualCertification({
    in_lurc_term: true,
    report_year: 2026,
    submitted_date: "2027-02-15",
    certified_all_required_items: true,
  });
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.status, "BLOCKED");
});

test("TN annual household certification is required for low-income households", () => {
  const result = evaluateTnAnnualHouseholdIncomeCertification({
    low_income_household: true,
    certification_year: 2027,
    initial_occupancy_year: 2026,
    annual_income_certification_present: false,
  });
  assert.equal(result.finding, "FAIL");
});

test("TN utility allowance approval fails when applicable approval is absent", () => {
  const result = evaluateTnUtilityAllowanceApproval({ utility_allowance_applies: true, thda_approval_documented: false });
  assert.equal(result.finding, "FAIL");
});

test("TN release remains blocked until all controlled release gates are attested", () => {
  const blocked = tnLihtcReleaseEligibility({ qap_sha256: TN_LIHTC_SOURCE.sha256 });
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.missing.includes("two_person_approval_attested"));
  const validated = tnLihtcReleaseEligibility({
    qap_sha256: TN_LIHTC_SOURCE.sha256,
    compliance_page_current_verified: true,
    content_validation_complete: true,
    fixture_suite_passed: true,
    two_person_approval_attested: true,
    property_figure_verification_ready: true,
  });
  assert.equal(validated.status, "VALIDATED");
  assert.equal(validated.scope, "COMPLIANCE_AND_MONITORING_ONLY");
  assert.equal(validated.qap_allocation_scoring_included, false);
});
