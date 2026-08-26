export const WA_LIHTC_RULE_PACK_BUILD = "wa-lihtc-2026.08.26.1";
export const WA_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const WA_LIHTC_SOURCE = Object.freeze({
  title: "WSHFC Tax Credit Compliance Procedures Manual - Chapter 3 Washington State Requirements",
  url: "https://www.wshfc.org/managers/ManualTaxCredit/50_Chap03WashingtonStateRequirements_Dec2024_Final.pdf",
  sha256: "475048bc31802184b2cbbced544cad81d58336c881957ed56da8a741a53da69e",
  revision: "2024-12",
  citations: Object.freeze({
    annualRecertification: "Chapter 3, page 3-2",
    additionalLowIncomeCommitment: "Chapter 3, page 3-2",
    commissionReportingForms: "Chapter 3, page 3-2",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateWaAnnualRecertification(input = {}) {
  if (input.regulatory_period_active !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WA-LIHTC-RECERT", policy_applicable: false });
  }
  if (input.project_is_100_percent_affordable == null) {
    return blocked("PROJECT_AFFORDABILITY_SCOPE_REQUIRED", ["project_is_100_percent_affordable"]);
  }
  if (input.annual_recertification_completed !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WA-LIHTC-RECERT", reason: "ANNUAL_RECERTIFICATION_REQUIRED" });
  }
  if (input.project_is_100_percent_affordable === true) {
    return Object.freeze({
      finding: input.wshfc_self_certification_completed === true ? "PASS" : "FAIL",
      status: "EVALUATED",
      rule_id: "WA-LIHTC-RECERT",
      third_party_verification_required: false,
      reason: input.wshfc_self_certification_completed === true ? undefined : "WSHFC_SELF_CERTIFICATION_REQUIRED",
    });
  }
  return Object.freeze({
    finding: input.third_party_verification_completed === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WA-LIHTC-RECERT",
    third_party_verification_required: true,
    reason: input.third_party_verification_completed === true ? undefined : "THIRD_PARTY_RECERTIFICATION_REQUIRED_FOR_MIXED_INCOME_PROPERTY",
  });
}

export function evaluateWaAdditionalLowIncomeCommitment(input = {}) {
  if (input.regulatory_agreement_has_additional_commitment !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WA-LIHTC-ADDITIONAL-COMMITMENT", policy_applicable: false });
  }
  for (const field of ["regulatory_agreement_verified", "target_amgi_percent", "required_commitment_units", "qualified_commitment_units", "commitment_units_rent_restricted_at_target"]) {
    if (input[field] == null) return blocked("WA_ADDITIONAL_COMMITMENT_INPUT_REQUIRED", [field]);
  }
  if (input.regulatory_agreement_verified !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WA-LIHTC-ADDITIONAL-COMMITMENT", reason: "REGULATORY_AGREEMENT_NOT_VERIFIED" });
  }
  const required = Number(input.required_commitment_units);
  const qualified = Number(input.qualified_commitment_units);
  if (!(required >= 0) || !(qualified >= 0)) return blocked("VALID_COMMITMENT_UNIT_COUNTS_REQUIRED", ["required_commitment_units", "qualified_commitment_units"]);
  if (qualified < required) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WA-LIHTC-ADDITIONAL-COMMITMENT", reason: "ADDITIONAL_COMMITMENT_UNIT_SHORTFALL" });
  }
  if (input.commitment_units_rent_restricted_at_target !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WA-LIHTC-ADDITIONAL-COMMITMENT", reason: "TARGET_AMGI_RENT_RESTRICTION_NOT_MET" });
  }
  return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WA-LIHTC-ADDITIONAL-COMMITMENT", target_amgi_percent: Number(input.target_amgi_percent) });
}

export function evaluateWaCommissionReportingForms(input = {}) {
  if (input.reporting_event_required !== true) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WA-LIHTC-REPORTING-FORMS", policy_applicable: false });
  }
  if (input.current_wshfc_form_verified == null) return blocked("CURRENT_WSHFC_FORM_VERIFICATION_REQUIRED", ["current_wshfc_form_verified"]);
  return Object.freeze({
    finding: input.current_wshfc_form_verified === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WA-LIHTC-REPORTING-FORMS",
    reason: input.current_wshfc_form_verified === true ? undefined : "COMMISSION_PROVIDED_REPORTING_FORM_REQUIRED",
  });
}

export function waLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (input.chapter3_sha256 !== WA_LIHTC_SOURCE.sha256) missing.push("chapter3_sha256");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  return Object.freeze({
    state: "WA",
    program: "LIHTC",
    version: WA_LIHTC_RULE_PACK_BUILD,
    effective_from: WA_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    prospective_2027_application_rules_included: false,
    wildfire_waiver_rules_included: false,
    property_figure_verification_required: true,
  });
}
