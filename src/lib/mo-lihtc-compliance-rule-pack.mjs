export const MO_LIHTC_RULE_PACK_BUILD = "mo-lihtc-compliance-2026.08.26.1";
export const MO_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const MO_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://mhdc.com/programs/asset-management/program-compliance/housing-programs/low-income-housing-tax-credit-lihtc-compliance/",
  tax_credit_manual: "https://mhdc.com/media/suadfwne/mhdc-tax-credit-manual.pdf",
  certification_portal: "https://mhdc.com/programs/asset-management/program-compliance/compliance-resources/certification-portal-and-annual-reporting/",
  manual_revision: "2025-07",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

function parseDate(value, reason) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return blocked(reason);
  return parsed;
}

function seasonalGroup(placedInServiceYear) {
  const year = Number(placedInServiceYear);
  if (!Number.isInteger(year) || year < 1990) return null;
  if (year <= 1993) return "APRIL";
  if (year <= 1997) return "JULY";
  if (year <= 2001) return "OCTOBER";
  if (year <= 2005) return "JANUARY";
  const remainder = year % 4;
  if (remainder === 2) return "APRIL";
  if (remainder === 3) return "JULY";
  if (remainder === 0) return "OCTOBER";
  return "JANUARY";
}

export function getMoSeasonalReportingSchedule(input = {}) {
  if (input.last_building_placed_in_service_year == null) return blocked("MO_PLACED_IN_SERVICE_YEAR_REQUIRED", ["last_building_placed_in_service_year"]);
  const group = seasonalGroup(input.last_building_placed_in_service_year);
  if (!group) return blocked("VALID_MO_PLACED_IN_SERVICE_YEAR_REQUIRED", ["last_building_placed_in_service_year"]);
  const schedules = {
    APRIL: { activity_period: "APRIL_1_TO_MARCH_31", portal_due_month_day: "04-15", owner_cert_due_month_day: "04-30" },
    JULY: { activity_period: "JULY_1_TO_JUNE_30", portal_due_month_day: "07-15", owner_cert_due_month_day: "07-31" },
    OCTOBER: { activity_period: "OCTOBER_1_TO_SEPTEMBER_30", portal_due_month_day: "10-15", owner_cert_due_month_day: "10-31" },
    JANUARY: { activity_period: "JANUARY_1_TO_DECEMBER_31", portal_due_month_day: "01-15", owner_cert_due_month_day: "01-31" },
  };
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "MO-LIHTC-SEASONAL-REPORTING-SCHEDULE", group, ...schedules[group] });
}

export function evaluateMoAnnualReporting(input = {}) {
  for (const field of ["last_building_placed_in_service_year", "report_due_year", "portal_submission_date", "owner_certification_submission_date", "owner_certification_signed"]) {
    if (input[field] == null) return blocked("MO_ANNUAL_REPORTING_INPUT_REQUIRED", [field]);
  }
  const schedule = getMoSeasonalReportingSchedule(input);
  if (schedule.status === "BLOCKED") return schedule;
  const reportYear = Number(input.report_due_year);
  if (!Number.isInteger(reportYear)) return blocked("VALID_MO_REPORT_DUE_YEAR_REQUIRED", ["report_due_year"]);
  const portalSubmitted = parseDate(input.portal_submission_date, "VALID_MO_PORTAL_SUBMISSION_DATE_REQUIRED");
  const ownerSubmitted = parseDate(input.owner_certification_submission_date, "VALID_MO_OWNER_CERT_SUBMISSION_DATE_REQUIRED");
  if (portalSubmitted?.status === "BLOCKED") return portalSubmitted;
  if (ownerSubmitted?.status === "BLOCKED") return ownerSubmitted;
  const portalDue = new Date(`${reportYear}-${schedule.portal_due_month_day}T23:59:59Z`);
  const ownerDue = new Date(`${reportYear}-${schedule.owner_cert_due_month_day}T23:59:59Z`);
  const pass = portalSubmitted <= portalDue && ownerSubmitted <= ownerDue && input.owner_certification_signed === true;
  return Object.freeze({
    finding: pass ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "MO-LIHTC-ANNUAL-REPORTING",
    portal_due_date: `${reportYear}-${schedule.portal_due_month_day}`,
    owner_certification_due_date: `${reportYear}-${schedule.owner_cert_due_month_day}`,
    reason: portalSubmitted > portalDue ? "MO_PORTAL_REPORT_SUBMITTED_LATE" : ownerSubmitted > ownerDue ? "MO_OWNER_CERTIFICATION_SUBMITTED_LATE" : input.owner_certification_signed !== true ? "MO_OWNER_CERTIFICATION_MUST_BE_SIGNED_BY_OWNER" : undefined,
  });
}

export function evaluateMoForm8609PartII(input = {}) {
  for (const field of ["first_credit_period_year", "part_ii_completed", "copy_submitted_to_mhdc_date"]) {
    if (input[field] == null) return blocked("MO_8609_INPUT_REQUIRED", [field]);
  }
  const year = Number(input.first_credit_period_year);
  if (!Number.isInteger(year)) return blocked("VALID_MO_FIRST_CREDIT_PERIOD_YEAR_REQUIRED", ["first_credit_period_year"]);
  const submitted = parseDate(input.copy_submitted_to_mhdc_date, "VALID_MO_8609_SUBMISSION_DATE_REQUIRED");
  if (submitted?.status === "BLOCKED") return submitted;
  const deadline = new Date(Date.UTC(year + 1, 2, 31));
  const complete = input.part_ii_completed === true;
  return Object.freeze({
    finding: complete && submitted <= deadline ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "MO-LIHTC-8609-PART-II",
    latest_submission_date: deadline.toISOString().slice(0, 10),
    reason: !complete ? "FORM_8609_PART_II_MUST_BE_COMPLETED_IN_FIRST_CREDIT_YEAR" : submitted > deadline ? "FORM_8609_COPY_NOT_SUBMITTED_WITHIN_90_DAYS_AFTER_FIRST_CREDIT_YEAR" : undefined,
  });
}

export function evaluateMoExhibitURecertificationBoundary(input = {}) {
  for (const field of ["property_100_percent_lihtc_only", "mhdc_exhibit_u_approval", "move_in_income_asset_verification_complete", "following_year_income_asset_verification_complete", "annual_tic_household_composition_complete"]) {
    if (input[field] == null) return blocked("MO_EXHIBIT_U_INPUT_REQUIRED", [field]);
  }
  if (input.property_100_percent_lihtc_only !== true || input.mhdc_exhibit_u_approval !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "MO-LIHTC-EXHIBIT-U-BOUNDARY", income_recertification_exemption_established: false, reason: "EXHIBIT_U_REQUIRES_MHDC_APPROVAL_FOR_A_100_PERCENT_LIHTC_ONLY_PROPERTY" });
  }
  const requiredEvidence = input.move_in_income_asset_verification_complete === true && input.following_year_income_asset_verification_complete === true && input.annual_tic_household_composition_complete === true;
  if (!requiredEvidence) return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "MO-LIHTC-EXHIBIT-U-BOUNDARY", income_recertification_exemption_established: true, reason: "EXHIBIT_U_DOES_NOT_REMOVE_MOVE_IN_FOLLOWING_YEAR_OR_ANNUAL_HOUSEHOLD_COMPOSITION_REQUIREMENTS" });
  if (input.student_status_changed === true && input.student_status_certification_complete !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "MO-LIHTC-EXHIBIT-U-BOUNDARY", income_recertification_exemption_established: true, reason: "STUDENT_STATUS_CERTIFICATION_REQUIRED_WHEN_STUDENT_STATUS_CHANGES" });
  }
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "MO-LIHTC-EXHIBIT-U-BOUNDARY", income_recertification_exemption_established: true });
}

export function moLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (MO_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.current_manual_and_portal_reconciled !== true) missing.push("current_manual_and_portal_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "MO", program: "LIHTC", version: MO_LIHTC_RULE_PACK_BUILD, effective_from: MO_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "ANNUAL_REPORTING_8609_AND_RECERTIFICATION_BOUNDARY_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
