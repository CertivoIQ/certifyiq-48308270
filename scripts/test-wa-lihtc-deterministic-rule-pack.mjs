import assert from "node:assert/strict";
import test from "node:test";
import {
  WA_LIHTC_SOURCE,
  evaluateWaAnnualRecertification,
  evaluateWaAdditionalLowIncomeCommitment,
  evaluateWaCommissionReportingForms,
  waLihtcReleaseEligibility,
} from "../src/lib/wa-lihtc-deterministic-rule-pack.mjs";

test("WA 100% affordable annual recertification can use WSHFC self-certification", () => {
  const result = evaluateWaAnnualRecertification({
    regulatory_period_active: true,
    project_is_100_percent_affordable: true,
    annual_recertification_completed: true,
    wshfc_self_certification_completed: true,
  });
  assert.equal(result.finding, "PASS");
  assert.equal(result.third_party_verification_required, false);
});

test("WA mixed-income annual recertification requires third-party verification", () => {
  const result = evaluateWaAnnualRecertification({
    regulatory_period_active: true,
    project_is_100_percent_affordable: false,
    annual_recertification_completed: true,
    third_party_verification_completed: false,
  });
  assert.equal(result.finding, "FAIL");
  assert.equal(result.third_party_verification_required, true);
});

test("WA additional low-income commitment fails on unit shortfall", () => {
  const result = evaluateWaAdditionalLowIncomeCommitment({
    regulatory_agreement_has_additional_commitment: true,
    regulatory_agreement_verified: true,
    target_amgi_percent: 30,
    required_commitment_units: 12,
    qualified_commitment_units: 11,
    commitment_units_rent_restricted_at_target: true,
  });
  assert.equal(result.finding, "FAIL");
  assert.equal(result.reason, "ADDITIONAL_COMMITMENT_UNIT_SHORTFALL");
});

test("WA reporting event requires current Commission form", () => {
  const result = evaluateWaCommissionReportingForms({ reporting_event_required: true, current_wshfc_form_verified: false });
  assert.equal(result.finding, "FAIL");
});

test("WA release eligibility is bound to exact Chapter 3 bytes and external attestation", () => {
  const result = waLihtcReleaseEligibility({
    chapter3_sha256: WA_LIHTC_SOURCE.sha256,
    content_validation_complete: true,
    fixture_suite_passed: true,
    two_person_approval_attested: true,
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.prospective_2027_application_rules_included, false);
  assert.equal(result.property_figure_verification_required, true);
});
