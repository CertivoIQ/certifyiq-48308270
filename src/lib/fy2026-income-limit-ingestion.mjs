import { createHash } from "node:crypto";

/** Deterministic Test #60 source-ingestion and activation gate. */
export const FY2026_LIMIT_INGESTION_ENGINE_BUILD =
  "fy2026-income-limit-ingestion-2026.08.1";

export const FY2026_LIMIT_ACTIVATION_STATUS = Object.freeze({
  active: "ACTIVE",
  blocked: "BLOCKED",
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HUD_GEOGRAPHY_PATTERN = /^\d{10}$/;

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
    activation_status: "BLOCKED_PENDING_SOURCE_BYTES_SCHEMA_AND_CROSSWALK",
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
    activation_status: "BLOCKED_PENDING_SOURCE_BYTES_AND_SCHEMA",
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
    content_available_in_repository: false,
    activation_status: "BLOCKED_PENDING_SOURCE_BYTES_AND_SCHEMA",
    expected_legacy_geography_crosswalk_count: 0,
  }),
  HUD_HOME_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HOME_INCOME_LIMITS_FY2026",
    file_name: "HOME_IncomeLmts_Natl_2026.xlsx",
    activation_status: "BLOCKED_PENDING_FILE_HASH_AND_CONTENT_VALIDATION",
  }),
  HUD_HTF_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HTF_INCOME_LIMITS_FY2026",
    activation_status: "BLOCKED_PENDING_CONTROLLED_SOURCE",
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

  const validation = validateFy2026IncomeLimitRecords(input.records, {
    expectedRecordCount: source.record_count,
    expectedLegacyCrosswalkCount:
      source.expected_legacy_geography_crosswalk_count ?? 0,
  });
  if (validation.validation_status !== "VALIDATED") {
    return { ...validation, dataset_id: datasetId };
  }
  if (input.schema_validated !== true || input.effective_date_validated !== true) {
    return blocked(
      "SOURCE_WORKBOOK_STRUCTURE_NOT_VALIDATED",
      "The workbook schema and effective-date fields must be validated before activation.",
      [
        ...(input.schema_validated === true ? [] : ["schema_validated"]),
        ...(input.effective_date_validated === true
          ? []
          : ["effective_date_validated"]),
      ],
      { dataset_id: datasetId },
    );
  }

  const normalizedDigest = createHash("sha256")
    .update(JSON.stringify(validation.normalized_records))
    .digest("hex");
  return {
    activation_status: FY2026_LIMIT_ACTIVATION_STATUS.active,
    rule_engine_authority: "ALLOWED",
    finding: "PASS",
    dataset_id: datasetId,
    file_name: source.file_name,
    source_sha256: source.sha256,
    normalized_records_sha256: normalizedDigest,
    record_count: validation.record_count,
    effective_from: source.effective_from,
    geography_count: validation.geography_count,
    legacy_geography_crosswalk_count:
      validation.legacy_geography_crosswalk_count,
    exact_dollar_normalization: true,
    nearest_fifty_rounding_performed: false,
    human_approval_required: true,
    human_approval_status: "PENDING",
    engine_build: FY2026_LIMIT_INGESTION_ENGINE_BUILD,
  };
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
    activationReceipt.activation_status !== FY2026_LIMIT_ACTIVATION_STATUS.active ||
    activationReceipt.dataset_id !== dataset ||
    activationReceipt.source_sha256 !==
      CONTROLLED_FY2026_INCOME_LIMIT_SOURCES[dataset]?.sha256
  ) {
    return blocked(
      "INCOME_LIMIT_ACTIVATION_RECEIPT_REQUIRED",
      "Program evaluation requires an active receipt bound to the controlled dataset bytes.",
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
