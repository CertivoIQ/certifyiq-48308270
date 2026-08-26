import { FEDERAL_PROGRAM_RULE_PACKS } from "./federal-program-rule-pack-registry.mjs";
import { VERIFIED_FY2026_FEDERAL_SOURCES } from "./fy2026-verified-federal-source-manifest.mjs";

export const FEDERAL_CONTROLLED_SOURCE_ACTIVATION_BUILD =
  "federal-controlled-source-activation-2026.08.25.1";

export const CONTROLLED_SOURCE_PROGRAMS = Object.freeze([
  "HOME",
  "HTF",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "PUBLIC_HOUSING",
  "HUD_MFH_PROJECT_BASED",
]);

const DATASET_BINDINGS = Object.freeze({
  HOME: Object.freeze([
    "HUD_HOME_INCOME_LIMITS_FY2026",
    "HUD_HOME_RENT_LIMITS_FY2026",
  ]),
  HTF: Object.freeze([]),
  HCV_TENANT_BASED: Object.freeze(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
  HUD_PBV: Object.freeze(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
  PUBLIC_HOUSING: Object.freeze(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
  HUD_MFH_PROJECT_BASED: Object.freeze(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
});

const SOURCE_CONTROL_PREFIX = "controlled_";
const SHA256 = /^[a-f0-9]{64}$/i;

function unique(values) {
  return [...new Set(values)].sort();
}

function normalizeProgram(program) {
  const value = String(program ?? "").trim().toUpperCase();
  if (!CONTROLLED_SOURCE_PROGRAMS.includes(value)) {
    throw new RangeError(`Unsupported controlled-source program: ${program}`);
  }
  return value;
}

function requiredAuthorityControls(program) {
  const pack = FEDERAL_PROGRAM_RULE_PACKS[program];
  return pack.requiredControls.filter((control) => control.startsWith(SOURCE_CONTROL_PREFIX));
}

function validApproval(approval) {
  return Boolean(
    approval &&
      typeof approval.approvedBy === "string" &&
      approval.approvedBy.trim() &&
      typeof approval.approvedAt === "string" &&
      !Number.isNaN(Date.parse(approval.approvedAt)),
  );
}

function validateDatasetReceipt(datasetId, receipt) {
  const expected = VERIFIED_FY2026_FEDERAL_SOURCES[datasetId];
  if (!expected) return [`unknown_dataset:${datasetId}`];
  if (!receipt) return [`missing_dataset_receipt:${datasetId}`];

  const errors = [];
  if (receipt.dataset_id !== datasetId) errors.push(`dataset_id:${datasetId}`);
  if (receipt.official_url !== expected.official_url) errors.push(`official_url:${datasetId}`);
  if (receipt.effective_from !== expected.effective_from) errors.push(`effective_from:${datasetId}`);
  if (!SHA256.test(String(receipt.source_sha256 ?? ""))) errors.push(`source_sha256_format:${datasetId}`);
  if (receipt.source_sha256 !== expected.sha256) errors.push(`source_sha256:${datasetId}`);
  if (Number(receipt.source_byte_size) !== Number(expected.byte_size)) {
    errors.push(`source_byte_size:${datasetId}`);
  }
  if (receipt.private_storage_verified !== true) errors.push(`private_storage_verified:${datasetId}`);
  if (receipt.parser_verified !== true) errors.push(`parser_verified:${datasetId}`);
  if (!SHA256.test(String(receipt.normalized_records_sha256 ?? ""))) {
    errors.push(`normalized_records_sha256:${datasetId}`);
  }
  if (receipt.geography_coverage_verified !== true) {
    errors.push(`geography_coverage_verified:${datasetId}`);
  }
  return errors;
}

function validateApprovals(approvals = []) {
  const valid = approvals.filter(validApproval);
  const approvers = unique(valid.map((approval) => approval.approvedBy.trim().toLowerCase()));
  return {
    valid,
    approvers,
    satisfied: approvers.length >= 2,
  };
}

export function evaluateFederalControlledSourceActivation(input = {}) {
  const program = normalizeProgram(input.program);
  const pack = FEDERAL_PROGRAM_RULE_PACKS[program];
  const datasetIds = DATASET_BINDINGS[program];
  const missingControls = requiredAuthorityControls(program).filter(
    (control) => input.authorityControls?.[control] !== true,
  );
  const datasetErrors = datasetIds.flatMap((datasetId) =>
    validateDatasetReceipt(datasetId, input.datasetReceipts?.[datasetId]),
  );
  const approvals = validateApprovals(input.approvals);
  const missing = [
    ...missingControls.map((control) => `authority_control:${control}`),
    ...datasetErrors,
    ...(approvals.satisfied ? [] : ["independent_two_person_approval"]),
  ];

  if (datasetIds.length === 0) {
    missing.push(`verified_dataset_binding:${program}`);
  }

  const normalizedMissing = unique(missing);
  const activationStatus = normalizedMissing.length === 0 ? "ACTIVE" : "BLOCKED";
  return Object.freeze({
    program,
    packId: pack.packId,
    activationStatus,
    ruleEngineAuthority: activationStatus === "ACTIVE" ? "SOURCE_AUTHORITY_ACTIVE" : "BLOCKED",
    substantiveRuleEvaluationAuthority: "SEPARATE_DETERMINISTIC_RULE_IMPLEMENTATION_REQUIRED",
    datasetIds: Object.freeze([...datasetIds]),
    requiredAuthorityControls: Object.freeze(requiredAuthorityControls(program)),
    approvedBy: Object.freeze([...approvals.approvers]),
    missing: Object.freeze(normalizedMissing),
    humanApprovalRequired: true,
    independentTwoPersonApprovalRequired: true,
  });
}

export function federalControlledSourceActivationSummary(input = {}) {
  const programs = input.programs ?? CONTROLLED_SOURCE_PROGRAMS;
  const results = programs.map((program) =>
    evaluateFederalControlledSourceActivation({
      ...input,
      ...(input.byProgram?.[program] ?? {}),
      program,
    }),
  );
  return Object.freeze({
    build: FEDERAL_CONTROLLED_SOURCE_ACTIVATION_BUILD,
    activePrograms: Object.freeze(results.filter((r) => r.activationStatus === "ACTIVE").map((r) => r.program)),
    blockedPrograms: Object.freeze(results.filter((r) => r.activationStatus === "BLOCKED").map((r) => r.program)),
    results: Object.freeze(results),
  });
}
