export const OH_LIHTC_RULE_PACK_BUILD = "oh-lihtc-compliance-2026.08.26.1";
export const OH_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const OH_LIHTC_SOURCES = Object.freeze({
  compliance_page: "https://ohiohome.org/compliance/default.aspx",
  compliance_policies: "https://ohiohome.org/compliance/policies.aspx",
  manual_revision_summary: "https://ohiohome.org/compliance/documents/Jan26-LIHTC-ManualRevisions.pdf",
  message_archive: "https://www.ohiohome.org/compliance/messagearchive.aspx",
  exact_binary_identities_registered: false,
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateOh2026AnnualOwnerCertification(input = {}) {
  if (!input.submission_date) return blocked("OH_2026_AOC_SUBMISSION_DATE_REQUIRED", ["submission_date"]);
  const submitted = new Date(`${input.submission_date}T00:00:00Z`);
  const deadline = new Date("2026-03-01T23:59:59Z");
  if (Number.isNaN(submitted.getTime())) return blocked("VALID_AOC_SUBMISSION_DATE_REQUIRED");
  return Object.freeze({ finding: submitted <= deadline ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OH-2026-AOC-DEADLINE", deadline: "2026-03-01", reason: submitted <= deadline ? undefined : "ANNUAL_OWNER_CERTIFICATION_LATE" });
}

export function evaluateOhExtendedUseStudentVerification(input = {}) {
  for (const field of ["project_in_extended_use_period", "tenant_is_new_move_in", "student_status_verified"]) {
    if (input[field] == null) return blocked("OH_EXTENDED_USE_STUDENT_INPUT_REQUIRED", [field]);
  }
  if (input.project_in_extended_use_period !== true) return blocked("OH_EXTENDED_USE_RULE_NOT_APPLICABLE", ["initial_compliance_period_student_rule"]);
  if (input.tenant_is_new_move_in !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "OH-EXTENDED-USE-STUDENT-STATUS", verification_required: false });
  }
  return Object.freeze({ finding: input.student_status_verified === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OH-EXTENDED-USE-STUDENT-STATUS", verification_required: true, reason: input.student_status_verified === true ? undefined : "NEW_MOVE_IN_STUDENT_STATUS_VERIFICATION_REQUIRED" });
}

export function evaluateOhHotmaCertificationDate(input = {}) {
  if (!input.certification_date || input.hotma_method_used == null) return blocked("OH_HOTMA_CERTIFICATION_INPUT_REQUIRED", ["certification_date", "hotma_method_used"]);
  const certificationDate = new Date(`${input.certification_date}T00:00:00Z`);
  if (Number.isNaN(certificationDate.getTime())) return blocked("VALID_CERTIFICATION_DATE_REQUIRED");
  const ohfaImplementation = new Date("2025-05-01T00:00:00Z");
  const required = certificationDate >= ohfaImplementation;
  return Object.freeze({ finding: !required || input.hotma_method_used === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "OH-HOTMA-CERTIFICATION", hotma_required: required, reason: !required || input.hotma_method_used === true ? undefined : "OHFA_HOTMA_METHOD_REQUIRED_FOR_CERTIFICATION_DATE" });
}

export function ohLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (OH_LIHTC_SOURCES.exact_binary_identities_registered !== true) missing.push("exact_binary_identities_registered");
  if (input.manual_effective_date_and_current_updates_reconciled !== true) missing.push("manual_effective_date_and_current_updates_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "OH", program: "LIHTC", version: OH_LIHTC_RULE_PACK_BUILD, effective_from: OH_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "COMPLIANCE_MONITORING_ONLY", qap_allocation_scoring_included: false, property_figure_verification_required: true });
}
