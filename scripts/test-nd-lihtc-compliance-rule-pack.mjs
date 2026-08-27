import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateNdUtilityAllowanceAnnualReview,
  evaluateNdUtilityAllowanceMethodChange,
  evaluateNdUtilityAllowanceImplementation,
  evaluateNdLimitSelectionBoundary,
  ndLihtcReleaseEligibility,
} from "../src/lib/nd-lihtc-compliance-rule-pack.mjs";

test("ND utility allowances are reviewed at least once each calendar year", () => {
  assert.equal(evaluateNdUtilityAllowanceAnnualReview({ calendar_year: 2026, review_date: "2026-12-31" }).finding, "PASS");
  assert.equal(evaluateNdUtilityAllowanceAnnualReview({ calendar_year: 2026, review_date: "2025-12-31" }).finding, "FAIL");
});

test("ND utility allowance method changes require notice and Energy Consumption Model pre-use review", () => {
  assert.equal(evaluateNdUtilityAllowanceMethodChange({ method_changed: false }).finding, "PASS");
  assert.equal(evaluateNdUtilityAllowanceMethodChange({ method_changed: true, new_method: "PHA_ESTIMATE", ndhfa_notified: false }).finding, "FAIL");
  assert.equal(evaluateNdUtilityAllowanceMethodChange({ method_changed: true, new_method: "ENERGY_CONSUMPTION_MODEL", ndhfa_notified: true, ndhfa_preuse_review_complete: false }).finding, "FAIL");
  assert.equal(evaluateNdUtilityAllowanceMethodChange({ method_changed: true, new_method: "ENERGY_CONSUMPTION_MODEL", ndhfa_notified: true, ndhfa_preuse_review_complete: true }).finding, "PASS");
});

test("NDHFA Agency Estimate utility allowance method is currently unavailable", () => {
  const result = evaluateNdUtilityAllowanceMethodChange({ method_changed: true, new_method: "AGENCY_ESTIMATE", ndhfa_notified: true });
  assert.equal(result.finding, "FAIL");
  assert.equal(result.reason, "NDHFA_AGENCY_ESTIMATE_NOT_CURRENTLY_AVAILABLE");
});

test("ND changed utility allowance is implemented immediately after the 90-day period", () => {
  assert.equal(evaluateNdUtilityAllowanceImplementation({ allowance_effective_date: "2026-01-01", implemented_date: "2026-04-01" }).finding, "PASS");
  assert.equal(evaluateNdUtilityAllowanceImplementation({ allowance_effective_date: "2026-01-01", implemented_date: "2026-03-31" }).finding, "FAIL");
});

test("ND limit selection never substitutes current-year limits for required property history", () => {
  const modern = evaluateNdLimitSelectionBoundary({ placed_in_service_date: "2018-06-01", event_date: "2026-05-01" });
  assert.equal(modern.finding, "UNABLE_TO_DETERMINE");
  assert.match(modern.reason, /HISTORICAL_HIGHEST_MTSP/);
  const hera = evaluateNdLimitSelectionBoundary({ placed_in_service_date: "2008-12-31", event_date: "2026-05-01" });
  assert.equal(hera.finding, "UNABLE_TO_DETERMINE");
  assert.match(hera.reason, /HERA_SPECIAL/);
});

test("ND release remains blocked until exact source identities and property gates are complete", () => {
  const result = ndLihtcReleaseEligibility({ current_manual_and_allocation_cycle_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
