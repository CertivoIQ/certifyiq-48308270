const LEGACY_CORE = [
  "CTCAC_TENANT_INCOME_CERTIFICATION_LEGACY",
  "CTCAC_TENANT_INCOME_CERTIFICATION_QUESTIONNAIRE_LEGACY",
  "CTCAC_UNDER_5000_ASSET_CERTIFICATION",
];

const HOTMA_CORE = [
  "CTCAC_HOTMA_TENANT_INCOME_CERTIFICATION",
  "CTCAC_HOTMA_TENANT_INCOME_CERTIFICATION_QUESTIONNAIRE",
  "CTCAC_HOTMA_52787_ASSET_CERTIFICATION",
];

const COMMON_REQUIRED = [
  "CTCAC_GOOD_CAUSE_EVICTION_DOCUMENTS",
  "CTCAC_SECTION_42_LEASE_RIDER",
  "CTCAC_CHILD_SPOUSAL_SUPPORT_AFFIDAVIT",
];

const TRIGGERED = Object.freeze({
  TENANT_DEMOGRAPHIC_REPORTING_APPLICABLE: "CTCAC_TENANT_HOUSEHOLD_INFORMATION",
  EMPLOYMENT_INCOME_REPORTED: "CTCAC_VERIFICATION_OF_EMPLOYMENT",
  ZERO_INCOME_CLAIMED: "CTCAC_CERTIFICATION_OF_ZERO_INCOME",
  CHILD_OR_SPOUSAL_SUPPORT_REPORTED: "CTCAC_CHILD_SPOUSAL_SUPPORT_VERIFICATION",
  SEPARATED_OR_ESTRANGED_STATUS_CLAIMED: "CTCAC_SEPARATED_ESTRANGED_STATUS_AFFIDAVIT",
  STUDENT_STATUS_REPORTED: "CTCAC_STUDENT_VERIFICATION",
  SINGLE_PARENT_STUDENT_EXCEPTION_CLAIMED: "CTCAC_SINGLE_PARENT_STUDENT_AFFIDAVIT",
  FOSTER_CHILD_OR_ADULT_REPORTED: "CTCAC_FOSTER_CARE_VERIFICATION",
  LIVE_IN_AIDE_REPORTED: "CTCAC_LIVE_IN_AIDE_VERIFICATION",
});

const VALID_IMPLEMENTATIONS = new Set(["legacy", "partial", "full", "mandatory"]);
const VALID_COMPONENTS = new Set(["annual_income", "net_family_assets", "student_financial_aid"]);

export function resolveCaliforniaCtcacForms(input) {
  const effectiveDate = new Date(`${input.certificationEffectiveDate}T00:00:00Z`);
  if (Number.isNaN(effectiveDate.valueOf())) throw new Error("invalid_certification_effective_date");
  if (!VALID_IMPLEMENTATIONS.has(input.hotmaImplementation)) throw new Error("invalid_hotma_implementation");

  const mandatory = input.certificationEffectiveDate >= "2027-01-01";
  const implementation = mandatory ? "mandatory" : input.hotmaImplementation;
  const components = new Set(input.hotmaComponents ?? []);
  if ([...components].some((component) => !VALID_COMPONENTS.has(component))) {
    throw new Error("invalid_hotma_component");
  }
  if (implementation === "partial" && components.size === 0) {
    throw new Error("partial_hotma_components_required");
  }

  const required = new Set(COMMON_REQUIRED);
  const manualReviewReasons = [];

  if (implementation === "legacy") {
    LEGACY_CORE.forEach((source) => required.add(source));
  } else if (implementation === "full" || implementation === "mandatory") {
    HOTMA_CORE.forEach((source) => required.add(source));
  } else {
    manualReviewReasons.push("PARTIAL_HOTMA_IMPLEMENTATION_REQUIRES_COMPONENT_RECONCILIATION");
    if (components.has("annual_income")) {
      required.add("CTCAC_HOTMA_TENANT_INCOME_CERTIFICATION");
      required.add("CTCAC_HOTMA_TENANT_INCOME_CERTIFICATION_QUESTIONNAIRE");
    } else {
      required.add("CTCAC_TENANT_INCOME_CERTIFICATION_LEGACY");
      required.add("CTCAC_TENANT_INCOME_CERTIFICATION_QUESTIONNAIRE_LEGACY");
    }
    required.add(components.has("net_family_assets")
      ? "CTCAC_HOTMA_52787_ASSET_CERTIFICATION"
      : "CTCAC_UNDER_5000_ASSET_CERTIFICATION");
  }

  for (const trigger of input.triggers ?? []) {
    if (trigger === "STUDENT_FINANCIAL_AID_REPORTED") continue;
    const source = TRIGGERED[trigger];
    if (!source) throw new Error(`unknown_ctcac_form_trigger:${trigger}`);
    required.add(source);
  }

  if ((input.triggers ?? []).includes("STUDENT_FINANCIAL_AID_REPORTED")) {
    const hotmaFinancialAid = implementation === "full"
      || implementation === "mandatory"
      || (implementation === "partial" && components.has("student_financial_aid"));
    required.add(hotmaFinancialAid
      ? "CTCAC_HOTMA_STUDENT_FINANCIAL_AID_VERIFICATION"
      : "CTCAC_STUDENT_FINANCIAL_AID_VERIFICATION_LEGACY");
  }

  return Object.freeze({
    stateCode: "CA",
    certificationEffectiveDate: input.certificationEffectiveDate,
    requestedHotmaImplementation: input.hotmaImplementation,
    resolvedHotmaImplementation: implementation,
    mandatoryHotmaApplied: mandatory,
    requiredSourceTypes: Object.freeze([...required].sort()),
    projectReportingSourceTypes: Object.freeze([
      "CTCAC_PSR_AIT_FORM",
      "CTCAC_PSR_FORM",
      "CTCAC_PSR_INSTRUCTIONS",
      "CTCAC_RESYNDICATION_CLARIFICATION_FORM",
    ]),
    manualReviewRequired: manualReviewReasons.length > 0,
    manualReviewReasons: Object.freeze(manualReviewReasons),
    complianceActivationAllowed: false,
    independentValidationRequired: true,
  });
}
