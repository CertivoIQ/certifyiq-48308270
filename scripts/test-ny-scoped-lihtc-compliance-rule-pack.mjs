import assert from "node:assert/strict";
import test from "node:test";
import {
  NY_AUTHORITY,
  resolveNyComplianceAuthority,
  evaluateNyHfaAnnualCertificationPackage,
  evaluateNyHfaContinuingComplianceEvidence,
  evaluateNyHfa4PctManagementTraining,
  evaluateNyHdcMonitoringEvidence,
  nyLihtcReleaseEligibility,
} from "../src/lib/ny-scoped-lihtc-compliance-rule-pack.mjs";

test("NY compliance authority must be explicit and is never inferred from geography", () => {
  assert.equal(resolveNyComplianceAuthority({}).finding, "UNABLE_TO_DETERMINE");
  const hfa = resolveNyComplianceAuthority({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE });
  assert.equal(hfa.finding, "PASS");
  assert.equal(hfa.inferred_from_geography, false);
  assert.equal(resolveNyComplianceAuthority({ compliance_authority: NY_AUTHORITY.NYC_HDC }).finding, "PASS");
});

test("HFA annual certification package branches on placed-in-service status", () => {
  assert.equal(evaluateNyHfaAnnualCertificationPackage({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, placed_in_service: false, sections_a_through_e_complete: true, section_f_tax_credit_projection_complete: true }).finding, "PASS");
  assert.equal(evaluateNyHfaAnnualCertificationPackage({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, placed_in_service: false, sections_a_through_e_complete: true, section_f_tax_credit_projection_complete: false }).finding, "FAIL");
  assert.equal(evaluateNyHfaAnnualCertificationPackage({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, placed_in_service: true, sections_a_through_e_complete: true, continuing_program_compliance_certification_complete: true }).finding, "PASS");
  assert.equal(evaluateNyHfaAnnualCertificationPackage({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, placed_in_service: true, sections_a_through_e_complete: true, continuing_program_compliance_certification_complete: false }).finding, "FAIL");
});

test("HFA continuing compliance evidence includes TIC support, annual student self-certification, and rent restriction", () => {
  assert.equal(evaluateNyHfaContinuingComplianceEvidence({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, tenant_income_certification_and_support_present: true, annual_student_self_certifications_present: true, qualified_units_rent_restricted: true }).finding, "PASS");
  assert.equal(evaluateNyHfaContinuingComplianceEvidence({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, tenant_income_certification_and_support_present: true, annual_student_self_certifications_present: false, qualified_units_rent_restricted: true }).finding, "FAIL");
});

test("HFA 4 percent management staff certification and refresher rules stay scoped to the 4 percent path", () => {
  assert.equal(evaluateNyHfa4PctManagementTraining({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, hfa_program_path: "HFA_9_PERCENT_LIHTC" }).finding, "UNABLE_TO_DETERMINE");
  assert.equal(evaluateNyHfa4PctManagementTraining({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, hfa_program_path: "HFA_4_PERCENT_LIHTC", project_placed_in_service: true, pre_placed_in_service_lihtc_certification_complete: true, training_at_employment_complete: true, years_since_last_lihtc_refresher: 5 }).finding, "PASS");
  assert.equal(evaluateNyHfa4PctManagementTraining({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, hfa_program_path: "HFA_4_PERCENT_LIHTC", project_placed_in_service: true, pre_placed_in_service_lihtc_certification_complete: true, training_at_employment_complete: true, years_since_last_lihtc_refresher: 6 }).finding, "FAIL");
});

test("NYC HDC monitoring rules never execute under HFA authority", () => {
  assert.equal(evaluateNyHdcMonitoringEvidence({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, tax_credit_or_tax_exempt_bond_project: true, annual_desk_review_evidence_present: true }).finding, "UNABLE_TO_DETERMINE");
  assert.equal(evaluateNyHdcMonitoringEvidence({ compliance_authority: NY_AUTHORITY.NYC_HDC, tax_credit_or_tax_exempt_bond_project: true, annual_desk_review_evidence_present: true }).finding, "PASS");
  assert.equal(evaluateNyHdcMonitoringEvidence({ compliance_authority: NY_AUTHORITY.NYC_HDC, tax_credit_or_tax_exempt_bond_project: true, annual_desk_review_evidence_present: false }).finding, "FAIL");
});

test("NY release is independently gated by selected compliance authority", () => {
  const hfa = nyLihtcReleaseEligibility({ compliance_authority: NY_AUTHORITY.HFA_STATEWIDE, current_authority_sources_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(hfa.status, "BLOCKED");
  assert.ok(hfa.missing.includes("hfa_exact_binary_identities_registered"));
  const hdc = nyLihtcReleaseEligibility({ compliance_authority: NY_AUTHORITY.NYC_HDC, current_authority_sources_reconciled: true, fixture_suite_passed: true, two_person_approval_attested: true, property_figure_verification_ready: true });
  assert.equal(hdc.status, "BLOCKED");
  assert.ok(hdc.missing.includes("hdc_exact_operating_source_identities_registered"));
  assert.equal(hdc.geography_alone_does_not_select_authority, true);
});
