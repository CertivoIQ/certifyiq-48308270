import { createHash } from "node:crypto";

import {
  FY2026_XLSX_PARSER_BUILD,
  parseControlledFy2026Workbook,
} from "./fy2026-xlsx-workbook-parser.mjs";

/** Deterministic Test #60 source-ingestion and activation gate. */
export const FY2026_LIMIT_INGESTION_ENGINE_BUILD =
  "fy2026-income-limit-ingestion-2026.08.4";

export const FY2026_LIMIT_ACTIVATION_STATUS = Object.freeze({
  active: "ACTIVE",
  blocked: "BLOCKED",
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HUD_GEOGRAPHY_PATTERN = /^\d{10}$/;

// Object identity is part of the trust boundary. Public hashes and receipt
// fields are not credentials and can never be used to forge a handoff.
const ISSUED_ACTIVATION_RECEIPTS = new WeakSet();
const ACTIVATED_RECORDS_BY_RECEIPT = new WeakMap();
const ISSUED_LIMIT_SELECTIONS = new WeakSet();
const LIMIT_SELECTION_RECEIPTS = new WeakMap();

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

export const CONTROLLED_FY2026_RENT_LIMIT_DATASET_FAMILIES = Object.freeze({
  HOME: Object.freeze(["HUD_HOME_RENT_LIMITS_FY2026"]),
  HTF: Object.freeze(["HUD_HTF_RENT_LIMITS_FY2026"]),
});

export const CONTROLLED_FY2026_INCOME_LIMIT_SOURCES = Object.freeze({
  HUD_MTSP_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    file_name: "MTSP-Data-FY26.xlsx",
    sha256:
      "fbc0af877e610d9cd3d9192febc6d4827319874605adc8897ca95366afac3465",
    record_count: 4764,
    effective_from: "2026-05-01",
    official_url:
      "https://www.huduser.gov/portal/datasets/mtsp/mtsp26/MTSP-Data-FY26.xlsx",
    content_available_in_repository: false,
    source_bytes_sha256_verified: true,
    source_bytes_verified_at: "2026-08-25",
    verified_size_bytes: 833472,
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/mtsp.html",
    activation_status: "BLOCKED_PENDING_CONTROLLED_STORAGE_AND_CROSSWALK",
    expected_legacy_geography_crosswalk_count: 6,
  }),
  HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18: Object.freeze({
    dataset_id: "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
    file_name: "MTSP-IncAvg-Data-FY26.xlsx",
    sha256:
      "54917d23269060f85eeac45ba429b1ce1b157c7dd51a1ce975e5b0293a5ce8ed",
    record_count: 4764,
    effective_from: "2026-05-01",
    official_url:
      "https://www.huduser.gov/portal/datasets/mtsp/mtsp26/MTSP-IncAvg-Data-FY26.xlsx",
    content_available_in_repository: false,
    source_bytes_sha256_verified: true,
    source_bytes_verified_at: "2026-08-25",
    verified_size_bytes: 1449076,
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/mtsp.html",
    activation_status: "BLOCKED_PENDING_CONTROLLED_STORAGE",
    expected_legacy_geography_crosswalk_count: 0,
    normalization_rule:
      "ROUND_EXCEL_DECIMAL_ARTIFACT_TO_EXACT_DOLLAR_NEVER_NEAREST_50",
  }),
  HUD_HOME_RENT_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HOME_RENT_LIMITS_FY2026",
    file_name: "HOME_RentLimits_Natl_2026.xlsx",
    sha256:
      "3082bd081727dea71dd62abcb811e3d26ce605f1f645fd5cd8dbcb76e8d4f133",
    record_count: 4764,
    effective_from: "2026-06-01",
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/HOME-Rent-limits.html",
    content_available_in_repository: false,
    activation_status: "BLOCKED_PENDING_CONTROLLED_STORAGE_AND_RENT_RECEIPT_PIPELINE",
    expected_legacy_geography_crosswalk_count: 0,
  }),
  HUD_HOME_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HOME_INCOME_LIMITS_FY2026",
    file_name: "HOME_IncomeLmts_Natl_2026.xlsx",
    effective_from: "2026-06-01",
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/HOME-Income-limits.html",
    content_available_in_repository: false,
    source_bytes_sha256_verified: false,
    activation_status:
      "BLOCKED_PENDING_FILE_HASH_RECORD_COUNT_SIZE_CONTENT_AND_CROSSWALK",
    expected_legacy_geography_crosswalk_count: 6,
  }),
  HUD_HTF_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HTF_INCOME_LIMITS_FY2026",
    file_name: "HTF_IncomeLmts_Natl_2026.xlsx",
    effective_from: "2026-06-01",
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/HTF-Income-limits.html",
    content_available_in_repository: false,
    source_bytes_sha256_verified: false,
    activation_status:
      "BLOCKED_PENDING_FILE_HASH_RECORD_COUNT_SIZE_AND_CONTENT_VALIDATION",
    expected_legacy_geography_crosswalk_count: 0,
  }),
  HUD_HTF_RENT_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HTF_RENT_LIMITS_FY2026",
    file_name: "HTF_RentLimits_Natl_2026.xlsx",
    effective_from: "2026-06-01",
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/HTF-Rent-limits.html",
    content_available_in_repository: false,
    source_bytes_sha256_verified: false,
    activation_status:
      "BLOCKED_PENDING_FILE_HASH_RECORD_COUNT_SIZE_CONTENT_AND_RENT_RECEIPT_PIPELINE",
    expected_legacy_geography_crosswalk_count: 0,
  }),
  HUD_SECTION8_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_SECTION8_INCOME_LIMITS_FY2026",
    file_name: "Section8-FY26.xlsx",
    activation_status: "BLOCKED_PENDING_FILE_HASH_AND_CONTENT_VALIDATION",
  }),
  USDA_RD_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "USDA_RD_INCOME_LIMITS_FY2026",
    activation_status: "BLOCKED_PENDING_CONTROLLED_SOURCE",
  }),
});

/**
 * Register the program/rent-dataset relationship without granting rule authority.
 * Rent activation requires its own byte-derived selection receipt pipeline and
 * can never reuse an income-limit activation receipt.
 */
export function validateFy2026RentLimitProgramRegistration(
  programCode,
  datasetId,
) {
  const program = String(programCode ?? "").toUpperCase();
  const dataset = String(datasetId ?? "");
  const family = CONTROLLED_FY2026_RENT_LIMIT_DATASET_FAMILIES[program];
  if (!family || !family.includes(dataset)) {
    return blocked(
      "RENT_LIMIT_PROGRAM_BRANCH_CONFLICT",
      "The selected rent-limit dataset does not belong to the requested program branch.",
      ["program_code", "dataset_id"],
    );
  }
  const source = CONTROLLED_FY2026_INCOME_LIMIT_SOURCES[dataset];
  const incompleteMetadata = [
    "file_name",
    "sha256",
    "record_count",
    "effective_from",
  ].filter((field) => source?.[field] === null || source?.[field] === undefined);
  return {
    registration_status: "REGISTERED",
    activation_status: FY2026_LIMIT_ACTIVATION_STATUS.blocked,
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    program_code: program,
    dataset_id: dataset,
    official_landing_page: source?.official_landing_page ?? null,
    effective_from: source?.effective_from ?? null,
    reason_code: incompleteMetadata.length
      ? "CONTROLLED_RENT_SOURCE_METADATA_INCOMPLETE"
      : "RENT_LIMIT_ACTIVATION_RECEIPT_PIPELINE_REQUIRED",
    missing_inputs: incompleteMetadata.length
      ? incompleteMetadata.map((field) => `${dataset}.${field}`)
      : ["controlled_storage_record", "rent_limit_activation_receipt"],
    human_approval_required: true,
  };
}

// Intentionally empty until the six Maine/Massachusetts mappings are derived
// from validated FY2026 HOME/Section 8 source bytes and approved for release.
export const CONTROLLED_FY2026_GEOGRAPHY_CROSSWALK = Object.freeze([]);

function uniqueSorted(values = []) {
  return [...new Set(values.map(String))].sort();
}

function blocked(reasonCode, reason, missingInputs = [], details = {}) {
  return {
    activation_status: FY2026_LIMIT_ACTIVATION_STATUS.blocked,
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: reasonCode,
    reason,
    missing_inputs: uniqueSorted(missingInputs),
    human_approval_required: true,
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

/** Normalize Excel binary-decimal artifacts to whole dollars, never to $50. */
export function normalizeFy2026IncomeLimitDollar(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error("income limit must be a non-negative decimal amount");
  }
  const [whole, fraction = ""] = text.split(".");
  return String(BigInt(whole) + (Number(fraction[0] ?? "0") >= 5 ? 1n : 0n));
}

function controlledCrosswalkMap() {
  return new Map(
    CONTROLLED_FY2026_GEOGRAPHY_CROSSWALK.map((entry) => [
      String(entry.source_geography_id),
      entry,
    ]),
  );
}

/**
 * Validate already-parsed geographic records before they can be activated.
 * Parsing XLSX bytes is an adapter concern; this function owns deterministic
 * duplicate, crosswalk, and exact-dollar rules.
 */
export function validateFy2026IncomeLimitRecords(
  records,
  { expectedRecordCount, expectedLegacyCrosswalkCount = 0 } = {},
) {
  if (!Array.isArray(records)) {
    return blocked(
      "NORMALIZED_RECORDS_MISSING",
      "Parsed workbook records are required for content activation.",
      ["records"],
    );
  }
  if (
    Number.isInteger(expectedRecordCount) &&
    records.length !== expectedRecordCount
  ) {
    return blocked(
      "INCOME_LIMIT_RECORD_COUNT_CONFLICT",
      "The parsed geographic record count does not match the controlled source.",
      ["records"],
      { expected_record_count: expectedRecordCount, actual_record_count: records.length },
    );
  }

  const controlledCrosswalk = controlledCrosswalkMap();
  if (controlledCrosswalk.size !== Number(expectedLegacyCrosswalkCount)) {
    return blocked(
      "CONTROLLED_GEOGRAPHY_CROSSWALK_INCOMPLETE",
      "The controlled source pack does not yet contain every required FY2026 legacy geography mapping.",
      ["controlled_geography_crosswalk"],
      {
        expected_crosswalk_count: Number(expectedLegacyCrosswalkCount),
        controlled_crosswalk_count: controlledCrosswalk.size,
      },
    );
  }

  const sourceKeys = new Set();
  const targetKeys = new Set();
  const normalizedRecords = [];
  const usedCrosswalkKeys = new Set();
  for (const [index, record] of records.entries()) {
    const prefix = `records[${index}]`;
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return blocked(
        "INVALID_INCOME_LIMIT_RECORD",
        "Every parsed workbook row must be a structured geographic record.",
        [prefix],
      );
    }
    const source = String(record.source_geography_id ?? "");
    const target = String(record.target_geography_id ?? "");
    if (!HUD_GEOGRAPHY_PATTERN.test(source) || !HUD_GEOGRAPHY_PATTERN.test(target)) {
      return blocked(
        "INVALID_INCOME_LIMIT_GEOGRAPHY",
        "Source and FY2026 target geography identifiers must be ten-digit HUD FIPS keys.",
        [`${prefix}.source_geography_id`, `${prefix}.target_geography_id`],
      );
    }
    if (sourceKeys.has(source) || targetKeys.has(target)) {
      return blocked(
        "DUPLICATE_INCOME_LIMIT_GEOGRAPHY",
        "Source and FY2026 target geography identifiers must be unique.",
        [sourceKeys.has(source) ? source : target],
      );
    }
    sourceKeys.add(source);
    targetKeys.add(target);

    if (source !== target) {
      const mapping = controlledCrosswalk.get(source);
      if (!mapping || String(mapping.target_geography_id) !== target) {
        return blocked(
          "UNREGISTERED_GEOGRAPHY_CROSSWALK",
          "A caller-supplied or conflicting geography mapping cannot activate a controlled dataset.",
          [`${prefix}.target_geography_id`],
          { source_geography_id: source, target_geography_id: target },
        );
      }
      usedCrosswalkKeys.add(source);
    }

    if (
      !record.limit_values ||
      typeof record.limit_values !== "object" ||
      Array.isArray(record.limit_values) ||
      !Object.keys(record.limit_values).length
    ) {
      return blocked(
        "INCOME_LIMIT_VALUES_MISSING",
        "Every geographic record requires one or more named income-limit values.",
        [`${prefix}.limit_values`],
      );
    }

    const normalizedValues = {};
    for (const [field, value] of Object.entries(record.limit_values)) {
      try {
        normalizedValues[field] = normalizeFy2026IncomeLimitDollar(value);
      } catch (error) {
        return blocked(
          "INVALID_INCOME_LIMIT_VALUE",
          error.message,
          [`${prefix}.limit_values.${field}`],
        );
      }
    }
    normalizedRecords.push({
      source_geography_id: source,
      target_geography_id: target,
      limit_values: normalizedValues,
    });
  }

  const unusedMappings = [...controlledCrosswalk.keys()].filter(
    (source) => !usedCrosswalkKeys.has(source),
  );
  if (unusedMappings.length) {
    return blocked(
      "CONTROLLED_GEOGRAPHY_CROSSWALK_NOT_RECONCILED",
      "Every registered legacy geography mapping must reconcile to an actual source row.",
      unusedMappings,
    );
  }

  return {
    validation_status: "VALIDATED",
    record_count: normalizedRecords.length,
    geography_count: targetKeys.size,
    legacy_geography_crosswalk_count: usedCrosswalkKeys.size,
    normalized_records: normalizedRecords,
    exact_dollar_normalization: true,
    nearest_fifty_rounding_performed: false,
  };
}

function bytesFrom(value) {
  if (value instanceof Uint8Array) return value;
  return null;
}

/** Validate source bytes and parsed content, then issue a bound receipt. */
export function evaluateFy2026IncomeLimitSourceActivation(input = {}) {
  const datasetId = String(input.dataset_id ?? "");
  const source = CONTROLLED_FY2026_INCOME_LIMIT_SOURCES[datasetId];
  if (!source) {
    return blocked(
      "UNREGISTERED_INCOME_LIMIT_SOURCE",
      "The dataset identifier is not registered in the controlled FY2026 source pack.",
      ["dataset_id"],
    );
  }

  const incompleteMetadata = ["file_name", "sha256", "record_count", "effective_from"].filter(
    (field) => source[field] === null || source[field] === undefined,
  );
  if (incompleteMetadata.length) {
    return blocked(
      "CONTROLLED_SOURCE_METADATA_INCOMPLETE",
      "This program dataset remains inactive until its controlled file identity is complete.",
      incompleteMetadata.map((field) => `${datasetId}.${field}`),
      { dataset_id: datasetId },
    );
  }

  if (
    String(input.file_name ?? "") !== source.file_name ||
    String(input.effective_from ?? "") !== source.effective_from
  ) {
    return blocked(
      "CONTROLLED_SOURCE_IDENTITY_CONFLICT",
      "The supplied filename or effective date does not match the controlled source.",
      ["file_name", "effective_from"],
      { dataset_id: datasetId },
    );
  }
  try {
    parseIsoDate(input.effective_from, "effective_from");
  } catch (error) {
    return blocked("INVALID_INCOME_LIMIT_EFFECTIVE_DATE", error.message, ["effective_from"]);
  }

  const bytes = bytesFrom(input.workbook_bytes);
  if (!bytes || bytes.byteLength === 0) {
    return blocked(
      "SOURCE_WORKBOOK_BYTES_REQUIRED",
      "Known metadata cannot activate a dataset without the actual workbook bytes.",
      ["workbook_bytes"],
      { dataset_id: datasetId },
    );
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (!SHA256_PATTERN.test(source.sha256) || actualSha256 !== source.sha256) {
    return blocked(
      "SOURCE_WORKBOOK_HASH_CONFLICT",
      "The actual workbook bytes do not match the controlled SHA-256 identity.",
      ["workbook_bytes"],
      { dataset_id: datasetId, expected_sha256: source.sha256, actual_sha256: actualSha256 },
    );
  }

  const parsed = parseControlledFy2026Workbook({
    dataset_id: datasetId,
    workbook_bytes: bytes,
  });
  if (
    parsed.parser_status !== "PARSED" ||
    parsed.workbook_sha256 !== actualSha256
  ) {
    return blocked(
      parsed.reason_code ?? "CONTROLLED_XLSX_PARSE_FAILED",
      parsed.reason ??
        "The trusted parser could not derive controlled records from the verified workbook bytes.",
      parsed.missing_inputs ?? ["workbook_bytes"],
      {
        dataset_id: datasetId,
        source_sha256: actualSha256,
        parser_build: FY2026_XLSX_PARSER_BUILD,
        caller_records_ignored: true,
        caller_validation_booleans_ignored: true,
      },
    );
  }

  const crosswalk = controlledCrosswalkMap();
  const records = parsed.records.map((record) => {
    const mapping = crosswalk.get(String(record.source_geography_id));
    return {
      ...record,
      target_geography_id: String(
        mapping?.target_geography_id ?? record.source_geography_id,
      ),
    };
  });
  const validated = validateFy2026IncomeLimitRecords(records, {
    expectedRecordCount: source.record_count,
    expectedLegacyCrosswalkCount:
      source.expected_legacy_geography_crosswalk_count ?? 0,
  });
  if (validated.validation_status !== "VALIDATED") {
    return {
      ...validated,
      dataset_id: datasetId,
      source_sha256: actualSha256,
      parser_build: FY2026_XLSX_PARSER_BUILD,
      caller_records_ignored: true,
      caller_validation_booleans_ignored: true,
    };
  }

  const normalizedRecordsSha256 = createHash("sha256")
    .update(JSON.stringify(validated.normalized_records))
    .digest("hex");
  const receipt = Object.freeze({
    activation_status: FY2026_LIMIT_ACTIVATION_STATUS.active,
    rule_engine_authority: "ALLOWED",
    finding: "PASS",
    dataset_id: datasetId,
    file_name: source.file_name,
    effective_from: source.effective_from,
    source_sha256: actualSha256,
    normalized_records_sha256: normalizedRecordsSha256,
    record_count: validated.record_count,
    geography_count: validated.geography_count,
    legacy_geography_crosswalk_count:
      validated.legacy_geography_crosswalk_count,
    exact_dollar_normalization: true,
    nearest_fifty_rounding_performed: false,
    engine_build: FY2026_LIMIT_INGESTION_ENGINE_BUILD,
    parser_build: FY2026_XLSX_PARSER_BUILD,
    agent_approval_required: true,
    human_approval_required: true,
  });
  ISSUED_ACTIVATION_RECEIPTS.add(receipt);
  ACTIVATED_RECORDS_BY_RECEIPT.set(
    receipt,
    new Map(
      validated.normalized_records.map((record) => [
        record.target_geography_id,
        record,
      ]),
    ),
  );
  return receipt;
}

/** Prevent a validated receipt from crossing program branches. */
export function validateFy2026IncomeLimitProgramHandoff(
  programCode,
  datasetId,
  activationReceipt,
) {
  const program = String(programCode ?? "").toUpperCase();
  const dataset = String(datasetId ?? "");
  const family = PROGRAM_DATASET_FAMILIES[program];
  if (!family || !family.has(dataset)) {
    return blocked(
      "INCOME_LIMIT_PROGRAM_BRANCH_CONFLICT",
      "The selected income-limit dataset does not belong to the requested program branch.",
      ["program_code", "dataset_id"],
    );
  }
  if (
    !activationReceipt ||
    typeof activationReceipt !== "object" ||
    !ISSUED_ACTIVATION_RECEIPTS.has(activationReceipt) ||
    activationReceipt.activation_status !== FY2026_LIMIT_ACTIVATION_STATUS.active ||
    activationReceipt.dataset_id !== dataset ||
    activationReceipt.source_sha256 !==
      CONTROLLED_FY2026_INCOME_LIMIT_SOURCES[dataset]?.sha256 ||
    activationReceipt.engine_build !== FY2026_LIMIT_INGESTION_ENGINE_BUILD ||
    !SHA256_PATTERN.test(String(activationReceipt.normalized_records_sha256 ?? ""))
  ) {
    return blocked(
      "INCOME_LIMIT_ACTIVATION_RECEIPT_REQUIRED",
      "Program evaluation requires a module-issued activation receipt bound to the controlled workbook bytes and normalized records.",
      ["activation_receipt"],
    );
  }
  return {
    handoff_status: "VALIDATED",
    program_code: program,
    dataset_id: dataset,
    activation_receipt_validated: true,
  };
}

/**
 * Select one limit only from records privately bound to a module-issued
 * activation receipt. Caller-supplied geography rows or amounts are ignored.
 */
export function selectFy2026IncomeLimit(input = {}) {
  const program = String(input.program_code ?? "").toUpperCase();
  const dataset = String(input.dataset_id ?? "");
  const receipt = input.activation_receipt;
  const handoff = validateFy2026IncomeLimitProgramHandoff(
    program,
    dataset,
    receipt,
  );
  if (handoff.handoff_status !== "VALIDATED") return handoff;

  const geographyId = String(input.geography_id ?? "");
  const limitField = String(input.limit_field ?? "");
  if (!HUD_GEOGRAPHY_PATTERN.test(geographyId) || !limitField) {
    return blocked(
      "INCOME_LIMIT_SELECTION_INPUT_INVALID",
      "A ten-digit FY2026 geography key and exact controlled limit field are required.",
      ["geography_id", "limit_field"],
    );
  }
  const record = ACTIVATED_RECORDS_BY_RECEIPT.get(receipt)?.get(geographyId);
  const amount = record?.limit_values?.[limitField];
  if (!record || amount === undefined) {
    return blocked(
      "INCOME_LIMIT_SELECTION_NOT_FOUND",
      "The requested geography and limit field were not present in the activated workbook records.",
      ["geography_id", "limit_field"],
      { dataset_id: dataset },
    );
  }

  const selection = Object.freeze({
    selection_status: "VALIDATED",
    program_code: program,
    dataset_id: dataset,
    target_geography_id: geographyId,
    source_geography_id: record.source_geography_id,
    limit_field: limitField,
    normalized_limit_amount: amount,
    source_sha256: receipt.source_sha256,
    normalized_records_sha256: receipt.normalized_records_sha256,
    engine_build: FY2026_LIMIT_INGESTION_ENGINE_BUILD,
  });
  ISSUED_LIMIT_SELECTIONS.add(selection);
  LIMIT_SELECTION_RECEIPTS.set(selection, receipt);
  return selection;
}

/** Validate that a selected amount came from the exact activated workbook. */
export function validateFy2026IncomeLimitSelection(
  programCode,
  datasetId,
  activationReceipt,
  limitSelection,
) {
  const handoff = validateFy2026IncomeLimitProgramHandoff(
    programCode,
    datasetId,
    activationReceipt,
  );
  if (handoff.handoff_status !== "VALIDATED") return handoff;
  if (
    !limitSelection ||
    typeof limitSelection !== "object" ||
    !ISSUED_LIMIT_SELECTIONS.has(limitSelection) ||
    LIMIT_SELECTION_RECEIPTS.get(limitSelection) !== activationReceipt ||
    limitSelection.selection_status !== "VALIDATED" ||
    limitSelection.program_code !== String(programCode ?? "").toUpperCase() ||
    limitSelection.dataset_id !== String(datasetId ?? "") ||
    limitSelection.source_sha256 !== activationReceipt.source_sha256 ||
    limitSelection.normalized_records_sha256 !==
      activationReceipt.normalized_records_sha256
  ) {
    return blocked(
      "INCOME_LIMIT_SELECTION_RECEIPT_REQUIRED",
      "The income-limit amount must be selected from records privately bound to the module-issued activation receipt.",
      ["limit_selection"],
    );
  }
  return {
    selection_status: "VALIDATED",
    program_code: limitSelection.program_code,
    dataset_id: limitSelection.dataset_id,
    target_geography_id: limitSelection.target_geography_id,
    limit_field: limitSelection.limit_field,
    normalized_limit_amount: limitSelection.normalized_limit_amount,
  };
}
