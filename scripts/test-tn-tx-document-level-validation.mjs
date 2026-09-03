import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const crawler = readFileSync(new URL("./crawl-tn-tx-release-critical-documents.mjs", import.meta.url), "utf8");
const invalidation = readFileSync(
  new URL("../supabase/migrations/20260903190000_invalidate_tn_tx_html_page_evidence.sql", import.meta.url),
  "utf8",
);

test("TN/TX validation distinguishes discovery pages from downloadable document evidence", () => {
  assert.match(crawler, /evidence_kind:\s*"discovery_page_only"/);
  assert.match(crawler, /validation_evidence_eligible:\s*false/);
  assert.match(crawler, /evidence_kind:\s*"exact_document_bytes"/);
  assert.match(crawler, /validation_evidence_eligible:\s*true/);
  assert.match(crawler, /response_is_not_a_supported_document/);
  assert.match(crawler, /Only exact downloadable document bytes satisfy TN\/TX state validation/);
  assert.doesNotMatch(crawler, /compliance_activation_allowed:\s*true/);
});

test("THDA CloudFront attachments are accepted only from the exact current distribution host", () => {
  assert.match(crawler, /dogvxws799i6n\.cloudfront\.net/);
  assert.match(crawler, /THDA_ATTACHMENT_HOST/);
  assert.match(crawler, /STATE_HOSTS/);
  assert.match(crawler, /unapproved_source_host/);
  assert.match(crawler, /redirected_to_unapproved_host/);
});

test("TN source set requires actual LIHTC, HOTMA, HCV, Section 8, and PBV documents", () => {
  for (const token of [
    "TN_2026_LIHTC_QAP",
    "TN_THOMAS_COMPLIANCE_GUIDE",
    "TN_HOTMA_COMPLIANCE_GUIDANCE",
    "TN_EMPLOYMENT_VERIFICATION_FORM",
    "TN_ASSET_SELF_CERTIFICATION_FORM",
    "TN_SECTION8_INCOME_VERIFICATION_FORM",
    "TN_HCV_ADMIN_PLAN",
    "TN_HCV_2026_HOTMA_NSPIRE_RULE_UPDATE",
    "TN_PBV_2025_ADMIN_PLAN_AMENDMENT",
    "TN_2026_HCV_UTILITY_ALLOWANCE_METHODOLOGY",
    "TN_2026_HCV_UTILITY_ALLOWANCE_INSTRUCTIONS",
  ]) assert.match(crawler, new RegExp(token));

  for (const program of ["LIHTC", "HOTMA", "SECTION_8", "HCV", "PBV"]) {
    assert.match(crawler, new RegExp(`${program}: \\[`, "m"));
  }
  assert.match(crawler, /PBV_ADMIN_CHAPTER/);
  assert.match(crawler, /PBV_ADMIN_PLAN_AMENDMENT/);
});

test("TX source set requires actual current rules, HOTMA forms, HCV and PBV policy documents", () => {
  for (const token of [
    "TX_2026_LIHTC_QAP",
    "TX_LIHTC_COMPLIANCE_RULE_SUBCHAPTER_F",
    "TX_HOTMA_INCOME_CERTIFICATION_FORM",
    "TX_HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS",
    "TX_ASSET_CERTIFICATION_FORM",
    "TX_HOTMA_EMPLOYMENT_VERIFICATION_FORM",
    "TX_SECTION8_INCOME_VERIFICATION_FORM",
    "TX_HCV_PBV_ADMIN_PLAN",
    "TX_2026_HCV_UTILITY_ALLOWANCE",
    "TX_2027_HCV_PHA_PLAN",
  ]) assert.match(crawler, new RegExp(token));
  assert.match(crawler, /document_roles:\s*\["HCV_ADMIN_PLAN", "PBV_ADMIN_CHAPTER"\]/);
});

test("the correction migration invalidates only legacy HTML page evidence and fails the TN/TX packs closed", () => {
  assert.match(invalidation, /origin_file = 'tn-tx-release-critical-documents-2026-09-02\.json'/);
  assert.match(invalidation, /verification_evidence->>'content_type'.*text\/html/s);
  assert.match(invalidation, /agent_verification_status = 'captured_unvalidated'/);
  assert.match(invalidation, /compliance_activation_allowed = false/);
  assert.match(invalidation, /'validation_evidence_eligible', false/);
  assert.match(invalidation, /'release_critical_document_families_captured', false/);
  assert.match(invalidation, /'document_level_recrawl_required', true/);
  assert.doesNotMatch(invalidation, /delete\s+from\s+public\.state_rule_source_candidates/i);
});
