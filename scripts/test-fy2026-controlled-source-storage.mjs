import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FY2026_CONTROLLED_SOURCE_BUCKET,
  loadFy2026IncomeLimitFromControlledStorage,
  validateFy2026ControlledStorageRecord,
} from "../src/lib/fy2026-controlled-source-storage.mjs";

const RELEASE_ID = "7f6d9c8b-6c6b-4a95-b9e5-c8c58b0ce2f1";
const APPROVAL_ID = "2fa07b21-8cca-47d1-b0aa-a8a8b4ac290e";
const REQUESTER_ID = "40dc7660-a165-480a-9acd-4d76862e24a8";
const APPROVER_ID = "06c2d420-9f83-458f-b1cb-40662cf88f1d";

function approvedAveragingRecord(overrides = {}) {
  const sha =
    "54917d23269060f85eeac45ba429b1ce1b157c7dd51a1ce975e5b0293a5ce8ed";
  const fileName = "MTSP-IncAvg-Data-FY26.xlsx";
  const datasetId = "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18";
  return {
    release_id: RELEASE_ID,
    dataset_id: datasetId,
    storage_bucket: FY2026_CONTROLLED_SOURCE_BUCKET,
    storage_path: `fy2026/${datasetId}/${sha}/${fileName}`,
    file_name: fileName,
    sha256: sha,
    byte_size: 1449076,
    effective_from: "2026-05-01",
    record_count: 4764,
    verified_crosswalk_count: 0,
    release_status: "approved",
    approval_id: APPROVAL_ID,
    approval_status: "approved",
    approval_action: "activate_fy2026_income_limit_workbook",
    requested_by: REQUESTER_ID,
    approved_by: APPROVER_ID,
    approved_at: "2026-08-25T18:00:00.000Z",
    private_object: true,
    public_url: null,
    ...overrides,
  };
}

test("an approved canonical private object passes the storage gate", () => {
  const result = validateFy2026ControlledStorageRecord(
    "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
    approvedAveragingRecord(),
  );
  assert.equal(result.storage_gate_status, "VALIDATED");
  assert.equal(result.private_object_verified, true);
  assert.equal(result.two_person_approval_verified, true);
});

test("public URLs and substituted storage paths are rejected", () => {
  for (const record of [
    approvedAveragingRecord({ public_url: "https://example.test/source.xlsx" }),
    approvedAveragingRecord({ storage_path: "fy2026/caller/source.xlsx" }),
  ]) {
    const result = validateFy2026ControlledStorageRecord(
      "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
      record,
    );
    assert.equal(result.reason_code, "PRIVATE_CONTROLLED_STORAGE_REQUIRED");
  }
});

test("self-approval and pending approval cannot enter the activation path", () => {
  for (const record of [
    approvedAveragingRecord({ approved_by: REQUESTER_ID }),
    approvedAveragingRecord({ approval_status: "pending" }),
  ]) {
    const result = validateFy2026ControlledStorageRecord(
      "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
      record,
    );
    assert.equal(result.reason_code, "CONTROLLED_STORAGE_APPROVAL_REQUIRED");
  }
});

test("the standard MTSP workbook stays blocked until all six mappings exist", () => {
  const sha =
    "fbc0af877e610d9cd3d9192febc6d4827319874605adc8897ca95366afac3465";
  const datasetId = "HUD_MTSP_LIMITS_FY2026";
  const result = validateFy2026ControlledStorageRecord(datasetId, {
    ...approvedAveragingRecord(),
    dataset_id: datasetId,
    file_name: "MTSP-Data-FY26.xlsx",
    storage_path: `fy2026/${datasetId}/${sha}/MTSP-Data-FY26.xlsx`,
    sha256: sha,
    byte_size: 833472,
    verified_crosswalk_count: 0,
  });
  assert.equal(result.reason_code, "CONTROLLED_STORAGE_CROSSWALK_INCOMPLETE");
  assert.equal(result.expected_crosswalk_count, 6);
});

test("invalid ledger controls are rejected before any object read", async () => {
  let reads = 0;
  const result = await loadFy2026IncomeLimitFromControlledStorage({
    dataset_id: "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
    storage_record: approvedAveragingRecord({ release_status: "verified" }),
    read_private_object: async () => {
      reads += 1;
      return new Uint8Array();
    },
  });
  assert.equal(result.reason_code, "CONTROLLED_STORAGE_APPROVAL_REQUIRED");
  assert.equal(reads, 0);
});

test("private bytes must match the approved ledger size before parsing", async () => {
  const result = await loadFy2026IncomeLimitFromControlledStorage({
    dataset_id: "HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18",
    storage_record: approvedAveragingRecord(),
    read_private_object: async ({ bucket }) => {
      assert.equal(bucket, FY2026_CONTROLLED_SOURCE_BUCKET);
      return new Uint8Array([1, 2, 3]);
    },
  });
  assert.equal(result.reason_code, "PRIVATE_STORAGE_OBJECT_SIZE_CONFLICT");
  assert.equal(result.actual_size_bytes, 3);
});

test("database controls keep workbook storage private and activation approval-bound", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260825190000_fy2026_controlled_workbook_storage.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /'federal-source-workbooks',[\s\S]*?false,[\s\S]*?5242880/,
  );
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(
    migration,
    /on storage\.objects[\s\S]{0,160}to (anon|authenticated)/i,
  );
  assert.match(
    migration,
    /approval\.action_type <> 'activate_fy2026_income_limit_workbook'/,
  );
  assert.match(migration, /approval\.requested_by = approval\.decided_by/);
  assert.match(
    migration,
    /crosswalk_rows <> new\.expected_crosswalk_count/,
  );
  assert.match(migration, /object_size is null or object_size <> new\.byte_size/);
});
