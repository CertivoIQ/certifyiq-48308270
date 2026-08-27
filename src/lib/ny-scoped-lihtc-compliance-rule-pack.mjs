export const NY_LIHTC_RULE_PACK_BUILD = "ny-scoped-lihtc-compliance-2026.08.26.1";
export const NY_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const NY_LIHTC_SOURCES = Object.freeze({
  hfa_owner_annual_certification: "https://hcr.ny.gov/system/files/documents/2025/10/2025-owner-annual-certification_0.pdf",
  hfa_4pct_qap: "https://hcr.ny.gov/system/files/documents/2025/06/rule-text-title-21-part-2188-4-hfa-qap-effective-6-11-2025.pdf",
  hdc_asset_management: "https://www.nychdc.com/meet-hdc/asset-management",
  hdc_manage: "https://www.nychdc.com/manage",
  hfa_exact_binary_identities_registered: false,
  hdc_exact_operating_source_identities_registered: false,
});

export const NY_AUTHORITY = Object.freeze({
  HFA_STATEWIDE: "NYS_HFA",
  NYC_HDC: "NYC_HDC",
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function resolveNyComplianceAuthority(input = {}) {
  if (!input.compliance_authority) return blocked("NY_COMPLIANCE_AUTHORITY_REQUIRED", ["compliance_authority"]);
  if (![NY_AUTHORITY.HFA_STATEWIDE, NY_AUTHORITY.NYC_HDC].includes(input.compliance_authority)) {
    return blocked("UNSUPPORTED_NY_COMPLIANCE_AUTHORITY", ["verified_project_authority"]);
  }
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "NY-LIHTC-AUTHORITY-SCOPE", compliance_authority: input.compliance_authority, inferred_from_geography: false });
}

export function evaluateNyHfaAnnualCertificationPackage(input = {}) {
  if (input.compliance_authority !== NY_AUTHORITY.HFA_STATEWIDE) return blocked("NYS_HFA_AUTHORITY_REQUIRED", ["compliance_authority"]);
  for (const field of ["placed_in_service", "sections_a_through_e_complete"]) {
    if (input[field] == null) return blocked("NY_HFA_ANNUAL_CERT_INPUT_REQUIRED", [field]);
  }
  if (input.sections_a_through_e_complete !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "NY-HFA-ANNUAL-CERT-PACKAGE", reason: "SECTIONS_A_THROUGH_E_REQUIRED_FOR_ALL_HFA_PROJECTS" });
  }
  if (input.placed_in_service !== true) {
    if (input.section_f_tax_credit_projection_complete == null) return blocked("NY_HFA_SECTION_F_STATUS_REQUIRED", ["section_f_tax_credit_projection_complete"]);
    return Object.freeze({ finding: input.section_f_tax_credit_projection_complete === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NY-HFA-ANNUAL-CERT-PACKAGE", section_f_required: true, continuing_program_compliance_required: false, reason: input.section_f_tax_credit_projection_complete === true ? undefined : "SECTION_F_TAX_CREDIT_PROJECTION_REQUIRED_BEFORE_PLACED_IN_SERVICE" });
  }
  if (input.continuing_program_compliance_certification_complete == null) return blocked("NY_HFA_CONTINUING_COMPLIANCE_STATUS_REQUIRED", ["continuing_program_compliance_certification_complete"]);
  return Object.freeze({ finding: input.continuing_program_compliance_certification_complete === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NY-HFA-ANNUAL-CERT-PACKAGE", section_f_required: false, continuing_program_compliance_required: true, reason: input.continuing_program_compliance_certification_complete === true ? undefined : "OWNER_CONTINUING_PROGRAM_COMPLIANCE_CERTIFICATION_REQUIRED_AFTER_PLACED_IN_SERVICE" });
}

export function evaluateNyHfaContinuingComplianceEvidence(input = {}) {
  if (input.compliance_authority !== NY_AUTHORITY.HFA_STATEWIDE) return blocked("NYS_HFA_AUTHORITY_REQUIRED", ["compliance_authority"]);
  for (const field of ["tenant_income_certification_and_support_present", "annual_student_self_certifications_present", "qualified_units_rent_restricted"]) {
    if (input[field] == null) return blocked("NY_HFA_CONTINUING_COMPLIANCE_EVIDENCE_REQUIRED", [field]);
  }
  const pass = input.tenant_income_certification_and_support_present === true && input.annual_student_self_certifications_present === true && input.qualified_units_rent_restricted === true;
  return Object.freeze({ finding: pass ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NY-HFA-CONTINUING-COMPLIANCE-EVIDENCE", reason: pass ? undefined : "HFA_CONTINUING_COMPLIANCE_EVIDENCE_INCOMPLETE" });
}

export function evaluateNyHfa4PctManagementTraining(input = {}) {
  if (input.compliance_authority !== NY_AUTHORITY.HFA_STATEWIDE) return blocked("NYS_HFA_AUTHORITY_REQUIRED", ["compliance_authority"]);
  if (input.hfa_program_path !== "HFA_4_PERCENT_LIHTC") return blocked("HFA_4_PERCENT_PROGRAM_PATH_REQUIRED", ["hfa_program_path"]);
  for (const field of ["project_placed_in_service", "pre_placed_in_service_lihtc_certification_complete", "training_at_employment_complete", "years_since_last_lihtc_refresher"]) {
    if (input[field] == null) return blocked("NY_HFA_4PCT_TRAINING_INPUT_REQUIRED", [field]);
  }
  if (input.project_placed_in_service === true && input.pre_placed_in_service_lihtc_certification_complete !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "NY-HFA-4PCT-MANAGEMENT-TRAINING", reason: "LIHTC_COMPLIANCE_CERTIFICATION_REQUIRED_BEFORE_PROJECT_PLACED_IN_SERVICE" });
  }
  if (input.training_at_employment_complete !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "NY-HFA-4PCT-MANAGEMENT-TRAINING", reason: "LIHTC_TRAINING_AND_CERTIFICATION_REQUIRED_AT_COMMENCEMENT_OF_EMPLOYMENT" });
  }
  const years = Number(input.years_since_last_lihtc_refresher);
  if (!Number.isFinite(years) || years < 0) return blocked("VALID_YEARS_SINCE_LAST_LIHTC_REFRESHER_REQUIRED", ["years_since_last_lihtc_refresher"]);
  return Object.freeze({ finding: years <= 5 ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NY-HFA-4PCT-MANAGEMENT-TRAINING", maximum_refresher_interval_years: 5, reason: years <= 5 ? undefined : "LIHTC_REFRESHER_TRAINING_REQUIRED_NOT_LESS_THAN_EVERY_FIVE_YEARS" });
}

export function evaluateNyHdcMonitoringEvidence(input = {}) {
  if (input.compliance_authority !== NY_AUTHORITY.NYC_HDC) return blocked("NYC_HDC_AUTHORITY_REQUIRED", ["compliance_authority"]);
  for (const field of ["tax_credit_or_tax_exempt_bond_project", "annual_desk_review_evidence_present"]) {
    if (input[field] == null) return blocked("NYC_HDC_MONITORING_INPUT_REQUIRED", [field]);
  }
  if (input.tax_credit_or_tax_exempt_bond_project !== true) return blocked("NYC_HDC_TAX_CREDIT_OR_TEB_SCOPE_NOT_ESTABLISHED", ["verified_hdc_program_authority"]);
  return Object.freeze({ finding: input.annual_desk_review_evidence_present === true ? "PASS" : "FAIL", status: "EVALUATED", rule_id: "NYC-HDC-ANNUAL-DESK-REVIEW-EVIDENCE", annual_desk_review_in_scope: true, cyclical_site_audits_in_scope: true, reason: input.annual_desk_review_evidence_present === true ? undefined : "NYC_HDC_ANNUAL_DESK_REVIEW_EVIDENCE_REQUIRED" });
}

export function nyLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (![NY_AUTHORITY.HFA_STATEWIDE, NY_AUTHORITY.NYC_HDC].includes(input.compliance_authority)) missing.push("verified_project_compliance_authority");
  if (input.compliance_authority === NY_AUTHORITY.HFA_STATEWIDE && NY_LIHTC_SOURCES.hfa_exact_binary_identities_registered !== true) missing.push("hfa_exact_binary_identities_registered");
  if (input.compliance_authority === NY_AUTHORITY.NYC_HDC && NY_LIHTC_SOURCES.hdc_exact_operating_source_identities_registered !== true) missing.push("hdc_exact_operating_source_identities_registered");
  if (input.current_authority_sources_reconciled !== true) missing.push("current_authority_sources_reconciled");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  if (input.property_figure_verification_ready !== true) missing.push("property_figure_verification_ready");
  return Object.freeze({ state: "NY", program: "LIHTC", authority: input.compliance_authority ?? null, version: NY_LIHTC_RULE_PACK_BUILD, effective_from: NY_LIHTC_EFFECTIVE_FROM, status: missing.length ? "BLOCKED" : "VALIDATED", missing: Object.freeze(missing), scope: "AUTHORITY_SCOPED_COMPLIANCE_MONITORING_ONLY", qap_allocation_scoring_included: false, geography_alone_does_not_select_authority: true, property_figure_verification_required: true });
}
