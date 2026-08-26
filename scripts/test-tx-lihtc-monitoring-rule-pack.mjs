import assert from "node:assert/strict";
import test from "node:test";
import {
  TX_LIHTC_SOURCE,
  evaluateTxAocr,
  evaluateTxQuarterlyUsr,
  evaluateTxForm8609Submission,
  txLihtcReleaseEligibility,
} from "../src/lib/tx-lihtc-monitoring-rule-pack.mjs";

test("TX AOCR is first due in the second year after award and by April 30", () => {
  const result = evaluateTxAocr({ award_year: 2024, report_year: 2026, submitted_via_cmts: true, submitted_date: "2026-04-30" });
  assert.equal(result.finding, "PASS");
  assert.equal(result.report_required, true);
});

test("TX AOCR fails when submitted after April 30", () => {
  const result = evaluateTxAocr({ award_year: 2024, report_year: 2026, submitted_via_cmts: true, submitted_date: "2026-05-01" });
  assert.equal(result.finding, "FAIL");
});

test("TX quarterly USR must be submitted by the 10th with prior-month-end occupancy", () => {
  const result = evaluateTxQuarterlyUsr({ leasing_activity_commenced: true, report_due_month: 7, submitted_date: "2026-07-10", occupancy_as_of_date: "2026-06-30", submitted_via_cmts: true });
  assert.equal(result.finding, "PASS");
});

test("TX Form 8609 Part II is required through CMTS by second monitoring review", () => {
  const result = evaluateTxForm8609Submission({ monitoring_review_number: 2, form8609_part_ii_complete: false, submitted_through_cmts: true });
  assert.equal(result.finding, "FAIL");
});

test("TX release eligibility is bound to exact Subchapter F bytes and external attestation", () => {
  const result = txLihtcReleaseEligibility({
    subchapter_f_sha256: TX_LIHTC_SOURCE.sha256,
    content_validation_complete: true,
    fixture_suite_passed: true,
    two_person_approval_attested: true,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.scope, "REPORTING_AND_MONITORING_ONLY");
  assert.equal(result.qap_allocation_rules_included, false);
});
