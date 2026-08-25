import {
  CONTROLLED_FY2026_INCOME_LIMIT_SOURCES,
  evaluateFy2026IncomeLimitSourceActivation,
} from "./fy2026-income-limit-ingestion.mjs";

export const FY2026_CONTROLLED_SOURCE_BUCKET = "federal-source-workbooks";
export const FY2026_CONTROLLED_STORAGE_GATE_BUILD =
  "fy2026-controlled-storage-gate-2026.08.1";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function blocked(reasonCode, reason, missingInputs = [], details = {}) {
  return {
    storage_gate_status: "BLOCKED",
    activation_status: "BLOCKED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code: reasonCode,
    reason,
    missing_inputs: [...new Set(missingInputs.map(String))].sort(),
    human_approval_required: true,
    ...details,
  };
}

function expectedStoragePath(source) {
  return `fy2026/${source.dataset_id}/${source.sha256}/${source.file_name}`;
}

/**
 * Validate the immutable database/storage handoff before private bytes are read.
 * A public URL, caller-created path, or incomplete two-person approval can never
 * be converted into compliance-rule authority.
 */
export function validateFy2026ControlledStorageRecord(
  datasetId,
  storageRecord,
) {
  const dataset = String(datasetId ?? "");
  const source = CONTROLLED_FY2026_INCOME_LIMIT_SOURCES[dataset];
  if (!source) {
    return blocked(
      "UNREGISTERED_CONTROLLED_STORAGE_DATASET",
      "The requested dataset is not registered in the controlled FY2026 source pack.",
      ["dataset_id"],
    );
  }
  const requiredSourceFields = [
    "file_name",
    "sha256",
    "record_count",
    "effective_from",
  ].filter((field) => source[field] === undefined || source[field] === null);
  if (requiredSourceFields.length) {
    return blocked(
      "CONTROLLED_SOURCE_METADATA_INCOMPLETE",
      "The source identity is incomplete and cannot enter controlled storage activation.",
      requiredSourceFields.map((field) => `${dataset}.${field}`),
      { dataset_id: dataset },
    );
  }
  if (
    !storageRecord ||
    typeof storageRecord !== "object" ||
    Array.isArray(storageRecord)
  ) {
    return blocked(
      "CONTROLLED_STORAGE_RECORD_REQUIRED",
      "A database-issued private storage record is required.",
      ["storage_record"],
      { dataset_id: dataset },
    );
  }

  const missing = [
    "release_id",
    "dataset_id",
    "storage_bucket",
    "storage_path",
    "file_name",
    "sha256",
    "byte_size",
    "effective_from",
    "record_count",
    "release_status",
    "approval_id",
    "approval_status",
    "approval_action",
    "requested_by",
    "approved_by",
    "approved_at",
    "private_object",
  ].filter(
    (field) =>
      storageRecord[field] === undefined || storageRecord[field] === null,
  );
  if (missing.length) {
    return blocked(
      "CONTROLLED_STORAGE_RECORD_INCOMPLETE",
      "The controlled storage record is missing required identity or approval fields.",
      missing.map((field) => `storage_record.${field}`),
      { dataset_id: dataset },
    );
  }

  if (
    String(storageRecord.dataset_id) !== dataset ||
    String(storageRecord.file_name) !== source.file_name ||
    String(storageRecord.sha256) !== source.sha256 ||
    String(storageRecord.effective_from) !== source.effective_from ||
    Number(storageRecord.record_count) !== source.record_count
  ) {
    return blocked(
      "CONTROLLED_STORAGE_IDENTITY_CONFLICT",
      "The storage ledger identity does not match the controlled FY2026 source registry.",
      ["storage_record"],
      { dataset_id: dataset },
    );
  }
  if (
    String(storageRecord.storage_bucket) !== FY2026_CONTROLLED_SOURCE_BUCKET ||
    String(storageRecord.storage_path) !== expectedStoragePath(source) ||
    storageRecord.private_object !== true ||
    (storageRecord.public_url !== undefined && storageRecord.public_url !== null)
  ) {
    return blocked(
      "PRIVATE_CONTROLLED_STORAGE_REQUIRED",
      "Only the canonical private workbook object may enter the activation path.",
      ["storage_record.storage_bucket", "storage_record.storage_path"],
      { dataset_id: dataset },
    );
  }
  if (
    !UUID_PATTERN.test(String(storageRecord.release_id)) ||
    !UUID_PATTERN.test(String(storageRecord.approval_id)) ||
    !UUID_PATTERN.test(String(storageRecord.requested_by)) ||
    !UUID_PATTERN.test(String(storageRecord.approved_by)) ||
    !SHA256_PATTERN.test(String(storageRecord.sha256))
  ) {
    return blocked(
      "CONTROLLED_STORAGE_IDENTIFIER_INVALID",
      "Release, approval, and hash identifiers must use controlled formats.",
      ["storage_record.release_id", "storage_record.approval_id"],
      { dataset_id: dataset },
    );
  }
  if (
    String(storageRecord.release_status) !== "approved" ||
    String(storageRecord.approval_status) !== "approved" ||
    String(storageRecord.approval_action) !==
      "activate_fy2026_income_limit_workbook" ||
    String(storageRecord.requested_by) === String(storageRecord.approved_by) ||
    Number.isNaN(Date.parse(String(storageRecord.approved_at)))
  ) {
    return blocked(
      "CONTROLLED_STORAGE_APPROVAL_REQUIRED",
      "A bound, unexpired two-person activation approval is required.",
      ["storage_record.approval_id"],
      { dataset_id: dataset },
    );
  }
  const expectedBytes = Number(source.verified_size_bytes ?? storageRecord.byte_size);
  if (
    !Number.isSafeInteger(Number(storageRecord.byte_size)) ||
    Number(storageRecord.byte_size) <= 0 ||
    Number(storageRecord.byte_size) !== expectedBytes
  ) {
    return blocked(
      "CONTROLLED_STORAGE_SIZE_CONFLICT",
      "The private object size does not match the verified source identity.",
      ["storage_record.byte_size"],
      { dataset_id: dataset, expected_size_bytes: expectedBytes },
    );
  }

  const expectedCrosswalk = Number(
    source.expected_legacy_geography_crosswalk_count ?? 0,
  );
  if (Number(storageRecord.verified_crosswalk_count ?? 0) !== expectedCrosswalk) {
    return blocked(
      "CONTROLLED_STORAGE_CROSSWALK_INCOMPLETE",
      "Every required legacy geography mapping must be verified before workbook bytes are read for activation.",
      ["storage_record.verified_crosswalk_count"],
      {
        dataset_id: dataset,
        expected_crosswalk_count: expectedCrosswalk,
        verified_crosswalk_count: Number(
          storageRecord.verified_crosswalk_count ?? 0,
        ),
      },
    );
  }

  return {
    storage_gate_status: "VALIDATED",
    dataset_id: dataset,
    release_id: String(storageRecord.release_id),
    storage_bucket: FY2026_CONTROLLED_SOURCE_BUCKET,
    storage_path: expectedStoragePath(source),
    source_sha256: source.sha256,
    byte_size: expectedBytes,
    approval_id: String(storageRecord.approval_id),
    gate_build: FY2026_CONTROLLED_STORAGE_GATE_BUILD,
    private_object_verified: true,
    two_person_approval_verified: true,
  };
}

/** Read approved private bytes, bind them to the controlled identity, and parse. */
export async function loadFy2026IncomeLimitFromControlledStorage(input = {}) {
  const datasetId = String(input.dataset_id ?? "");
  const gate = validateFy2026ControlledStorageRecord(
    datasetId,
    input.storage_record,
  );
  if (gate.storage_gate_status !== "VALIDATED") return gate;
  if (typeof input.read_private_object !== "function") {
    return blocked(
      "PRIVATE_STORAGE_READER_REQUIRED",
      "A server-side private object reader is required.",
      ["read_private_object"],
      { dataset_id: datasetId },
    );
  }

  let bytes;
  try {
    bytes = await input.read_private_object({
      bucket: gate.storage_bucket,
      path: gate.storage_path,
    });
  } catch {
    return blocked(
      "PRIVATE_STORAGE_READ_FAILED",
      "The approved private workbook object could not be read.",
      ["workbook_bytes"],
      { dataset_id: datasetId },
    );
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== gate.byte_size) {
    return blocked(
      "PRIVATE_STORAGE_OBJECT_SIZE_CONFLICT",
      "The bytes returned by private storage do not match the approved ledger size.",
      ["workbook_bytes"],
      {
        dataset_id: datasetId,
        expected_size_bytes: gate.byte_size,
        actual_size_bytes: bytes instanceof Uint8Array ? bytes.byteLength : null,
      },
    );
  }

  const source = CONTROLLED_FY2026_INCOME_LIMIT_SOURCES[datasetId];
  return evaluateFy2026IncomeLimitSourceActivation({
    dataset_id: datasetId,
    file_name: source.file_name,
    effective_from: source.effective_from,
    workbook_bytes: bytes,
  });
}
