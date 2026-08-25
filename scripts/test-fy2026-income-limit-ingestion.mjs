import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROLLED_FY2026_GEOGRAPHY_CROSSWALK,
  CONTROLLED_FY2026_INCOME_LIMIT_SOURCES,
  CONTROLLED_FY2026_RENT_LIMIT_DATASET_FAMILIES,
  FY2026_LIMIT_INGESTION_ENGINE_BUILD,
  evaluateFy2026IncomeLimitSourceActivation,
  normalizeFy2026IncomeLimitDollar,
  validateFy2026IncomeLimitProgramHandoff,
  validateFy2026RentLimitProgramRegistration,
  validateFy2026IncomeLimitRecords,
} from "../src/lib/fy2026-income-limit-ingestion.mjs";

function record(source, target = source, value = "61039.99999999999") {
  return {
    source_geography_id: source,
    target_geography_id: target,
    limit_values: { household_2_60_pct: value },
  };
}

test("controlled FY2026 registry preserves the approved identities", () => {
  assert.equal(
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES.HUD_MTSP_LIMITS_FY2026.sha256,
    "fbc0af877e610d9cd3d9192febc6d4827319874605adc8897ca95366afac3465",
  );
  assert.equal(
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES
      .HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18.record_count,
    4764,
  );
  const mtsp =
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES.HUD_MTSP_LIMITS_FY2026;
  const averaging =
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES
      .HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18;
  assert.equal(mtsp.source_bytes_sha256_verified, true);
  assert.equal(mtsp.verified_size_bytes, 833472);
  assert.equal(mtsp.content_available_in_repository, false);
  assert.equal(
    mtsp.activation_status,
    "BLOCKED_PENDING_CONTROLLED_STORAGE_AND_CROSSWALK",
  );
  assert.equal(averaging.source_bytes_sha256_verified, true);
  assert.equal(averaging.verified_size_bytes, 1449076);
  assert.equal(
    averaging.activation_status,
    "BLOCKED_PENDING_CONTROLLED_STORAGE",
  );
  assert.equal(FY2026_LIMIT_INGESTION_ENGINE_BUILD.includes("2026.08.4"), true);
});

test("Excel artifacts normalize to exact dollars and never nearest fifty", () => {
  assert.equal(normalizeFy2026IncomeLimitDollar("61039.99999999999"), "61040");
  assert.equal(normalizeFy2026IncomeLimitDollar("61039.49"), "61039");
  assert.equal(normalizeFy2026IncomeLimitDollar("61074.99"), "61075");
});

test("known metadata without actual workbook bytes cannot activate", () => {
  const result = evaluateFy2026IncomeLimitSourceActivation({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    file_name: "MTSP-Data-FY26.xlsx",
    effective_from: "2026-05-01",
  });
  assert.equal(result.activation_status, "BLOCKED");
  assert.equal(result.reason_code, "SOURCE_WORKBOOK_BYTES_REQUIRED");
});

test("wrong workbook bytes cannot borrow an approved hash", () => {
  const result = evaluateFy2026IncomeLimitSourceActivation({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    file_name: "MTSP-Data-FY26.xlsx",
    effective_from: "2026-05-01",
    workbook_bytes: new TextEncoder().encode("not the HUD workbook"),
    records: [],
  });
  assert.equal(result.reason_code, "SOURCE_WORKBOOK_HASH_CONFLICT");
  assert.notEqual(result.actual_sha256, result.expected_sha256);
});

test("pending HOME, HTF, Section 8, and RD identities remain inactive", () => {
  for (const dataset_id of [
    "HUD_HOME_INCOME_LIMITS_FY2026",
    "HUD_HTF_INCOME_LIMITS_FY2026",
    "HUD_SECTION8_INCOME_LIMITS_FY2026",
    "USDA_RD_INCOME_LIMITS_FY2026",
  ]) {
    const result = evaluateFy2026IncomeLimitSourceActivation({ dataset_id });
    assert.equal(result.reason_code, "CONTROLLED_SOURCE_METADATA_INCOMPLETE");
  }
});

test("HOME and HTF official FY2026 identities stay registered but inactive", () => {
  const homeIncome =
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES.HUD_HOME_INCOME_LIMITS_FY2026;
  const htfIncome =
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES.HUD_HTF_INCOME_LIMITS_FY2026;
  const homeRent =
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES.HUD_HOME_RENT_LIMITS_FY2026;
  const htfRent =
    CONTROLLED_FY2026_INCOME_LIMIT_SOURCES.HUD_HTF_RENT_LIMITS_FY2026;

  for (const source of [homeIncome, htfIncome, homeRent, htfRent]) {
    assert.equal(source.effective_from, "2026-06-01");
    assert.match(source.official_landing_page, /^https:\/\/www\.huduser\.gov\//);
    assert.equal(source.content_available_in_repository, false);
    assert.match(source.activation_status, /^BLOCKED_/);
  }
  assert.equal(homeIncome.source_bytes_sha256_verified, false);
  assert.equal(htfIncome.source_bytes_sha256_verified, false);
  assert.equal(htfRent.source_bytes_sha256_verified, false);
  assert.deepEqual(CONTROLLED_FY2026_RENT_LIMIT_DATASET_FAMILIES.HOME, [
    "HUD_HOME_RENT_LIMITS_FY2026",
  ]);
  assert.deepEqual(CONTROLLED_FY2026_RENT_LIMIT_DATASET_FAMILIES.HTF, [
    "HUD_HTF_RENT_LIMITS_FY2026",
  ]);
});

test("rent datasets require a distinct program-bound receipt pipeline", () => {
  const home = validateFy2026RentLimitProgramRegistration(
    "HOME",
    "HUD_HOME_RENT_LIMITS_FY2026",
  );
  assert.equal(home.registration_status, "REGISTERED");
  assert.equal(home.activation_status, "BLOCKED");
  assert.equal(home.reason_code, "RENT_LIMIT_ACTIVATION_RECEIPT_PIPELINE_REQUIRED");
  assert.ok(home.missing_inputs.includes("rent_limit_activation_receipt"));

  const htf = validateFy2026RentLimitProgramRegistration(
    "HTF",
    "HUD_HTF_RENT_LIMITS_FY2026",
  );
  assert.equal(htf.reason_code, "CONTROLLED_RENT_SOURCE_METADATA_INCOMPLETE");
  assert.ok(htf.missing_inputs.includes("HUD_HTF_RENT_LIMITS_FY2026.sha256"));

  const crossed = validateFy2026RentLimitProgramRegistration(
    "HOME",
    "HUD_HTF_RENT_LIMITS_FY2026",
  );
  assert.equal(crossed.reason_code, "RENT_LIMIT_PROGRAM_BRANCH_CONFLICT");
});

test("rent datasets cannot be substituted into the income receipt path", () => {
  for (const [program, dataset] of [
    ["HOME", "HUD_HOME_RENT_LIMITS_FY2026"],
    ["HTF", "HUD_HTF_RENT_LIMITS_FY2026"],
  ]) {
    const result = validateFy2026IncomeLimitProgramHandoff(program, dataset, {});
    assert.equal(result.reason_code, "INCOME_LIMIT_PROGRAM_BRANCH_CONFLICT");
  }
});

test("unregistered source identifiers are rejected", () => {
  const result = evaluateFy2026IncomeLimitSourceActivation({
    dataset_id: "CALLER_CREATED_LIMITS",
  });
  assert.equal(result.reason_code, "UNREGISTERED_INCOME_LIMIT_SOURCE");
});

test("normalized geography records reject duplicate target keys", () => {
  const result = validateFy2026IncomeLimitRecords(
    [record("5400199999"), record("5400399999", "5400199999")],
    { expectedRecordCount: 2 },
  );
  assert.equal(result.reason_code, "DUPLICATE_INCOME_LIMIT_GEOGRAPHY");
});

test("normalized geography records reject missing or malformed keys", () => {
  const result = validateFy2026IncomeLimitRecords(
    [record("54001")],
    { expectedRecordCount: 1 },
  );
  assert.equal(result.reason_code, "INVALID_INCOME_LIMIT_GEOGRAPHY");
});

test("caller-created geography mappings cannot enter the controlled pack", () => {
  const result = validateFy2026IncomeLimitRecords(
    [record("2500199999", "2500399999")],
    { expectedRecordCount: 1 },
  );
  assert.equal(result.reason_code, "UNREGISTERED_GEOGRAPHY_CROSSWALK");
});

test("the six-row legacy crosswalk remains blocked until authority rows exist", () => {
  assert.equal(CONTROLLED_FY2026_GEOGRAPHY_CROSSWALK.length, 0);
  const result = validateFy2026IncomeLimitRecords([], {
    expectedRecordCount: 0,
    expectedLegacyCrosswalkCount: 6,
  });
  assert.equal(result.reason_code, "CONTROLLED_GEOGRAPHY_CROSSWALK_INCOMPLETE");
  assert.equal(result.expected_crosswalk_count, 6);
});

test("validated generic records normalize every named amount", () => {
  const result = validateFy2026IncomeLimitRecords(
    [
      {
        source_geography_id: "5400199999",
        target_geography_id: "5400199999",
        limit_values: { one_person: "61039.99999999999", two_person: "70000" },
      },
    ],
    { expectedRecordCount: 1 },
  );
  assert.equal(result.validation_status, "VALIDATED");
  assert.deepEqual(result.normalized_records[0].limit_values, {
    one_person: "61040",
    two_person: "70000",
  });
  assert.equal(result.nearest_fifty_rounding_performed, false);
});

test("record count mismatches block activation content", () => {
  const result = validateFy2026IncomeLimitRecords(
    [record("5400199999")],
    { expectedRecordCount: 4764 },
  );
  assert.equal(result.reason_code, "INCOME_LIMIT_RECORD_COUNT_CONFLICT");
  assert.equal(result.actual_record_count, 1);
});

test("program branches reject cross-program dataset substitution", () => {
  const result = validateFy2026IncomeLimitProgramHandoff(
    "HOME",
    "HUD_MTSP_LIMITS_FY2026",
    {},
  );
  assert.equal(result.reason_code, "INCOME_LIMIT_PROGRAM_BRANCH_CONFLICT");
});

test("public source hashes cannot be forged into activation receipts", () => {
  const result = validateFy2026IncomeLimitProgramHandoff(
    "LIHTC",
    "HUD_MTSP_LIMITS_FY2026",
    {
      activation_status: "ACTIVE",
      dataset_id: "HUD_MTSP_LIMITS_FY2026",
      source_sha256:
        "fbc0af877e610d9cd3d9192febc6d4827319874605adc8897ca95366afac3465",
      normalized_records_sha256: "1".repeat(64),
      record_count: 4764,
      engine_build: FY2026_LIMIT_INGESTION_ENGINE_BUILD,
    },
  );
  assert.equal(result.reason_code, "INCOME_LIMIT_ACTIVATION_RECEIPT_REQUIRED");
});

test("standalone normalized records are validation output, not activation authority", () => {
  const validation = validateFy2026IncomeLimitRecords(
    [record("5400199999")],
    { expectedRecordCount: 1 },
  );
  assert.equal(validation.validation_status, "VALIDATED");
  assert.equal(validation.activation_status, undefined);
  const handoff = validateFy2026IncomeLimitProgramHandoff(
    "LIHTC",
    "HUD_MTSP_LIMITS_FY2026",
    validation,
  );
  assert.equal(handoff.reason_code, "INCOME_LIMIT_ACTIVATION_RECEIPT_REQUIRED");
});
