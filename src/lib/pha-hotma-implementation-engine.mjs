/**
 * Deterministic PHA HOTMA implementation and HUD-50058 routing gate.
 *
 * The gate classifies authority, cohort, timing, and reporting-path readiness.
 * It does not infer PHA policy choices or issue substantive PASS/FAIL results.
 */
import PHA_HOTMA_RULE_PACK from "./pha-hotma-implementation-rules.json" with { type: "json" };

export const PHA_HOTMA_ENGINE_BUILD = "pha-hotma-implementation-engine-2026.08.1";
export const PHA_HOTMA_FULL_COMPLIANCE_DATE = "2027-01-01";

export const PHA_HOTMA_FINDING_CLASSIFICATION = Object.freeze({
  notApplicable: "NOT_APPLICABLE",
  preImplementationObservation: "PRE_IMPLEMENTATION_OBSERVATION",
  complianceFinding: "COMPLIANCE_FINDING",
  unableToDetermine: "UNABLE_TO_DETERMINE",
});

export const PHA_HOTMA_COHORTS = Object.freeze([
  "NON_MTW_NON_FRS",
  "INITIAL_MTW",
  "MTW_EXPANSION",
  "FRS_EXCLUSIVE",
]);

export const PHA_HOTMA_PROGRAMS = Object.freeze([
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "MOD_REHAB",
  "MOD_REHAB_SRO",
  "PUBLIC_HOUSING",
]);

export const PHA_HOTMA_REPORTING_PATHS = Object.freeze([
  "HUD_50058_2024",
  "HUD_50058_2020_ALTERNATIVE",
]);

const COHORT_SET = new Set(PHA_HOTMA_COHORTS);
const PROGRAM_SET = new Set(PHA_HOTMA_PROGRAMS);
const REPORTING_PATH_SET = new Set(PHA_HOTMA_REPORTING_PATHS);
const FUTURE_GUIDANCE_COHORTS = new Set([
  "INITIAL_MTW",
  "MTW_EXPANSION",
  "FRS_EXCLUSIVE",
]);
const FULL_IMPLEMENTATION_MODULES = new Set([
  "PHA-HOTMA-COHORT-AND-DEADLINE",
  "PHA-HOTMA-FULL-SECTIONS-102-104",
  "PHA-HOTMA-HUD-50058-REPORTING-PATH",
  "PHA-HOTMA-2020-ALTERNATIVE-INSTRUCTIONS",
]);

const freezeModule = (module) =>
  Object.freeze({
    ...module,
    applies_to_programs: Object.freeze([...(module.applies_to_programs ?? [])]),
    citations: Object.freeze([...(module.citations ?? [])]),
    evidence_fields: Object.freeze([...(module.evidence_fields ?? [])]),
    required_input_flags: Object.freeze([
      ...(module.required_input_flags ?? []),
    ]),
  });

export const PHA_HOTMA_IMPLEMENTATION_MODULES = Object.freeze(
  PHA_HOTMA_RULE_PACK.modules.map(freezeModule),
);
const MODULES_BY_ID = new Map(
  PHA_HOTMA_IMPLEMENTATION_MODULES.map((module) => [
    module.module_id,
    module,
  ]),
);

function blocked(code, reason, missing = [], details = {}) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    finding_classification:
      PHA_HOTMA_FINDING_CLASSIFICATION.unableToDetermine,
    reason_code: code,
    reason,
    missing_inputs: [...new Set(missing)].sort(),
    human_approval_required: true,
    engine_build: PHA_HOTMA_ENGINE_BUILD,
    ...details,
  };
}

function notApplicable(code, reason, details = {}) {
  return {
    resolution_status: "NOT_APPLICABLE",
    determination_status: "NOT_APPLICABLE",
    rule_engine_authority: "NOT_APPLICABLE",
    finding: "NOT_APPLICABLE",
    finding_classification: PHA_HOTMA_FINDING_CLASSIFICATION.notApplicable,
    reason_code: code,
    reason,
    human_approval_required: true,
    engine_build: PHA_HOTMA_ENGINE_BUILD,
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

function moduleDetails(module, program, cohort) {
  return {
    module_id: module.module_id,
    module_name: module.name,
    program,
    pha_cohort: cohort,
  };
}

/**
 * Classify one PHA HOTMA implementation module before substantive evaluation.
 */
export function classifyPhaHotmaImplementation(input = {}) {
  const moduleId = String(input.module_id ?? "");
  const module = MODULES_BY_ID.get(moduleId);
  if (!module) {
    return blocked(
      "PHA_HOTMA_MODULE_REQUIRED",
      "A registered PHA HOTMA implementation module is required.",
      ["module_id"],
    );
  }

  const program = String(input.program ?? "").trim().toUpperCase();
  if (!PROGRAM_SET.has(program)) {
    return blocked(
      "PHA_HOTMA_PROGRAM_REQUIRED",
      "The exact PIH-administered program must be validated before HOTMA implementation routing.",
      ["program"],
      { module_id: moduleId },
    );
  }
  if (input.program_applicability_validated !== true) {
    return blocked(
      "PHA_HOTMA_PROGRAM_APPLICABILITY_NOT_VALIDATED",
      "The PHA program applicability has not been validated.",
      ["program_applicability_validated"],
      { module_id: moduleId, program },
    );
  }
  if (!module.applies_to_programs.includes(program)) {
    return notApplicable(
      "PHA_HOTMA_MODULE_NOT_APPLICABLE",
      module.name + " does not apply to " + program + ".",
      { module_id: moduleId, program },
    );
  }

  const cohort = String(input.pha_cohort ?? "").trim().toUpperCase();
  if (!COHORT_SET.has(cohort)) {
    return blocked(
      "PHA_HOTMA_COHORT_REQUIRED",
      "The PHA must be classified as non-MTW/non-FRS, initial MTW, MTW Expansion, or FRS-exclusive.",
      ["pha_cohort"],
      { module_id: moduleId, program },
    );
  }

  const eventDate = parseIsoDate(input.transaction_effective_date);
  if (!eventDate) {
    return blocked(
      "PHA_TRANSACTION_EFFECTIVE_DATE_REQUIRED",
      "A valid HUD-50058 transaction effective date is required for HOTMA enforcement routing.",
      ["transaction_effective_date"],
      moduleDetails(module, program, cohort),
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
      "CONTROLLED_PHA_HOTMA_AUTHORITY_REQUIRED",
      "Approved, current, version-controlled PIH HOTMA authority is required before implementation routing.",
      sourceFailures,
      moduleDetails(module, program, cohort),
    );
  }

  const requirementDate = parseIsoDate(module.requirement_effective_date);
  const isFullImplementationModule = FULL_IMPLEMENTATION_MODULES.has(moduleId);

  if (isFullImplementationModule && FUTURE_GUIDANCE_COHORTS.has(cohort)) {
    return blocked(
      "PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE",
      "HUD has not yet established the full Sections 102 and 104 compliance deadline for this MTW or FRS cohort.",
      ["future_hud_deadline_guidance"],
      {
        ...moduleDetails(module, program, cohort),
        transaction_effective_date: eventDate.iso,
      },
    );
  }

  if (moduleId === "PHA-HOTMA-2020-ALTERNATIVE-INSTRUCTIONS") {
    const reportingPath = String(input.hud_50058_reporting_path ?? "")
      .trim()
      .toUpperCase();
    if (!reportingPath) {
      return blocked(
        "PHA_HOTMA_REPORTING_PATH_REQUIRED",
        "The HUD-50058 reporting path must be declared before alternative-instruction applicability can be determined.",
        ["hud_50058_reporting_path"],
        moduleDetails(module, program, cohort),
      );
    }
    if (!REPORTING_PATH_SET.has(reportingPath)) {
      return blocked(
        "PHA_HOTMA_REPORTING_PATH_INVALID",
        "The declared HUD-50058 reporting path is not registered.",
        ["hud_50058_reporting_path"],
        moduleDetails(module, program, cohort),
      );
    }
    if (reportingPath === "HUD_50058_2024") {
      return notApplicable(
        "PHA_HOTMA_ALTERNATIVE_INSTRUCTIONS_NOT_APPLICABLE",
        "The temporary 2020 HUD-50058 alternative instructions do not apply to the 2024 HUD-50058 reporting path.",
        {
          ...moduleDetails(module, program, cohort),
          hud_50058_reporting_path: reportingPath,
        },
      );
    }
  }

  if (moduleId === "PHA-HOTMA-HUD-50058-REPORTING-PATH") {
    const reportingPath = String(input.hud_50058_reporting_path ?? "")
      .trim()
      .toUpperCase();
    if (!REPORTING_PATH_SET.has(reportingPath)) {
      return blocked(
        "PHA_HOTMA_REPORTING_PATH_REQUIRED",
        "A registered 2024 HUD-50058 or 2020 alternative reporting path is required.",
        ["hud_50058_reporting_path"],
        moduleDetails(module, program, cohort),
      );
    }
  }

  const missingControls = module.required_input_flags.filter(
    (field) => input[field] !== true,
  );
  if (missingControls.length) {
    return blocked(
      "PHA_HOTMA_MODULE_CONTROL_REQUIRED",
      "A module-specific policy, form, software, or reporting control is unresolved.",
      missingControls,
      moduleDetails(module, program, cohort),
    );
  }

  if (eventDate.timestamp < requirementDate.timestamp) {
    if (!isFullImplementationModule) {
      return notApplicable(
        "PRE_REQUIREMENT_EFFECTIVE_TRANSACTION",
        "The transaction predates this PHA HOTMA implementation requirement.",
        {
          ...moduleDetails(module, program, cohort),
          transaction_effective_date: eventDate.iso,
          requirement_effective_date: requirementDate.iso,
        },
      );
    }
    return {
      resolution_status: "READY",
      determination_status: "READY_FOR_READINESS_REVIEW",
      rule_engine_authority: "ALLOWED",
      finding: "READY",
      finding_classification:
        PHA_HOTMA_FINDING_CLASSIFICATION.preImplementationObservation,
      ...moduleDetails(module, program, cohort),
      transaction_effective_date: eventDate.iso,
      requirement_effective_date: requirementDate.iso,
      source_ids: moduleId === "PHA-HOTMA-2020-ALTERNATIVE-INSTRUCTIONS"
        ? ["HUD-NOTICE-PIH-2026-15"]
        : ["HUD-NOTICE-PIH-2026-15"],
      human_approval_required: true,
      engine_build: PHA_HOTMA_ENGINE_BUILD,
    };
  }

  return {
    resolution_status: "READY",
    determination_status: "READY_FOR_RULE_EVALUATION",
    rule_engine_authority: "ALLOWED",
    finding: "READY",
    finding_classification:
      PHA_HOTMA_FINDING_CLASSIFICATION.complianceFinding,
    ...moduleDetails(module, program, cohort),
    transaction_effective_date: eventDate.iso,
    requirement_effective_date: requirementDate.iso,
    source_ids: ["HUD-NOTICE-PIH-2026-15"],
    human_approval_required: true,
    engine_build: PHA_HOTMA_ENGINE_BUILD,
  };
}

/**
 * Route all PHA implementation modules using a shared program/cohort context.
 */
export function classifyAllPhaHotmaImplementationModules(input = {}) {
  const classifications = PHA_HOTMA_IMPLEMENTATION_MODULES.map((module) =>
    classifyPhaHotmaImplementation({ ...input, module_id: module.module_id }),
  );
  return {
    engine_build: PHA_HOTMA_ENGINE_BUILD,
    rule_pack_id: PHA_HOTMA_RULE_PACK.rule_pack_id,
    activation_status: PHA_HOTMA_RULE_PACK.activation_status,
    full_compliance_date: PHA_HOTMA_FULL_COMPLIANCE_DATE,
    module_count: PHA_HOTMA_IMPLEMENTATION_MODULES.length,
    classifications,
    human_approval_required: true,
  };
}
