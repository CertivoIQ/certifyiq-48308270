import assert from "node:assert/strict";
import test from "node:test";
import {
  getMoSeasonalReportingSchedule,
  evaluateMoAnnualReporting,
  evaluateMoForm8609PartII,
  evaluateMoExhibitURecertificationBoundary,
  moLihtcReleaseEligibility,
} from "../src/lib/mo-lihtc-compliance-rule-pack.mjs";

test("MO seasonal reporting schedule follows the last-building placed-in-service year", () => {
  assert.equal(getMoSeasonalReportingSchedule({ last_building_placed_in_service_year: 2026 }).portal_due_month_day, "04-15");
  assert.equal(getMoSeasonalReportingSchedule({ last_building_placed_in_service_year: 2027 }).portal_due_month_day, "07-15");
  assert.equal(getMoSeasonalReportingSchedule({ last_building_placed_in_service_year: 2028 }).portal_due_month_day, "10-15");
  assert.equal(getMoSeasonalReportingSchedule({ last_building_placed_in_service_year: 2029 }).portal_due_month_day, "01-15");
  assert.equal(getMoSeasonalReportingSchedule({ last_building_placed_in_service_year: 1992 }).owner_cert_due_month_day, "04-30");
});

test("MO annual portal report and signed owner certification use the seasonal deadlines", () => {
  assert.equal(evaluateMoAnnualReporting({ last_building_placed_in_service_year: 2026, report_due_year: 2027, portal_submission_date: "2027-04-15", owner_certification_submission_date: "2027-04-30", owner_certification_signed: true }).finding, "PASS");
  assert.equal(evaluateMoAnnualReporting({ last_building_placed_in_service_year: 2026, report_due_year: 2027, portal_submission_date: "2027-04-16", owner_certification_submission_date: "2027-04-30", owner_certification_signed: true }).finding, "FAIL");
});

test("MO Form 8609 Part II copy is due within exactly 90 days after the first credit year", () => {
  const ordinary = evaluateMoForm8609PartII({ first_credit_period_year: 2025, part_ii_completed: true, copy_submitted_to_mhdc_date: "2026-03-31" });
  assert.equal(ordinary.finding, "PASS");
  assert.equal(ordinary.latest_submission_date, "2026-03-31");
  const leapBoundary = evaluateMoForm8609PartII({ first_credit_period_year: 2023, part_ii_completed: true, copy_submitted_to_mhdc_date: "2024-03-30" });
  assert.equal(leapBoundary.finding, "PASS");
  assert.equal(leapBoundary.latest_submission_date, "2024-03-30");
  assert.equal(evaluateMoForm8609PartII({ first_credit_period_year: 2023, part_ii_completed: true, copy_submitted_to_mhdc_date: "2024-03-31" }).finding, "FAIL");
});

test("MO Exhibit U exemption requires 100 percent LIHTC-only property and MHDC approval", () => {
  assert.equal(evaluateMoExhibitURecertificationBoundary({ property_100_percent_lihtc_only: false, mhdc_exhibit_u_approval: true, move_in_income_asset_verification_complete: true, following_year_income_asset_verification_complete: true, annual_tic_household_composition_complete: true }).finding, "FAIL");
  assert.equal(evaluateMoExhibitURecertificationBoundary({ property_100_percent_lihtc_only: true, mhdc_exhibit_u_approval: false, move_in_income_asset_verification_complete: true, following_year_income_asset_verification_complete: true, annual_tic_household_composition_complete: true }).finding, "FAIL");
  assert.equal(evaluateMoExhibitURecertificationBoundary({ property_100_percent_lihtc_only: true, mhdc_exhibit_u_approval: true, move_in_income_asset_verification_complete: true, following_year_income_asset_verification_complete: true, annual_tic_household_composition_complete: true }).finding, "PASS");
});

test("MO Exhibit U preserves student-status certification when student status changes", () => {
  assert.equal(evaluateMoExhibitURecertificationBoundary({ property_100_percent_lihtc_only: true, mhdc_exhibit_u_approval: true, move_in_income_asset_verification_complete: true, following_year_income_asset_verification_complete: true, annual_tic_household_composition_complete: true, student_status_changed: true, student_status_certification_complete: false }).finding, "FAIL");
});

test("MO release remains blocked until exact source identities and property gates are complete", () => {
  const result = moLihtcReleaseEligibility({ current_manual_and_portal_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("exact_binary_identities_registered"));
  assert.equal(result.qap_allocation_scoring_included, false);
});
