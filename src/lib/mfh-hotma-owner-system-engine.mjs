/**
 * Deterministic HUD Multifamily HOTMA owner-policy and system control gate.
 *
 * This engine validates operational evidence readiness. It does not infer owner
 * policy choices, authorize rent overrides from guidance alone, or issue PASS/FAIL.
 */
import CONTROL_PACK from "./mfh-hotma-owner-system-controls.json" with { type: "json" };
import {
  MFH_HOTMA_FINAL_RULE_EFFECTIVE_DATE,
  MFH_HOTMA_FINDING_CLASSIFICATION,
  MFH_HOTMA_MANDATORY_COMPLIANCE_DATE,
  MFH_HOTMA_PROGRAM_SUBTYPES,
} from "./mfh-hotma-rule-engine.mjs";

export const MFH_HOTMA_OWNER_SYSTEM_ENGINE_BUILD =
  "mfh-hotma-owner-system-engine-2026.08.2";

const PROGRAMS = new Set(MFH_HOTMA_PROGRAM_SUBTYPES);
const MODULES = Object.freeze(
  CONTROL_PACK.modules.map((module) =>
    Object.freeze({
      ...module,
      required_evidence_fields: Object.freeze([
        ...(module.required_evidence_fields ?? []),
      ]),
      required_input_flags: Object.freeze([
        ...(module.required_input_flags ?? []),
      ]),
    }),
  ),
);
const MODULES_BY_ID = new Map(MODULES.map((module) => [module.module_id, module]));

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) return null;
  return { iso: String(value), timestamp };
}

function blocked(code, reason, missing = [], details = {}) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    finding_classification: MFH_HOTMA_FINDING_CLASSIFICATION.unableToDetermine,
    reason_code: code,
    reason,
    missing_inputs: [...new Set(missing)].sort(),
    human_approval_required: true,
    engine_build: MFH_HOTMA_OWNER_SYSTEM_ENGINE_BUILD,
    ...details,
  };
}

function notApplicable(code, reason, details = {}) {
  return {
    resolution_status: "NOT_APPLICABLE",
    determination_status: "NOT_APPLICABLE",
    rule_engine_authority: "NOT_APPLICABLE",
    finding: "NOT_APPLICABLE",
    finding_classification: MFH_HOTMA_FINDING_CLASSIFICATION.notApplicable,
    reason_code: code,
    reason,
    human_approval_required: true,
    engine_build: MFH_HOTMA_OWNER_SYSTEM_ENGINE_BUILD,
    ...details,
  };
}

function detailsFor(module, subtype) {
  return {
    module_id: module.module_id,
    module_name: module.name,
    mfh_program_subtype: subtype,
  };
}

export function classifyMfhHotmaOwnerSystemControl(input = {}) {
  const module = MODULES_BY_ID.get(String(input.module_id ?? ""));
  if (!module) {
    return blocked(
      "MFH_OWNER_SYSTEM_MODULE_REQUIRED",
      "A registered Multifamily owner-policy or system module is required.",
      ["module_id"],
    );
  }

  const subtype = String(input.mfh_program_subtype ?? "").trim().toUpperCase();
  if (!PROGRAMS.has(subtype)) {
    return blocked(
      "MFH_PROGRAM_SUBTYPE_REQUIRED",
      "The exact HUD Multifamily program subtype must be validated.",
      ["mfh_program_subtype"],
      { module_id: module.module_id },
    );
  }
  if (input.program_applicability_validated !== true) {
    return blocked(
      "MFH_PROGRAM_APPLICABILITY_NOT_VALIDATED",
      "HUD Multifamily program applicability has not been validated.",
      ["program_applicability_validated"],
      detailsFor(module, subtype),
    );
  }

  const eventDate = parseIsoDate(input.certification_effective_date);
  if (!eventDate) {
    return blocked(
      "CERTIFICATION_EFFECTIVE_DATE_REQUIRED",
      "A valid certification effective date is required.",
      ["certification_effective_date"],
      detailsFor(module, subtype),
    );
  }

  const finalRuleEffective = parseIsoDate(MFH_HOTMA_FINAL_RULE_EFFECTIVE_DATE);
  if (eventDate.timestamp < finalRuleEffective.timestamp) {
    return notApplicable(
      "PRE_HOTMA_FINAL_RULE_CERTIFICATION",
      "The certification predates the HOTMA final-rule effective date.",
      detailsFor(module, subtype),
    );
  }

  const sourceFailures = [];
  if (input.controlled_source_release_approved !== true)
    sourceFailures.push("controlled_source_release_approved");
  if (input.current_rule_version_validated !== true)
    sourceFailures.push("current_rule_version_validated");
  if (input.source_status_conflict === true)
    sourceFailures.push("source_status_conflict");
  if (sourceFailures.length) {
    return blocked(
      "CONTROLLED_MFH_OPERATIONAL_AUTHORITY_REQUIRED",
      "Approved, current, version-controlled HUD authority is required.",
      sourceFailures,
      detailsFor(module, subtype),
    );
  }

  const implementationDate = parseIsoDate(input.property_hotma_implementation_date);
  if (!implementationDate) {
    return blocked(
      "PROPERTY_HOTMA_IMPLEMENTATION_DATE_REQUIRED",
      "The documented property HOTMA implementation date is required.",
      ["property_hotma_implementation_date"],
      detailsFor(module, subtype),
    );
  }
  const mandatory = parseIsoDate(MFH_HOTMA_MANDATORY_COMPLIANCE_DATE);
  if (eventDate.timestamp < implementationDate.timestamp) {
    if (eventDate.timestamp < mandatory.timestamp) {
      return notApplicable(
        "PRE_ADOPTION_CERTIFICATION",
        "The certification predates the property's documented HOTMA implementation.",
        {
          ...detailsFor(module, subtype),
          property_hotma_implementation_date: implementationDate.iso,
        },
      );
    }
    return blocked(
      "POST_MANDATORY_IMPLEMENTATION_DATE_CONFLICT",
      "A property implementation date after a post-mandatory certification cannot bypass HOTMA operational controls.",
      ["property_hotma_implementation_date"],
      {
        ...detailsFor(module, subtype),
        certification_effective_date: eventDate.iso,
        property_hotma_implementation_date: implementationDate.iso,
      },
    );
  }

  const evidence =
    input.evidence && typeof input.evidence === "object" && !Array.isArray(input.evidence)
      ? input.evidence
      : {};
  const missingEvidence = module.required_evidence_fields.filter(
    (field) => evidence[field] == null || String(evidence[field]).trim() === "",
  );
  if (missingEvidence.length) {
    return blocked(
      "MFH_OWNER_SYSTEM_EVIDENCE_REQUIRED",
      "Controlled owner-policy, tenant-file, lease, notice, or system evidence is incomplete.",
      missingEvidence.map((field) => "evidence." + field),
      detailsFor(module, subtype),
    );
  }

  const missingFlags = module.required_input_flags.filter(
    (field) => input[field] !== true,
  );
  if (missingFlags.length) {
    return blocked(
      "MFH_OWNER_SYSTEM_VALIDATION_REQUIRED",
      "One or more operational validations remain unresolved.",
      missingFlags,
      detailsFor(module, subtype),
    );
  }

  if (
    module.guidance_cannot_independently_authorize_finding === true &&
    input.rent_override_supported_only_by_guidance === true
  ) {
    return blocked(
      "RENT_OVERRIDE_PROPERTY_AUTHORITY_REQUIRED",
      "HUD guidance alone cannot authorize a property rent override finding; property-specific authority and approval evidence are required.",
      ["property_specific_rent_override_authority"],
      detailsFor(module, subtype),
    );
  }

  return {
    resolution_status: "READY",
    determination_status:
      eventDate.timestamp < mandatory.timestamp
        ? "READY_FOR_READINESS_REVIEW"
        : "READY_FOR_RULE_EVALUATION",
    rule_engine_authority: "ALLOWED",
    finding: "READY",
    finding_classification:
      eventDate.timestamp < mandatory.timestamp
        ? MFH_HOTMA_FINDING_CLASSIFICATION.preImplementationObservation
        : MFH_HOTMA_FINDING_CLASSIFICATION.complianceFinding,
    ...detailsFor(module, subtype),
    certification_effective_date: eventDate.iso,
    property_hotma_implementation_date: implementationDate.iso,
    source_ids: [...CONTROL_PACK.authority],
    human_approval_required: true,
    engine_build: MFH_HOTMA_OWNER_SYSTEM_ENGINE_BUILD,
  };
}

export function classifyAllMfhHotmaOwnerSystemControls(input = {}) {
  const classifications = MODULES.map((module) =>
    classifyMfhHotmaOwnerSystemControl({ ...input, module_id: module.module_id }),
  );
  return {
    engine_build: MFH_HOTMA_OWNER_SYSTEM_ENGINE_BUILD,
    rule_pack_id: CONTROL_PACK.rule_pack_id,
    rule_pack_version: CONTROL_PACK.version,
    activation_status: CONTROL_PACK.activation_status,
    module_count: MODULES.length,
    classifications,
    human_approval_required: true,
  };
}
