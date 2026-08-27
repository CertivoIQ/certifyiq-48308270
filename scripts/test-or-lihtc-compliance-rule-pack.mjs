import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOrMinimumSetAside,
  evaluateOrAnnualHouseholdReporting,
  evaluateOr2026LimitImplementation,
  orLihtcReleaseEligibility,
} from "../src/lib/or-lihtc-compliance-rule-pack.mjs";

test("OR minimum set-aside supports 20/50 and 40/60", () => {
  assert.equal(evaluateOrMinimumSetAside({ election: "20_50", total_units: 100, qualifying_units: 20 }).finding, "PASS");
  assert.equal(evaluateOrMinimumSetAside({ election: "40_60", total_units: 100, qualifying_units: 39 }).finding, "FAIL");
});

test("OR annual household data reporting is required", () => {
  assert.equal(evaluateOrAnnualHouseholdReporting({ household_data_sheet_submitted: true }).finding, "PASS");
  assert.equal(evaluateOrAnnualHouseholdReporting({ household_data_sheet_submitted: false }).finding, "FAIL");
});

test("OR 2026 MTSP limits must be implemented by June 14 2026", () => {
  assert.equal(evaluateOr2026LimitImplementation({ certification_or_rent_event_date: "2026-06-13", limit_dataset_effective_date: "2025-04-01" }).finding, "PASS");
  assert.equal(evaluateOr2026LimitImplementation({ certification_or_rent_event_date: "2026-06-14", limit_dataset_effective_date: "2025-04-01" }).finding, "FAIL");
  assert.equal(evaluateOr2026LimitImplementation({ certification_or_rent_event_date: "2026-06-14", limit_dataset_effective_date: "2026-05-01" }).finding, "PASS");
});

test("OR release remains blocked until exact source identities are registered", () => {
  const result = orLihtcReleaseEligibility({ current_manual_and_advisories_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
