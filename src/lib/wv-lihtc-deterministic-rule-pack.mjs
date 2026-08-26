export const WV_LIHTC_RULE_PACK_BUILD = "wv-lihtc-2026.08.26.1";
export const WV_LIHTC_EFFECTIVE_FROM = "2026-08-27";

export const WV_LIHTC_SOURCES = Object.freeze({
  complianceManual: Object.freeze({
    title: "WVHDF Section 42 Tax Credit Compliance Manual",
    url: "https://www.wvhdf.com/wp-content/uploads/2026/03/WVHDF-Section-42-Tax-Credit-Compliance-Manual.pdf",
    sha256: "aa1abe0701197265eee4d900f595c218572037e9b28f0a157ef57c64d57d2bdd",
    citations: Object.freeze({
      minimumSetAside: "PDF page 7 / printed page 6",
      nextAvailableUnit140: "PDF page 9 / printed page 8",
      recertification: "PDF page 14 / printed page 13",
    }),
  }),
  waiverProcedure: Object.freeze({
    title: "WVHDF Certification Waiver Procedures",
    url: "https://www.wvhdf.com/wp-content/uploads/2026/03/WVHDF-Certification-Waiver-Procedures.pdf",
    sha256: "ca9c32c54f2d927b46b624b11d008610ade25224ecac2428f9b4ab661a8bae36",
    effectiveFrom: "2019-01-01",
    citation: "PDF pages 1-2",
  }),
});

function blocked(reason, missing = []) {
  return Object.freeze({ finding: "UNABLE_TO_DETERMINE", status: "BLOCKED", reason, missing: Object.freeze([...missing]) });
}

export function evaluateWvMinimumSetAside(input = {}) {
  if (!input.form8609_verified) return blocked("FORM_8609_REQUIRED", ["form8609_verified"]);
  if (!["20/50", "40/60"].includes(input.minimum_set_aside)) {
    return blocked("MINIMUM_SET_ASIDE_ELECTION_REQUIRED", ["minimum_set_aside"]);
  }
  if (input.initial_compliance_deadline_met == null) {
    return blocked("INITIAL_COMPLIANCE_DATE_REQUIRED", ["initial_compliance_deadline_met"]);
  }
  return Object.freeze({
    finding: input.initial_compliance_deadline_met ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WV-LIHTC-MINIMUM-SET-ASIDE",
    election: input.minimum_set_aside,
  });
}

export function evaluateWvNextAvailableUnit140(input = {}) {
  for (const field of ["household_income", "current_applicable_income_limit", "unit_rent_restricted"]) {
    if (input[field] == null) return blocked("140_RULE_INPUT_REQUIRED", [field]);
  }
  const threshold = Number(input.current_applicable_income_limit) * 1.4;
  const overIncome = Number(input.household_income) > threshold;
  if (!overIncome) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WV-LIHTC-140", over_income: false, threshold });
  }
  if (input.next_comparable_unit_available == null) {
    return blocked("NEXT_COMPARABLE_UNIT_STATUS_REQUIRED", ["next_comparable_unit_available"]);
  }
  if (!input.unit_rent_restricted) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WV-LIHTC-140", over_income: true, threshold, reason: "OVER_INCOME_UNIT_NOT_RENT_RESTRICTED" });
  }
  if (input.next_comparable_unit_available === false) {
    return Object.freeze({ finding: "PASS", status: "EVALUATED", rule_id: "WV-LIHTC-140", over_income: true, threshold, reason: "NO_COMPARABLE_UNIT_AVAILABLE_YET" });
  }
  if (input.next_comparable_unit_rented_to_qualified_household == null) {
    return blocked("NEXT_COMPARABLE_UNIT_TENANT_ELIGIBILITY_REQUIRED", ["next_comparable_unit_rented_to_qualified_household"]);
  }
  return Object.freeze({
    finding: input.next_comparable_unit_rented_to_qualified_household ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WV-LIHTC-140",
    over_income: true,
    threshold,
  });
}

export function evaluateWvAnnualRecertification(input = {}) {
  if (!Number.isInteger(input.residency_year) || input.residency_year < 1) {
    return blocked("RESIDENCY_YEAR_REQUIRED", ["residency_year"]);
  }
  if (input.initial_certification_completed !== true) {
    return Object.freeze({ finding: "FAIL", status: "EVALUATED", rule_id: "WV-LIHTC-RECERT", reason: "INITIAL_CERTIFICATION_MISSING" });
  }
  if (input.residency_year <= 2) {
    return Object.freeze({
      finding: input.full_annual_recertification_completed === true ? "PASS" : "FAIL",
      status: "EVALUATED",
      rule_id: "WV-LIHTC-RECERT",
      required_method: "FULL_ANNUAL_RECERTIFICATION",
    });
  }
  if (input.waiver_active === true) {
    const maintained = [input.student_status_reviewed, input.household_composition_reviewed, input.rule_140_reviewed].every((v) => v === true);
    return Object.freeze({
      finding: input.self_certification_completed === true && maintained ? "PASS" : "FAIL",
      status: "EVALUATED",
      rule_id: "WV-LIHTC-RECERT-WAIVER",
      required_method: "ANNUAL_TENANT_INCOME_SELF_CERTIFICATION",
    });
  }
  return Object.freeze({
    finding: input.full_annual_recertification_completed === true ? "PASS" : "FAIL",
    status: "EVALUATED",
    rule_id: "WV-LIHTC-RECERT",
    required_method: "FULL_ANNUAL_RECERTIFICATION",
  });
}

export function wvLihtcReleaseEligibility(input = {}) {
  const missing = [];
  if (input.official_index_sha256 !== "4ab159460dc302f6d255bb12520a0fd1ed44bad3b7aa4798d0725071c23c9973") missing.push("official_index_sha256");
  if (input.content_validation_complete !== true) missing.push("content_validation_complete");
  if (input.fixture_suite_passed !== true) missing.push("fixture_suite_passed");
  if (input.two_person_approval_attested !== true) missing.push("two_person_approval_attested");
  return Object.freeze({
    state: "WV",
    program: "LIHTC",
    version: WV_LIHTC_RULE_PACK_BUILD,
    effective_from: WV_LIHTC_EFFECTIVE_FROM,
    status: missing.length ? "BLOCKED" : "VALIDATED",
    missing: Object.freeze(missing),
    property_figure_verification_required: true,
    home_htf_included: false,
  });
}
