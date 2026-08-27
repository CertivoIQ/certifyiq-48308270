import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOkAnnualOwnerCertification,
  evaluateOkCertificationPortalReporting,
  evaluateOk2026LimitEffectiveDate,
  okLihtcReleaseEligibility,
} from "../src/lib/ok-lihtc-compliance-rule-pack.mjs";

test("OK 2025 AOC is due February 15 2026 unless site reports quarterly to compliance", () => {
  assert.equal(evaluateOkAnnualOwnerCertification({ reporting_year: 2025, quarterly_reporting_to_compliance: false, aoc_submitted_date: "2026-02-15" }).finding, "PASS");
  assert.equal(evaluateOkAnnualOwnerCertification({ reporting_year: 2025, quarterly_reporting_to_compliance: false, aoc_submitted_date: "2026-02-16" }).finding, "FAIL");
  assert.equal(evaluateOkAnnualOwnerCertification({ reporting_year: 2025, quarterly_reporting_to_compliance: true, aoc_submitted_date: "2026-03-01" }).finding, "PASS");
});

test("OK certification portal report requires unsigned AOC report and all tenant certifications by February 15 2026", () => {
  assert.equal(evaluateOkCertificationPortalReporting({ reporting_year: 2025, unsigned_aoc_report_uploaded: true, all_tenant_certifications_uploaded: true, submission_date: "2026-02-15" }).finding, "PASS");
  assert.equal(evaluateOkCertificationPortalReporting({ reporting_year: 2025, unsigned_aoc_report_uploaded: false, all_tenant_certifications_uploaded: true, submission_date: "2026-02-15" }).finding, "FAIL");
});

test("OK 2026 income and rent limits are effective May 1 2026", () => {
  assert.equal(evaluateOk2026LimitEffectiveDate({ event_date: "2026-04-30", limit_dataset_effective_date: "2025-04-01" }).finding, "PASS");
  assert.equal(evaluateOk2026LimitEffectiveDate({ event_date: "2026-05-01", limit_dataset_effective_date: "2025-04-01" }).finding, "FAIL");
  assert.equal(evaluateOk2026LimitEffectiveDate({ event_date: "2026-05-01", limit_dataset_effective_date: "2026-05-01" }).finding, "PASS");
});

test("OK release remains blocked until exact source identities are registered", () => {
  const result = okLihtcReleaseEligibility({ current_2026_qap_and_compliance_sources_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
