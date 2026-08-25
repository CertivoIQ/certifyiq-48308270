import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  VERIFIED_FY2026_FEDERAL_SOURCES,
  stageUsdaRdFy2026Pdf,
} from "../src/lib/fy2026-verified-federal-source-manifest.mjs";

test("verified HUD source identities retain exact official metadata but no authority", () => {
  for (const id of [
    "HUD_HOME_INCOME_LIMITS_FY2026",
    "HUD_HOME_RENT_LIMITS_FY2026",
    "HUD_SECTION8_INCOME_LIMITS_FY2026",
  ]) {
    const source = VERIFIED_FY2026_FEDERAL_SOURCES[id];
    assert.match(source.official_url, /^https:\/\/www\.huduser\.gov\//);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(source.record_count, 4764);
    assert.match(source.activation_status, /^BLOCKED_/);
  }
});

test("USDA PDF registration never grants authority from metadata or caller claims", () => {
  const source = VERIFIED_FY2026_FEDERAL_SOURCES.USDA_RD_INCOME_LIMITS_FY2026;
  const result = stageUsdaRdFy2026Pdf({
    ...source,
    pdf_bytes: new TextEncoder().encode("%PDF-forged"),
    parser_receipt: { status: "PARSED" },
    approved: true,
    rule_engine_authority: "ALLOWED",
  });
  assert.equal(result.rule_engine_authority, "BLOCKED");
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "USDA_RD_PDF_HASH_OR_SIZE_CONFLICT");
  assert.equal(result.independent_two_person_approval_required, true);
});

test("USDA PDF storage migration binds parser, private object, and distinct approver", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260825213000_fy2026_usda_rd_pdf_storage.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /'federal-source-pdfs'.*false/s);
  assert.match(migration, /parser_build ~ '\^fy2026-usda-rd-pdf-parser-'/);
  assert.match(migration, /parsed_page_count = expected_page_count/);
  assert.match(migration, /normalized_records_sha256 is not null/);
  assert.match(migration, /geography_coverage_sha256 is not null/);
  assert.match(migration, /approval\.requested_by = approval\.decided_by/);
  assert.match(migration, /approval\.action_snapshot @> jsonb_build_object/);
  assert.match(migration, /object_size is null or object_size <> new\.byte_size/);
  assert.doesNotMatch(migration, /on storage\.objects/);
});
