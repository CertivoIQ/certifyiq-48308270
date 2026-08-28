import { classifyPhaHotmaImplementation } from "./pha-hotma-implementation-engine.mjs";

export const PHA_50058_TRANSACTION_ROUTER_BUILD = "pha-50058-transaction-router-2026.08.1";

const PROGRAM_MAP = Object.freeze({
  hcv: "HCV_TENANT_BASED",
  pbv: "HUD_PBV",
  public_housing: "PUBLIC_HOUSING",
  mod_rehab: "MOD_REHAB",
});

const TRANSACTION_TYPES = new Set([
  "admission",
  "annual_reexamination",
  "interim_reexamination",
  "portability",
  "other",
]);

function blocked(reason_code, reason, missing_inputs = []) {
  return {
    status: "BLOCKED",
    reason_code,
    reason,
    missing_inputs,
    human_approval_required: true,
    router_build: PHA_50058_TRANSACTION_ROUTER_BUILD,
  };
}

export function routePha50058Transaction(input = {}) {
  const program = String(input.program ?? "").trim().toLowerCase();
  const mappedProgram = PROGRAM_MAP[program];
  if (!mappedProgram) {
    return blocked("PHA_50058_PROGRAM_REQUIRED", "A supported PHA program is required.", ["program"]);
  }

  const transactionType = String(input.transaction_type ?? "").trim().toLowerCase();
  if (!TRANSACTION_TYPES.has(transactionType)) {
    return blocked("PHA_50058_TRANSACTION_TYPE_REQUIRED", "A supported HUD-50058 transaction type is required.", ["transaction_type"]);
  }

  const core = classifyPhaHotmaImplementation({
    module_id: "PHA-HOTMA-FULL-SECTIONS-102-104",
    program: mappedProgram,
    program_applicability_validated: input.program_applicability_validated === true,
    pha_cohort: input.pha_hotma_cohort,
    transaction_effective_date: input.effective_date,
    controlled_source_release_approved: input.controlled_source_release_approved === true,
    current_rule_version_validated: input.current_rule_version_validated === true,
    source_status_conflict: input.source_status_conflict === true,
    full_hotma_policy_set_validated: input.full_hotma_policy_set_validated === true,
  });

  const reporting = classifyPhaHotmaImplementation({
    module_id: "PHA-HOTMA-HUD-50058-REPORTING-PATH",
    program: mappedProgram,
    program_applicability_validated: input.program_applicability_validated === true,
    pha_cohort: input.pha_hotma_cohort,
    transaction_effective_date: input.effective_date,
    controlled_source_release_approved: input.controlled_source_release_approved === true,
    current_rule_version_validated: input.current_rule_version_validated === true,
    source_status_conflict: input.source_status_conflict === true,
    hud_50058_reporting_path: input.hud_50058_reporting_path,
    reporting_path_validated: input.reporting_path_validated === true,
    software_compatibility_validated: input.software_compatibility_validated === true,
  });

  const classifications = [core, reporting];
  const guidancePending = classifications.find((item) => item.reason_code === "PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE");
  if (guidancePending) {
    return {
      status: "AWAITING_HUD_GUIDANCE",
      reason_code: guidancePending.reason_code,
      reason: guidancePending.reason,
      transaction_type: transactionType,
      program: mappedProgram,
      effective_date: input.effective_date,
      classifications,
      human_approval_required: true,
      router_build: PHA_50058_TRANSACTION_ROUTER_BUILD,
    };
  }

  const blockedClassification = classifications.find((item) => item.rule_engine_authority === "BLOCKED");
  if (blockedClassification) {
    return {
      status: "BLOCKED",
      reason_code: blockedClassification.reason_code,
      reason: blockedClassification.reason,
      missing_inputs: blockedClassification.missing_inputs ?? [],
      transaction_type: transactionType,
      program: mappedProgram,
      effective_date: input.effective_date,
      classifications,
      human_approval_required: true,
      router_build: PHA_50058_TRANSACTION_ROUTER_BUILD,
    };
  }

  const preImplementation = classifications.every((item) =>
    item.finding_classification === "PRE_IMPLEMENTATION_OBSERVATION" || item.rule_engine_authority === "NOT_APPLICABLE",
  );
  if (preImplementation) {
    return {
      status: "PRE_IMPLEMENTATION",
      transaction_type: transactionType,
      program: mappedProgram,
      effective_date: input.effective_date,
      classifications,
      human_approval_required: true,
      router_build: PHA_50058_TRANSACTION_ROUTER_BUILD,
    };
  }

  const notApplicable = classifications.every((item) => item.rule_engine_authority === "NOT_APPLICABLE");
  if (notApplicable) {
    return {
      status: "NOT_APPLICABLE",
      transaction_type: transactionType,
      program: mappedProgram,
      effective_date: input.effective_date,
      classifications,
      human_approval_required: true,
      router_build: PHA_50058_TRANSACTION_ROUTER_BUILD,
    };
  }

  return {
    status: "READY",
    transaction_type: transactionType,
    program: mappedProgram,
    effective_date: input.effective_date,
    classifications,
    human_approval_required: true,
    router_build: PHA_50058_TRANSACTION_ROUTER_BUILD,
  };
}
