/**
 * Deterministic Test #58 tenant-file eligibility reconciliation.
 *
 * This module does not extract facts and does not let one housing program's
 * income, asset, deduction, or student determination stand in for another.
 * It reconciles validated document evidence and program-specific handoffs,
 * then returns PASS, FAIL, or UNABLE_TO_DETERMINE for agent review.
 */

import {
  validateFy2026IncomeLimitProgramHandoff,
  validateFy2026IncomeLimitSelection,
} from "./fy2026-income-limit-ingestion.mjs";

export const TENANT_ELIGIBILITY_RULE_ID =
  "FED-TENANT-FILE-ELIGIBILITY-RECONCILIATION-001";
export const TENANT_ELIGIBILITY_ENGINE_BUILD =
  "tenant-file-eligibility-engine-2026.08.3";

const PROGRAM_CODES = new Set([
  "LIHTC",
  "HOME",
  "HTF",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "RURAL_DEVELOPMENT",
  "TAX_EXEMPT_BOND",
  "STATE_HFA",
  "LOCAL_PROGRAM",
]);

const CERTIFICATION_TYPES = new Set(["INITIAL", "ANNUAL", "INTERIM"]);
const FINDINGS = new Set(["PASS", "FAIL", "NOT_DETERMINED"]);
const INCOME_AVERAGING_DESIGNATIONS = new Set([20, 30, 40, 50, 60, 70, 80]);

const REQUIRED_PROGRAM_EVIDENCE_KINDS = Object.freeze([
  "annual_income",
  "net_family_assets",
  "deductions",
  "student_status",
]);

// State and local scope stays blocked until a reviewed release is registered here.
const APPROVED_STATE_PACKS = Object.freeze({});

const STUDENT_RULE_BASIS = Object.freeze({
  LIHTC: "LIHTC_IRC_42_FULL_TIME_STUDENT_HOUSEHOLD",
  TAX_EXEMPT_BOND: "LIHTC_IRC_42_FULL_TIME_STUDENT_HOUSEHOLD",
  HCV_TENANT_BASED: "HUD_SECTION_8_HIGHER_EDUCATION_STUDENT_24_CFR_5_612",
  HUD_PBV: "HUD_SECTION_8_HIGHER_EDUCATION_STUDENT_24_CFR_5_612",
  HUD_MFH_PROJECT_BASED:
    "HUD_SECTION_8_HIGHER_EDUCATION_STUDENT_24_CFR_5_612",
  HOME: "HOME_WRITTEN_AGREEMENT_AND_APPLICABLE_PROGRAM",
  HTF: "HTF_WRITTEN_AGREEMENT_AND_APPLICABLE_PROGRAM",
  RURAL_DEVELOPMENT: "RD_AGENCY_TENANT_ELIGIBILITY",
  STATE_HFA: "VALIDATED_STATE_PACK_STUDENT_RULE",
  LOCAL_PROGRAM: "VALIDATED_LOCAL_PROGRAM_STUDENT_RULE",
});

const PROGRAM_DATASET_FAMILIES = Object.freeze({
  LIHTC: new Set([
    "HUD_MTSP_LIMITS_FY2026",
    "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
  ]),
  TAX_EXEMPT_BOND: new Set([
    "HUD_MTSP_LIMITS_FY2026",
    "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
  ]),
  HOME: new Set(["HUD_HOME_INCOME_LIMITS_FY2026"]),
  HTF: new Set(["HUD_HTF_INCOME_LIMITS_FY2026"]),
  HCV_TENANT_BASED: new Set(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
  HUD_PBV: new Set(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
  HUD_MFH_PROJECT_BASED: new Set(["HUD_SECTION8_INCOME_LIMITS_FY2026"]),
  RURAL_DEVELOPMENT: new Set(["USDA_RD_INCOME_LIMITS_FY2026"]),
});

const APPROVED_DATASETS = Object.freeze({
  HUD_MTSP_LIMITS_FY2026: {
    active: true,
    sha256: "fbc0af877e610d9cd3d9192febc6d4827319874605adc8897ca95366afac3465",
    record_count: 4764,
    effective_from: "2026-05-01",
  },
  HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18: {
    active: true,
    sha256: "54917d23269060f85eeac45ba429b1ce1b157c7dd51a1ce975e5b0293a5ce8ed",
    record_count: 4764,
    effective_from: "2026-05-01",
  },
  HUD_HOME_RENT_LIMITS_FY2026: {
    active: true,
    sha256: "3082bd081727dea71dd62abcb811e3d26ce605f1f645fd5cd8dbcb76e8d4f133",
    record_count: 4764,
    effective_from: "2026-06-01",
  },
  HUD_HOME_INCOME_LIMITS_FY2026: { active: false },
  HUD_HTF_INCOME_LIMITS_FY2026: { active: false },
  HUD_SECTION8_INCOME_LIMITS_FY2026: { active: false },
  USDA_RD_INCOME_LIMITS_FY2026: { active: false },
});

function uniqueSorted(values = []) {
  return [...new Set(values.map(String))].sort();
}

function blocked(code, reason, missing = [], details = {}) {
  return {
    resolution_status: "NOT_DETERMINED",
    determination_status: "NOT_DETERMINED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: code,
    reason,
    missing_inputs: uniqueSorted(missing),
    human_approval_required: true,
    agent_approval_required: true,
    ...details,
  };
}

function parseIsoDate(value, field) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a real calendar date`);
  }
  return text;
}

function moneyToCents(value, field) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`${field} must be a non-negative decimal amount`);
  }
  const [whole, fraction = ""] = text.split(".");
  const padded = `${fraction}000`;
  let cents = BigInt(whole) * 100n + BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  return cents;
}

function formatCents(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

/** Normalize spreadsheet decimal artifacts to a whole dollar, never to $50. */
export function normalizeIncomeLimitDollar(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error("income limit must be a non-negative decimal amount");
  }
  const [whole, fraction = ""] = text.split(".");
  const roundUp = Number(fraction[0] ?? "0") >= 5;
  return String(BigInt(whole) + (roundUp ? 1n : 0n));
}

function stableValue(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].map(String).sort());
  if (value && typeof value === "object") {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, stableValue(item)]),
      ),
    );
  }
  return `${typeof value}:${String(value)}`;
}

function statePackUsable(pack, eventDate, programs) {
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return false;
  const approved = APPROVED_STATE_PACKS[String(pack.pack_id ?? "")];
  if (!approved || approved.active !== true) return false;

  let effectiveFrom;
  let effectiveTo;
  try {
    effectiveFrom = parseIsoDate(approved.effective_from, "approved_state_pack.effective_from");
    effectiveTo = approved.effective_to
      ? parseIsoDate(approved.effective_to, "approved_state_pack.effective_to")
      : null;
  } catch {
    return false;
  }

  const requestedStatePrograms = programs.filter((program) =>
    ["STATE_HFA", "LOCAL_PROGRAM"].includes(program),
  );
  return Boolean(
    pack.status === "validated" &&
      String(pack.jurisdiction ?? "").toUpperCase() ===
        String(approved.jurisdiction).toUpperCase() &&
      String(pack.version ?? "") === String(approved.version) &&
      String(pack.sha256 ?? "") === String(approved.sha256) &&
      String(pack.approvedBy ?? "") === String(approved.approved_by) &&
      String(pack.effectiveFrom ?? "") === effectiveFrom &&
      Number(pack.validatedRuleCount) === Number(approved.validated_rule_count) &&
      eventDate >= effectiveFrom &&
      (!effectiveTo || eventDate <= effectiveTo) &&
      requestedStatePrograms.every((program) =>
        approved.program_codes.includes(program),
      ),
  );
}

function requiredEvidenceFieldsForPrograms(programs) {
  return [
    "household_roster",
    ...programs.flatMap((program) =>
      REQUIRED_PROGRAM_EVIDENCE_KINDS.map((kind) => `${kind}:${program}`),
    ),
  ];
}

function validateDataset(source, prefix, eventDate) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return blocked(
      "INCOME_LIMIT_SOURCE_MISSING",
      "Every program income comparison requires a controlled income-limit source.",
      [prefix],
    );
  }
  const requiredTrue = [
    "source_controlled",
    "file_hash_validated",
    "record_count_validated",
    "geography_validated",
    "household_size_validated",
    "effective_date_validated",
    "normalization_validated",
  ].filter((field) => source[field] !== true);
  const requiredValues = [
    "dataset_id",
    "sha256",
    "record_count",
    "effective_from",
    "geography_key",
    "household_size",
    "raw_limit_value",
    "normalized_limit_amount",
  ].filter((field) => source[field] === null || source[field] === undefined);
  if (requiredTrue.length || requiredValues.length) {
    return blocked(
      "INCOME_LIMIT_SOURCE_NOT_VALIDATED",
      "Income limits require validated file, geography, household-size, effective-date, and normalization provenance.",
      [...requiredTrue, ...requiredValues].map((field) => `${prefix}.${field}`),
    );
  }

  const datasetId = String(source.dataset_id);
  const approved = APPROVED_DATASETS[datasetId];
  if (!approved) {
    return blocked(
      "UNREGISTERED_INCOME_LIMIT_SOURCE",
      "The income-limit dataset is not registered in the controlled source pack.",
      [`${prefix}.dataset_id`],
    );
  }
  if (approved.active !== true) {
    return blocked(
      "CONTROLLED_DATASET_NOT_ACTIVATED",
      "The income-limit dataset remains blocked until its source bytes, hash, structure, and effective-date coverage are validated.",
      [`${prefix}.dataset_id`],
    );
  }
  if (approved) {
    const mismatches = [];
    if (String(source.sha256) !== approved.sha256) mismatches.push(`${prefix}.sha256`);
    if (Number(source.record_count) !== approved.record_count) {
      mismatches.push(`${prefix}.record_count`);
    }
    if (String(source.effective_from) !== approved.effective_from) {
      mismatches.push(`${prefix}.effective_from`);
    }
    if (mismatches.length) {
      return blocked(
        "CONTROLLED_DATASET_IDENTITY_CONFLICT",
        "The supplied dataset metadata does not match the approved controlled source.",
        mismatches,
      );
    }
  }

  let effectiveFrom;
  try {
    effectiveFrom = parseIsoDate(source.effective_from, `${prefix}.effective_from`);
  } catch (error) {
    return blocked("INVALID_INCOME_LIMIT_EFFECTIVE_DATE", error.message, [prefix]);
  }
  if (eventDate < effectiveFrom) {
    return blocked(
      "INCOME_LIMIT_NOT_EFFECTIVE_FOR_EVENT",
      "The selected income-limit source was not effective for the certification event.",
      [`${prefix}.effective_from`],
    );
  }

  let normalized;
  try {
    normalized = normalizeIncomeLimitDollar(source.raw_limit_value);
  } catch (error) {
    return blocked("INVALID_INCOME_LIMIT_VALUE", error.message, [prefix]);
  }
  if (normalized !== String(source.normalized_limit_amount)) {
    return blocked(
      "INCOME_LIMIT_NORMALIZATION_CONFLICT",
      "The exact-dollar normalized limit does not match the source value.",
      [`${prefix}.normalized_limit_amount`],
    );
  }
  return { dataset_id: datasetId, normalized_limit_amount: normalized };
}

function validateDocuments(input, eventDate) {
  if (!Array.isArray(input.documents) || !input.documents.length) {
    return { error: blocked("TENANT_FILE_DOCUMENT_INVENTORY_MISSING", "The tenant file requires a structured document inventory.", ["documents"]) };
  }
  const expectedMembers = uniqueSorted(input.household_member_ids);
  const documentIds = new Set();
  const types = new Set();
  for (const [index, document] of input.documents.entries()) {
    const prefix = `documents[${index}]`;
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return { error: blocked("INVALID_TENANT_FILE_DOCUMENT", "Each document must be a structured record.", [prefix]) };
    }
    const missing = ["document_id", "document_type", "household_id", "effective_date", "household_member_ids"].filter(
      (field) => document[field] === null || document[field] === undefined,
    );
    const unvalidated = ["source_validated", "document_complete", "current_for_event", "identity_validated"].filter(
      (field) => document[field] !== true,
    );
    if (missing.length || unvalidated.length) {
      return { error: blocked("TENANT_FILE_DOCUMENT_NOT_VALIDATED", "Each relied-on document must be complete, current, source-validated, and identity-linked.", [...missing, ...unvalidated].map((field) => `${prefix}.${field}`)) };
    }
    const id = String(document.document_id);
    if (documentIds.has(id)) {
      return { error: blocked("DUPLICATE_TENANT_FILE_DOCUMENT", "Document identifiers must be unique.", [id]) };
    }
    documentIds.add(id);
    types.add(String(document.document_type).toUpperCase());
    if (String(document.household_id) !== String(input.household_id)) {
      return { error: blocked("TENANT_FILE_HOUSEHOLD_IDENTITY_CONFLICT", "A document belongs to a different household.", [`${prefix}.household_id`]) };
    }
    if (stableValue(document.household_member_ids) !== stableValue(expectedMembers)) {
      return { error: blocked("HOUSEHOLD_ROSTER_CONFLICT", "The household roster conflicts across tenant-file documents.", [`${prefix}.household_member_ids`]) };
    }
    try {
      const effective = parseIsoDate(document.effective_date, `${prefix}.effective_date`);
      if (effective > eventDate) {
        return { error: blocked("TENANT_FILE_DOCUMENT_AFTER_EVENT_DATE", "A relied-on document postdates the certification event.", [`${prefix}.effective_date`]) };
      }
    } catch (error) {
      return { error: blocked("INVALID_TENANT_FILE_DOCUMENT_DATE", error.message, [prefix]) };
    }
  }

  const requiredTypes = new Set(["TENANT_APPLICATION", "TENANT_INCOME_CERTIFICATION", "LEASE"]);
  if (input.program_inventory.some((code) => ["HCV_TENANT_BASED", "HUD_PBV", "HUD_MFH_PROJECT_BASED"].includes(String(code).toUpperCase()))) {
    requiredTypes.add("HAP_CONTRACT");
  }
  const missingTypes = [...requiredTypes].filter((type) => !types.has(type));
  if (missingTypes.length) {
    return { error: blocked("REQUIRED_TENANT_FILE_DOCUMENT_MISSING", "The complete tenant file is missing a required certification, application, lease, or HAP document.", missingTypes) };
  }
  return { documentIds, types };
}

function reconcileEvidence(input, documentIds) {
  if (!Array.isArray(input.required_evidence_fields) || !input.required_evidence_fields.length) {
    return { error: blocked("REQUIRED_EVIDENCE_FIELD_INVENTORY_MISSING", "The gate requires an explicit inventory of income, asset, deduction, and eligibility fields.", ["required_evidence_fields"]) };
  }
  const declaredFields = uniqueSorted(input.required_evidence_fields);
  const mandatoryFields = requiredEvidenceFieldsForPrograms(input.program_inventory);
  const omittedMandatoryFields = mandatoryFields.filter(
    (field) => !declaredFields.includes(field),
  );
  if (omittedMandatoryFields.length) {
    return { error: blocked("REQUIRED_ELIGIBILITY_EVIDENCE_SCOPE_MISSING", "The evidence inventory must include household roster plus program-specific income, asset, deduction, and student fields.", omittedMandatoryFields) };
  }
  const fieldsToReconcile = uniqueSorted([...declaredFields, ...mandatoryFields]);
  if (!Array.isArray(input.evidence)) {
    return { error: blocked("TENANT_FILE_EVIDENCE_INVALID", "Evidence must be a structured list.", ["evidence"]) };
  }
  const byField = new Map();
  for (const [index, item] of input.evidence.entries()) {
    const prefix = `evidence[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: blocked("INVALID_TENANT_FILE_EVIDENCE", "Each evidence item must be a structured record.", [prefix]) };
    }
    const missing = ["field", "value", "source_document_id"].filter(
      (field) => item[field] === null || item[field] === undefined,
    );
    const unvalidated = ["source_validated", "value_validated", "current_for_event"].filter(
      (field) => item[field] !== true,
    );
    if (missing.length || unvalidated.length) {
      return { error: blocked("TENANT_FILE_EVIDENCE_NOT_VALIDATED", "Every relied-on fact requires validated value, source, and event-date evidence.", [...missing, ...unvalidated].map((field) => `${prefix}.${field}`)) };
    }
    if (!documentIds.has(String(item.source_document_id))) {
      return { error: blocked("EVIDENCE_SOURCE_OUTSIDE_TENANT_FILE", "Evidence cites a document outside the validated tenant-file inventory.", [`${prefix}.source_document_id`]) };
    }
    const field = String(item.field);
    const entries = byField.get(field) ?? [];
    entries.push(item);
    byField.set(field, entries);
  }
  const missingFields = fieldsToReconcile.filter((field) => !byField.has(field));
  if (missingFields.length) {
    return { error: blocked("REQUIRED_TENANT_FILE_EVIDENCE_MISSING", "One or more required tenant-file facts are missing.", missingFields) };
  }
  const conflicts = [];
  const resolved = {};
  for (const field of fieldsToReconcile) {
    const entries = byField.get(field);
    const values = new Set(entries.map((entry) => stableValue(entry.value)));
    if (values.size !== 1) conflicts.push(field);
    else resolved[field] = entries[0].value;
  }
  if (conflicts.length) {
    return { error: blocked("CONFLICTING_TENANT_FILE_EVIDENCE", "Conflicting source values must be resolved before an eligibility determination.", conflicts) };
  }
  return { resolved };
}

function validateProgramDetermination(
  item,
  index,
  input,
  eventDate,
  resolvedEvidence,
) {
  const prefix = `program_determinations[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { error: blocked("INVALID_PROGRAM_ELIGIBILITY_DETERMINATION", "Each program determination must be a structured record.", [prefix]) };
  }
  const program = String(item.program_code ?? "").toUpperCase();
  if (!PROGRAM_CODES.has(program)) {
    return { error: blocked("UNRECOGNIZED_ELIGIBILITY_PROGRAM", "The program eligibility branch is not recognized.", [`${prefix}.program_code`]) };
  }
  const requiredTrue = [
    "income_definition_validated",
    "calculation_validated",
    "household_roster_validated",
    "student_rule_validated",
    "asset_rule_applicability_validated",
    "program_authority_validated",
  ].filter((field) => item[field] !== true);
  const requiredValues = [
    "annual_income",
    "income_definition",
    "income_limit_source",
    "student_status",
    "asset_test",
  ].filter((field) => item[field] === null || item[field] === undefined);
  if (requiredTrue.length || requiredValues.length) {
    return { error: blocked("PROGRAM_ELIGIBILITY_HANDOFF_NOT_VALIDATED", "Each program requires its own validated income definition, calculation, student rule, asset applicability, and authority.", [...requiredTrue, ...requiredValues].map((field) => `${prefix}.${field}`)) };
  }
  if (stableValue(item.household_member_ids) !== stableValue(input.household_member_ids)) {
    return { error: blocked("PROGRAM_HOUSEHOLD_ROSTER_CONFLICT", "A program determination used a different household roster.", [`${prefix}.household_member_ids`]) };
  }

  const incomeEvidenceField = `annual_income:${program}`;
  let handoffIncomeCents;
  let evidenceIncomeCents;
  try {
    handoffIncomeCents = moneyToCents(item.annual_income, `${prefix}.annual_income`);
    evidenceIncomeCents = moneyToCents(
      resolvedEvidence[incomeEvidenceField],
      `resolved_evidence.${incomeEvidenceField}`,
    );
  } catch (error) {
    return { error: blocked("INVALID_PROGRAM_INCOME_EVIDENCE", error.message, [incomeEvidenceField]) };
  }
  if (handoffIncomeCents !== evidenceIncomeCents) {
    return { error: blocked("PROGRAM_INCOME_EVIDENCE_CONFLICT", "The program income calculation does not match the reconciled tenant-file evidence.", [`${prefix}.annual_income`, incomeEvidenceField]) };
  }

  const source = validateDataset(item.income_limit_source, `${prefix}.income_limit_source`, eventDate);
  if (source.finding === "UNABLE_TO_DETERMINE") return { error: source };
  const allowedDatasets = PROGRAM_DATASET_FAMILIES[program];
  if (allowedDatasets && !allowedDatasets.has(source.dataset_id)) {
    return { error: blocked("INCOME_LIMIT_PROGRAM_BRANCH_CONFLICT", "An income-limit dataset from one housing program cannot be used for another program.", [`${prefix}.income_limit_source.dataset_id`]) };
  }
  if (program === "LIHTC" || program === "TAX_EXEMPT_BOND") {
    if (item.deductions_applied_to_annual_income !== false || item.adjusted_income !== null) {
      return { error: blocked("LIHTC_DEDUCTIONS_INCORRECTLY_APPLIED", "LIHTC eligibility must compare the program's gross annual-income definition without HUD adjusted-income deductions.", [`${prefix}.deductions_applied_to_annual_income`, `${prefix}.adjusted_income`]) };
    }
    const designation = Number(item.income_designation_percent);
    if (!INCOME_AVERAGING_DESIGNATIONS.has(designation)) {
      return { error: blocked("LIHTC_INCOME_DESIGNATION_NOT_VALIDATED", "LIHTC requires an explicit 20, 30, 40, 50, 60, 70, or 80 percent designation.", [`${prefix}.income_designation_percent`]) };
    }
    if (designation !== 50 && designation !== 60 && source.dataset_id !== "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18") {
      return { error: blocked("LIHTC_INCOME_AVERAGING_SOURCE_REQUIRED", "Income-averaging designations require the corrected FY2026 income-averaging dataset.", [`${prefix}.income_limit_source.dataset_id`]) };
    }
    if (item.hera_special_selection_validated !== true) {
      return { error: blocked("HERA_SPECIAL_SELECTION_NOT_VALIDATED", "The regular-versus-HERA-special limit selection must be validated for the project and geography.", [`${prefix}.hera_special_selection_validated`]) };
    }
  }

  const student = item.student_status;
  const studentFinding = String(student?.finding ?? "").toUpperCase();
  if (!FINDINGS.has(studentFinding) || student?.source_validated !== true || student?.exceptions_evaluated !== true) {
    return { error: blocked("STUDENT_STATUS_NOT_VALIDATED", "Student status and every applicable exception require validated evidence.", [`${prefix}.student_status`]) };
  }
  if (String(student.rule_basis) !== STUDENT_RULE_BASIS[program]) {
    return { error: blocked("STUDENT_RULE_PROGRAM_BRANCH_CONFLICT", "A student rule from one housing program cannot be used for another program.", [`${prefix}.student_status.rule_basis`]) };
  }

  const asset = item.asset_test;
  const assetFinding = String(asset?.finding ?? "").toUpperCase();
  if (asset?.applicable === true) {
    if (!FINDINGS.has(assetFinding) || asset.source_validated !== true || asset.calculation_validated !== true) {
      return { error: blocked("ASSET_ELIGIBILITY_NOT_VALIDATED", "An applicable asset test requires a validated program-specific calculation and finding.", [`${prefix}.asset_test`]) };
    }
  } else if (asset?.applicable !== false || asset?.nonapplication_validated !== true) {
    return { error: blocked("ASSET_RULE_APPLICABILITY_NOT_VALIDATED", "A non-applicable asset restriction requires an explicit validated nonapplication outcome.", [`${prefix}.asset_test`]) };
  }

  const activationHandoff = validateFy2026IncomeLimitProgramHandoff(
    program,
    source.dataset_id,
    item.income_limit_source.activation_receipt,
  );
  if (activationHandoff.handoff_status !== "VALIDATED") {
    return {
      error: blocked(
        activationHandoff.reason_code ?? "INCOME_LIMIT_ACTIVATION_RECEIPT_REQUIRED",
        activationHandoff.reason ??
          "A trusted FY2026 income-limit activation receipt is required before tenant eligibility can compare income to a limit.",
        [`${prefix}.income_limit_source.activation_receipt`],
      ),
    };
  }

  const selectionHandoff = validateFy2026IncomeLimitSelection(
    program,
    source.dataset_id,
    item.income_limit_source.activation_receipt,
    item.income_limit_source.limit_selection,
  );
  if (selectionHandoff.selection_status !== "VALIDATED") {
    return {
      error: blocked(
        selectionHandoff.reason_code ??
          "INCOME_LIMIT_SELECTION_RECEIPT_REQUIRED",
        selectionHandoff.reason ??
          "The compared income limit must come from the activated workbook records.",
        [`${prefix}.income_limit_source.limit_selection`],
      ),
    };
  }
  if (
    String(selectionHandoff.normalized_limit_amount) !==
    String(source.normalized_limit_amount)
  ) {
    return {
      error: blocked(
        "INCOME_LIMIT_SELECTION_AMOUNT_CONFLICT",
        "The caller-supplied normalized limit does not match the module-issued workbook selection.",
        [`${prefix}.income_limit_source.normalized_limit_amount`],
      ),
    };
  }

  let incomeCents;
  let limitCents;
  try {
    incomeCents = moneyToCents(item.annual_income, `${prefix}.annual_income`);
    limitCents = moneyToCents(
      selectionHandoff.normalized_limit_amount,
      `${prefix}.income_limit_source.limit_selection.normalized_limit_amount`,
    );
  } catch (error) {
    return { error: blocked("INVALID_PROGRAM_INCOME_COMPARISON", error.message, [prefix]) };
  }
  const incomeFinding = incomeCents <= limitCents ? "PASS" : "FAIL";
  const unresolved = [studentFinding, asset?.applicable === true ? assetFinding : "PASS"].includes("NOT_DETERMINED");
  const failed = [incomeFinding, studentFinding, asset?.applicable === true ? assetFinding : "PASS"].includes("FAIL");
  return {
    value: {
      program_code: program,
      income_definition: String(item.income_definition),
      annual_income: formatCents(incomeCents),
      income_limit: formatCents(limitCents),
      dataset_id: source.dataset_id,
      income_finding: incomeFinding,
      student_finding: studentFinding,
      asset_finding: asset?.applicable === true ? assetFinding : "NOT_APPLICABLE",
      finding: unresolved ? "NOT_DETERMINED" : failed ? "FAIL" : "PASS",
    },
  };
}

/** Evaluate a complete tenant file for all applicable housing programs. */
export function evaluateTenantFileEligibility(input = {}) {
  const missing = [
    "property_id",
    "unit_id",
    "household_id",
    "household_member_ids",
    "event_date",
    "certification_type",
    "program_inventory",
    "program_determinations",
    "documents",
    "required_evidence_fields",
    "evidence",
  ].filter((field) => input[field] === null || input[field] === undefined);
  for (const field of [
    "property_identity_validated",
    "unit_identity_validated",
    "household_identity_validated",
    "household_roster_complete",
    "document_inventory_complete",
    "program_inventory_complete",
    "program_authority_inventory_complete",
  ]) {
    if (input[field] !== true) missing.push(field);
  }
  if (missing.length) {
    return blocked("TENANT_FILE_SCOPE_NOT_VALIDATED", "Property, unit, household, document, program, and authority scope must be complete and validated.", missing);
  }
  if (!Array.isArray(input.household_member_ids) || !input.household_member_ids.length) {
    return blocked("HOUSEHOLD_ROSTER_INVALID", "At least one validated household member is required.", ["household_member_ids"]);
  }
  const certificationType = String(input.certification_type).toUpperCase();
  if (!CERTIFICATION_TYPES.has(certificationType)) {
    return blocked("CERTIFICATION_TYPE_INVALID", "Certification type must be INITIAL, ANNUAL, or INTERIM.", ["certification_type"]);
  }
  let eventDate;
  try {
    eventDate = parseIsoDate(input.event_date, "event_date");
  } catch (error) {
    return blocked("INVALID_TENANT_FILE_EVENT_DATE", error.message, ["event_date"]);
  }

  if (!Array.isArray(input.program_inventory) || !Array.isArray(input.program_determinations)) {
    return blocked("PROGRAM_ELIGIBILITY_INVENTORY_INVALID", "Program inventory and determinations must be structured lists.", ["program_inventory", "program_determinations"]);
  }
  const programs = uniqueSorted(input.program_inventory.map((value) => String(value).toUpperCase()));
  if (!programs.length || programs.some((program) => !PROGRAM_CODES.has(program))) {
    return blocked("UNRECOGNIZED_PROGRAM_ELIGIBILITY_INVENTORY", "The program inventory is empty or contains an unrecognized branch.", ["program_inventory"]);
  }
  const stateRequested = programs.some((program) => ["STATE_HFA", "LOCAL_PROGRAM"].includes(program)) || input.state_finding_requested === true;
  if (stateRequested && !statePackUsable(input.state_rulepack, eventDate, programs)) {
    return blocked("STATE_ELIGIBILITY_PACK_NOT_VALIDATED", "State and local tenant-eligibility findings remain blocked without an approved, versioned, effective rule pack.", ["state_rulepack"]);
  }

  const documentValidation = validateDocuments({ ...input, program_inventory: programs }, eventDate);
  if (documentValidation.error) return documentValidation.error;
  const evidenceValidation = reconcileEvidence(input, documentValidation.documentIds);
  if (evidenceValidation.error) return evidenceValidation.error;

  const results = [];
  const determinationPrograms = new Set();
  for (const [index, item] of input.program_determinations.entries()) {
    const validation = validateProgramDetermination(
      item,
      index,
      input,
      eventDate,
      evidenceValidation.resolved,
    );
    if (validation.error) return validation.error;
    if (determinationPrograms.has(validation.value.program_code)) {
      return blocked("DUPLICATE_PROGRAM_ELIGIBILITY_DETERMINATION", "Each program must have exactly one reconciled eligibility determination.", [validation.value.program_code]);
    }
    determinationPrograms.add(validation.value.program_code);
    results.push(validation.value);
  }
  const inventoryDifference = [
    ...programs.filter((program) => !determinationPrograms.has(program)),
    ...[...determinationPrograms].filter((program) => !programs.includes(program)),
  ];
  if (inventoryDifference.length) {
    return blocked("PROGRAM_ELIGIBILITY_INVENTORY_MISMATCH", "The applicable program inventory does not match the determination handoffs.", inventoryDifference);
  }

  const knownFailures = results
    .filter(
      (result) =>
        result.income_finding === "FAIL" ||
        result.student_finding === "FAIL" ||
        result.asset_finding === "FAIL",
    )
    .map((result) => `PROGRAM:${result.program_code}`);
  const unresolved = results.filter((result) => result.finding === "NOT_DETERMINED");
  if (unresolved.length) {
    return blocked("PROGRAM_ELIGIBILITY_NOT_DETERMINED", "At least one program-specific income, asset, or student determination is unresolved.", unresolved.map((result) => result.program_code), {
      program_results: results,
      confirmed_failure_indicators: knownFailures,
    });
  }
  const finding = knownFailures.length ? "FAIL" : "PASS";
  return {
    resolution_status: "COMPLETED",
    determination_status: finding,
    rule_engine_authority: "ALLOWED",
    finding,
    rule_id: TENANT_ELIGIBILITY_RULE_ID,
    engine_build: TENANT_ELIGIBILITY_ENGINE_BUILD,
    property_id: String(input.property_id),
    unit_id: String(input.unit_id),
    household_id: String(input.household_id),
    household_member_ids: uniqueSorted(input.household_member_ids),
    event_date: eventDate,
    certification_type: certificationType,
    authority_scope: stateRequested ? "STATE_AND_FEDERAL" : "FEDERAL_BASELINE_ONLY",
    program_results: results.sort((left, right) => left.program_code.localeCompare(right.program_code)),
    confirmed_failure_indicators: knownFailures,
    resolved_evidence: evidenceValidation.resolved,
    cross_program_income_substitution_performed: false,
    cross_program_student_rule_substitution_performed: false,
    cross_program_asset_rule_substitution_performed: false,
    agent_approval_required: true,
    agent_approval_status: "PENDING",
    human_approval_required: true,
    citations: [
      "26 USC 42(g) and 42(i)(3)(D)",
      "24 CFR 5.609",
      "24 CFR 5.612",
      "24 CFR 5.618",
      "24 CFR 92.203",
      "7 CFR 3560.152",
    ],
  };
}
