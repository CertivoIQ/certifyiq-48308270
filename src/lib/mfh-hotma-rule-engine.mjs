/**
 * Deterministic routing gate for HUD Multifamily HOTMA Attachments A-J.
 *
 * This module classifies applicability and enforcement timing only. It never
 * infers owner policy choices and never issues substantive PASS/FAIL results.
 */
import MFH_HOTMA_RULE_PACK from "./mfh-hotma-rule-modules.json" with { type: "json" };

export const MFH_HOTMA_ENGINE_BUILD = "mfh-hotma-rule-engine-2026.08.1";
export const MFH_HOTMA_FINAL_RULE_EFFECTIVE_DATE = "2024-01-01";
export const MFH_HOTMA_MANDATORY_COMPLIANCE_DATE = "2027-01-01";

export const MFH_HOTMA_FINDING_CLASSIFICATION = Object.freeze({
  notApplicable: "NOT_APPLICABLE",
  preImplementationObservation: "PRE_IMPLEMENTATION_OBSERVATION",
  complianceFinding: "COMPLIANCE_FINDING",
  unableToDetermine: "UNABLE_TO_DETERMINE",
});

export const MFH_HOTMA_PROGRAM_SUBTYPES = Object.freeze([
  "SECTION_8_PBRA",
  "SECTION_202_8",
  "SECTION_202_162_PAC",
  "SECTION_202_811_PRAC",
  "SECTION_236_IRP",
  "SECTION_811_PRA",
  "SPRAC",
]);

const PROGRAM_SUBTYPE_SET = new Set(MFH_HOTMA_PROGRAM_SUBTYPES);

const freezeModule = (module) =>
  Object.freeze({
    ...module,
    hotma_sections: Object.freeze([...(module.hotma_sections ?? [])]),
    applies_to: Object.freeze([...(module.applies_to ?? [])]),
    citations: Object.freeze([...(module.citations ?? [])]),
    evidence_fields: Object.freeze([...(module.evidence_fields ?? [])]),
    policy_evidence_fields: Object.freeze([
      ...(module.policy_evidence_fields ?? []),
    ]),
    source_ids: Object.freeze([...(module.source_ids ?? [])]),
    classification_controls: Object.freeze({
      ...(module.classification_controls ?? {}),
      required_input_flags: Object.freeze([
        ...(module.classification_controls?.required_input_flags ?? []),
      ]),
    }),
  });

export const MFH_HOTMA_RULE_MODULES = Object.freeze(
  MFH_HOTMA_RULE_PACK.modules.map(freezeModule),
);

const MODULES_BY_ID = new Map(
  MFH_HOTMA_RULE_MODULES.map((module) => [module.module_id, module]),
);

function blocked(code, reason, missing = [], details = {}) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    finding_classification:
      MFH_HOTMA_FINDING_CLASSIFICATION.unableToDetermine,
    reason_code: code,
    reason,
    missing_inputs: [...new Set(missing)].sort(),
    human_approval_required: true,
    engine_build: MFH_HOTMA_ENGINE_BUILD,
    ...details,
  };
}

function notApplicable(code, reason, details) {
  return {
    resolution_status: "NOT_APPLICABLE",
    determination_status: "NOT_APPLICABLE",
    rule_engine_authority: "NOT_APPLICABLE",
    finding: "NOT_APPLICABLE",
    finding_classification: MFH_HOTMA_FINDING_CLASSIFICATION.notApplicable,
    reason_code: code,
    reason,
    human_approval_required: true,
    engine_build: MFH_HOTMA_ENGINE_BUILD,
    ...details,
  };
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { iso: String(value), timestamp };
}

/**
 * Classify one MFH HOTMA module before substantive rule evaluation.
 */
export function classifyMfhHotmaReview(input = {}) {
  const moduleId = String(input.module_id ?? "");
  const module = MODULES_BY_ID.get(moduleId);
  if (!module) {
    return blocked(
      "MFH_HOTMA_MODULE_REQUIRED",
      "A registered HUD Multifamily HOTMA module is required.",
      ["module_id"],
    );
  }

  const programSubtype = String(input.mfh_program_subtype ?? "").toUpperCase();
  if (!PROGRAM_SUBTYPE_SET.has(programSubtype)) {
    return blocked(
      "MFH_PROGRAM_SUBTYPE_REQUIRED",
      "The exact HUD Multifamily program subtype must be validated before HOTMA applicability can be determined.",
      ["mfh_program_subtype"],
      { module_id: moduleId },
    );
  }

  if (input.program_applicability_validated !== true) {
    return blocked(
      "MFH_PROGRAM_APPLICABILITY_NOT_VALIDATED",
      "The property's HUD Multifamily program applicability has not been validated.",
      ["program_applicability_validated"],
      { module_id: moduleId, mfh_program_subtype: programSubtype },
    );
  }

  if (!module.applies_to.includes(programSubtype)) {
    return notApplicable(
      "MFH_HOTMA_MODULE_NOT_APPLICABLE",
      module.name + " does not apply to " + programSubtype + ".",
      { module_id: moduleId, mfh_program_subtype: programSubtype },
    );
  }

  const eventDate = parseIsoDate(input.certification_effective_date);
  if (!eventDate) {
    return blocked(
      "CERTIFICATION_EFFECTIVE_DATE_REQUIRED",
      "A valid certification effective date is required for HOTMA version and enforcement routing.",
      ["certification_effective_date"],
      { module_id: moduleId, mfh_program_subtype: programSubtype },
    );
  }

  const finalRuleDate = parseIsoDate(MFH_HOTMA_FINAL_RULE_EFFECTIVE_DATE);
  const mandatoryDate = parseIsoDate(MFH_HOTMA_MANDATORY_COMPLIANCE_DATE);
  if (eventDate.timestamp < finalRuleDate.timestamp) {
    return notApplicable(
      "PRE_HOTMA_FINAL_RULE_CERTIFICATION",
      "The certification predates the January 1, 2024 effective date of the HOTMA final rule.",
      {
        module_id: moduleId,
        mfh_program_subtype: programSubtype,
        certification_effective_date: eventDate.iso,
      },
    );
  }

  const sourceFailures = [];
  if (input.controlled_source_release_approved !== true) {
    sourceFailures.push("controlled_source_release_approved");
  }
  if (input.current_rule_version_validated !== true) {
    sourceFailures.push("current_rule_version_validated");
  }
  if (input.source_status_conflict === true) {
    sourceFailures.push("source_status_conflict");
  }
  if (sourceFailures.length) {
    return blocked(
      "CONTROLLED_HOTMA_AUTHORITY_REQUIRED",
      "Approved, current, version-controlled HOTMA authority is required before rule evaluation.",
      sourceFailures,
      { module_id: moduleId, mfh_program_subtype: programSubtype },
    );
  }

  const missingControls = module.classification_controls.required_input_flags
    .filter((field) => input[field] !== true);
  if (missingControls.length) {
    return blocked(
      "MFH_HOTMA_MODULE_CONTROL_REQUIRED",
      "A module-specific version, form, system, or threshold control is unresolved.",
      missingControls,
      { module_id: moduleId, mfh_program_subtype: programSubtype },
    );
  }

  const policyEvidence =
    input.policy_evidence &&
    typeof input.policy_evidence === "object" &&
    !Array.isArray(input.policy_evidence)
      ? input.policy_evidence
      : {};
  const missingPolicy = module.policy_evidence_fields.filter(
    (field) => policyEvidence[field] == null || policyEvidence[field] === "",
  );
  if (missingPolicy.length) {
    return blocked(
      "OWNER_POLICY_OVERLAY_REQUIRED",
      "The applicable Tenant Selection Plan or EIV policy is required before this owner-policy-dependent HOTMA module can be evaluated.",
      missingPolicy,
      { module_id: moduleId, mfh_program_subtype: programSubtype },
    );
  }

  let findingClassification =
    MFH_HOTMA_FINDING_CLASSIFICATION.complianceFinding;
  if (eventDate.timestamp < mandatoryDate.timestamp) {
    const adoptionDate = parseIsoDate(input.property_hotma_implementation_date);
    if (input.property_hotma_implementation_date == null ||
        input.property_hotma_implementation_date === "") {
      return blocked(
        "PROPERTY_HOTMA_IMPLEMENTATION_DATE_REQUIRED",
        "The property's documented HOTMA implementation date is required for a certification before January 1, 2027.",
        ["property_hotma_implementation_date"],
        { module_id: moduleId, mfh_program_subtype: programSubtype },
      );
    }
    if (!adoptionDate) {
      return blocked(
        "PROPERTY_HOTMA_IMPLEMENTATION_DATE_INVALID",
        "The property HOTMA implementation date must be a valid ISO date.",
        ["property_hotma_implementation_date"],
        { module_id: moduleId, mfh_program_subtype: programSubtype },
      );
    }
    if (adoptionDate.timestamp > eventDate.timestamp) {
      return notApplicable(
        "PRE_ADOPTION_CERTIFICATION",
        "The certification predates the property's documented HOTMA implementation date.",
        {
          module_id: moduleId,
          mfh_program_subtype: programSubtype,
          property_hotma_implementation_date: adoptionDate.iso,
        },
      );
    }
    findingClassification =
      MFH_HOTMA_FINDING_CLASSIFICATION.preImplementationObservation;
  }

  return {
    resolution_status: "READY",
    determination_status: "READY_FOR_RULE_EVALUATION",
    rule_engine_authority: "ALLOWED",
    finding: "READY",
    finding_classification: findingClassification,
    module_id: moduleId,
    attachment: module.attachment,
    module_name: module.name,
    mfh_program_subtype: programSubtype,
    certification_effective_date: eventDate.iso,
    mandatory_compliance_date: MFH_HOTMA_MANDATORY_COMPLIANCE_DATE,
    authority_class: module.authority_class,
    source_ids: [...module.source_ids],
    human_approval_required: true,
    engine_build: MFH_HOTMA_ENGINE_BUILD,
  };
}

/**
 * Route all ten Attachments A-J using a shared property/certification context.
 */
export function classifyAllMfhHotmaModules(input = {}) {
  const classifications = MFH_HOTMA_RULE_MODULES.map((module) =>
    classifyMfhHotmaReview({ ...input, module_id: module.module_id }),
  );
  return {
    engine_build: MFH_HOTMA_ENGINE_BUILD,
    rule_pack_id: MFH_HOTMA_RULE_PACK.rule_pack_id,
    activation_status: MFH_HOTMA_RULE_PACK.activation_status,
    final_rule_effective_date: MFH_HOTMA_FINAL_RULE_EFFECTIVE_DATE,
    mandatory_compliance_date: MFH_HOTMA_MANDATORY_COMPLIANCE_DATE,
    module_count: MFH_HOTMA_RULE_MODULES.length,
    classifications,
    human_approval_required: true,
  };
}
