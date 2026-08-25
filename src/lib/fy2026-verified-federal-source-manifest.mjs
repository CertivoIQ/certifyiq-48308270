import { createHash } from "node:crypto";

export const FY2026_VERIFIED_FEDERAL_SOURCE_MANIFEST_BUILD =
  "fy2026-verified-federal-source-manifest-2026.08.25.1";

export const VERIFIED_FY2026_FEDERAL_SOURCES = Object.freeze({
  HUD_HOME_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HOME_INCOME_LIMITS_FY2026",
    media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    file_name: "HOME_IncomeLmts_Natl_2026.xlsx",
    official_url:
      "https://www.huduser.gov/portal/datasets/home-datasets/files/HOME_IncomeLmts_Natl_2026.xlsx",
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/HOME-Income-limits.html",
    effective_from: "2026-06-01",
    sha256: "a6ce7095334cb14e6b84b5cfecd1ca708670bba6c87b98b3377d4e68807d3121",
    byte_size: 1182010,
    record_count: 4764,
    expected_legacy_geography_crosswalk_count: 6,
    activation_status: "BLOCKED_PENDING_CONTROLLED_STORAGE_CROSSWALK_AND_TWO_PERSON_APPROVAL",
  }),
  HUD_HOME_RENT_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_HOME_RENT_LIMITS_FY2026",
    media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    file_name: "HOME_RentLimits_Natl_2026.xlsx",
    official_url:
      "https://www.huduser.gov/portal/datasets/home-datasets/files/HOME_RentLimits_Natl_2026.xlsx",
    official_landing_page:
      "https://www.huduser.gov/portal/datasets/HOME-Rent-limits.html",
    effective_from: "2026-06-01",
    sha256: "3082bd081727dea71dd62abcb811e3d26ce605f1f645fd5cd8dbcb76e8d4f133",
    byte_size: 1190828,
    record_count: 4764,
    expected_legacy_geography_crosswalk_count: 0,
    activation_status: "BLOCKED_PENDING_CONTROLLED_STORAGE_RENT_RECEIPT_AND_TWO_PERSON_APPROVAL",
  }),
  HUD_SECTION8_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "HUD_SECTION8_INCOME_LIMITS_FY2026",
    media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    file_name: "Section8-FY26.xlsx",
    official_url:
      "https://www.huduser.gov/portal/datasets/il/il26/Section8-FY26.xlsx",
    official_landing_page: "https://www.huduser.gov/portal/datasets/il.html",
    effective_from: "2026-05-01",
    sha256: "bbadf0a080112fc1492c7752692c041c6a4299aad0173873b732c3f892d9aee0",
    byte_size: 771324,
    record_count: 4764,
    expected_legacy_geography_crosswalk_count: 6,
    activation_status: "BLOCKED_PENDING_CONTROLLED_STORAGE_CROSSWALK_AND_TWO_PERSON_APPROVAL",
  }),
  USDA_RD_INCOME_LIMITS_FY2026: Object.freeze({
    dataset_id: "USDA_RD_INCOME_LIMITS_FY2026",
    media_type: "application/pdf",
    file_name: "rd-mfhlimitmap.pdf",
    official_url:
      "https://www.rd.usda.gov/media/file/download/rd-mfhlimitmap.pdf",
    official_landing_page:
      "https://www.rd.usda.gov/programs-services/multi-family-housing-programs",
    publication_notice: "PN 657",
    effective_from: "2026-07-13",
    sha256: "d3ee9999dd37075382216cf6cdb9dd702ad9113b526acf18849864c80e997e1f",
    byte_size: 2215833,
    expected_page_count: 390,
    activation_status: "BLOCKED_PENDING_DETERMINISTIC_PDF_PARSE_PRIVATE_STORAGE_AND_TWO_PERSON_APPROVAL",
  }),
});

function blocked(reason_code, missing_inputs = [], details = {}) {
  return {
    ingestion_status: "BLOCKED",
    rule_engine_authority: "BLOCKED",
    finding: "UNABLE_TO_DETERMINE",
    reason_code,
    missing_inputs: [...new Set(missing_inputs)].sort(),
    human_approval_required: true,
    independent_two_person_approval_required: true,
    ...details,
  };
}

/**
 * Validate the exact official USDA PDF bytes and stage their identity.
 * This deliberately cannot issue rule-engine authority. A trusted deterministic
 * parser receipt, private object receipt, and bound two-person approval must be
 * validated by the production release control plane.
 */
export function stageUsdaRdFy2026Pdf(input = {}) {
  const source = VERIFIED_FY2026_FEDERAL_SOURCES.USDA_RD_INCOME_LIMITS_FY2026;
  if (
    input.file_name !== source.file_name ||
    input.official_url !== source.official_url ||
    input.effective_from !== source.effective_from
  ) {
    return blocked("USDA_RD_PDF_IDENTITY_CONFLICT", [
      "file_name",
      "official_url",
      "effective_from",
    ]);
  }
  if (!(input.pdf_bytes instanceof Uint8Array) || input.pdf_bytes.byteLength === 0) {
    return blocked("USDA_RD_PDF_BYTES_REQUIRED", ["pdf_bytes"]);
  }
  const bytes = input.pdf_bytes;
  if (
    bytes.byteLength !== source.byte_size ||
    createHash("sha256").update(bytes).digest("hex") !== source.sha256
  ) {
    return blocked("USDA_RD_PDF_HASH_OR_SIZE_CONFLICT", ["pdf_bytes"]);
  }
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    return blocked("USDA_RD_PDF_SIGNATURE_CONFLICT", ["pdf_bytes"]);
  }
  return blocked(
    "USDA_RD_PDF_VERIFIED_PENDING_CONTROLLED_ACTIVATION",
    [
      "private_storage_object_receipt",
      "deterministic_pdf_parser_receipt",
      "normalized_records_sha256",
      "geography_coverage_receipt",
      "bound_independent_two_person_approval",
    ],
    {
      ingestion_status: "STAGED",
      dataset_id: source.dataset_id,
      source_sha256: source.sha256,
      source_byte_size: source.byte_size,
      expected_page_count: source.expected_page_count,
      source_identity_verified: true,
      pdf_ingestion_path_approved: true,
    },
  );
}
