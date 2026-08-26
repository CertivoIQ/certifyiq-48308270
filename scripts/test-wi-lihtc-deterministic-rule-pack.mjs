import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWiMinimumSetAside,
  evaluateWiAnnualRecertification,
  evaluateWiAvailableUnitRule,
  evaluateWiAnnualRentIncrease,
  wiLihtcReleaseEligibility,
} from "../src/lib/wi-lihtc-deterministic-rule-pack.mjs";

test("Wisconsin AIT is restricted to 100 percent low-income projects", () => {
  assert.equal(evaluateWiMinimumSetAside({ form8609_verified: true, minimum_set_aside: "AIT", project_is_100_percent_low_income: false, minimum_set_aside_met: true }).finding, "FAIL");
  assert.equal(evaluateWiMinimumSetAside({ form8609_verified: true, minimum_set_aside: "AIT", project_is_100_percent_low_income: true, minimum_set_aside_met: true }).finding, "PASS");
  assert.equal(evaluateWiMinimumSetAside({ form8609_verified: true, minimum_set_aside: "20/50", minimum_set_aside_met: true }).finding, "PASS");
});

test("100 percent projects retain annual student and household composition certification but are exempt from annual income recertification", () => {
  const pass = evaluateWiAnnualRecertification({ initial_certification_completed: true, project_is_100_percent_low_income: true, annual_student_status_certified: true, annual_household_composition_certified: true });
  assert.equal(pass.finding, "PASS");
  assert.equal(pass.income_recertification_required, false);
  const fail = evaluateWiAnnualRecertification({ initial_certification_completed: true, project_is_100_percent_low_income: true, annual_student_status_certified: false, annual_household_composition_certified: true });
  assert.equal(fail.finding, "FAIL");
});

test("mixed projects must complete annual income recertification within 365 days", () => {
  assert.equal(evaluateWiAnnualRecertification({ initial_certification_completed: true, project_is_100_percent_low_income: false, annual_student_status_certified: true, annual_household_composition_certified: true, days_since_last_certification: 365, full_income_recertification_completed: true }).finding, "PASS");
  assert.equal(evaluateWiAnnualRecertification({ initial_certification_completed: true, project_is_100_percent_low_income: false, annual_student_status_certified: true, annual_household_composition_certified: true, days_since_last_certification: 366, full_income_recertification_completed: true }).finding, "FAIL");
});

test("Wisconsin AUR activates only above 140 percent when the building is at or below its applicable fraction", () => {
  const boundary = evaluateWiAvailableUnitRule({ household_income: 70000, current_maximum_income: 50000, building_at_or_below_applicable_fraction: true, unit_rent_restricted: true, next_comparable_or_smaller_unit_available: true, next_comparable_or_smaller_unit_rented_to_qualified_household: false });
  assert.equal(boundary.finding, "PASS");
  assert.equal(boundary.aur_active, false);
  const fail = evaluateWiAvailableUnitRule({ household_income: 70001, current_maximum_income: 50000, building_at_or_below_applicable_fraction: true, unit_rent_restricted: true, next_comparable_or_smaller_unit_available: true, next_comparable_or_smaller_unit_rented_to_qualified_household: false });
  assert.equal(fail.finding, "FAIL");
});

test("existing-tenant rent increases above five percent require 90-day notice and post-2022 allocations require 120-day WHEDA exception lead time", () => {
  assert.equal(evaluateWiAnnualRentIncrease({ existing_tenant: true, prior_lease_rent_plus_mandatory_fees: 1000, new_lease_rent_plus_mandatory_fees: 1050, allocation_year: 2024, resident_notice_days: 0, wheda_exception_request_lead_days: 0 }).finding, "PASS");
  assert.equal(evaluateWiAnnualRentIncrease({ existing_tenant: true, prior_lease_rent_plus_mandatory_fees: 1000, new_lease_rent_plus_mandatory_fees: 1060, allocation_year: 2024, resident_notice_days: 89, wheda_exception_request_lead_days: 120 }).finding, "FAIL");
  assert.equal(evaluateWiAnnualRentIncrease({ existing_tenant: true, prior_lease_rent_plus_mandatory_fees: 1000, new_lease_rent_plus_mandatory_fees: 1060, allocation_year: 2024, resident_notice_days: 90, wheda_exception_request_lead_days: 119 }).finding, "FAIL");
  assert.equal(evaluateWiAnnualRentIncrease({ existing_tenant: true, prior_lease_rent_plus_mandatory_fees: 1000, new_lease_rent_plus_mandatory_fees: 1060, allocation_year: 2024, resident_notice_days: 90, wheda_exception_request_lead_days: 120 }).finding, "PASS");
});

test("release binds exact August 2026 manual and keeps QAP/property figures out of scope", () => {
  const result = wiLihtcReleaseEligibility({ compliance_manual_sha256: "bf01cc3b61b2862954950d6e400509718b3b03c59a774630250d50970603e28a", content_validation_complete: true, fixture_suite_passed: true, two_person_approval_attested: true });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.qap_allocation_rules_included, false);
  assert.equal(result.property_figure_verification_required, true);
});
