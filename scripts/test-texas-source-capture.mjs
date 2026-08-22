import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/texas-state-pack-candidate.json", import.meta.url), "utf8"),
);

const exact = candidate.exact_binary_sources;

test("Test 89 records exact identities for the captured TDHCA inventory", () => {
  assert.equal(candidate.test_id, 89);
  assert.equal(candidate.source_capture.exact_binary_count, 8);
  assert.equal(exact.length, 8);
  for (const source of exact) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    assert.equal(new URL(source.official_url).hostname.replace(/^www\./, ""), "tdhca.texas.gov");
    assert.match(source.status, /^EXACT_BYTES_CAPTURED/);
  }
});

test("preserves adopted QAP authority while requiring TAC reconciliation", () => {
  const qap = exact.find((source) => source.source_type === "CURRENT_QAP");
  assert.match(qap.title, /2026 Governor Approved/);
  assert.match(qap.document_self_identified_revision, /2025-12-01/);
  assert.match(qap.status, /COURTESY_COPY_PENDING_TAC_RECONCILIATION/);
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "TX-QAP-TAC-001"));
});

test("captures compliance rules and blank forms without promoting enterprise records", () => {
  for (const type of [
    "COMPLIANCE_MONITORING_RULE",
    "TENANT_INCOME_CERTIFICATION",
    "STUDENT_ELIGIBILITY_FORM",
    "OWNER_ELECTRONIC_FILE_CERTIFICATION",
    "ANNUAL_TENANT_ELIGIBILITY_CERTIFICATION",
  ]) assert.ok(exact.some((source) => source.source_type === type), `missing source type: ${type}`);
  assert.match(candidate.enterprise_boundary, /CMTS submissions/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});

test("requires property inputs and separate results for layered programs", () => {
  const limit = exact.find((source) => source.source_type === "INCOME_RENT_TOOL_INSTRUCTIONS");
  assert.match(limit.status, /PROPERTY_INPUT_DEPENDENT_NO_STATEWIDE_FIGURE_ACTIVATION/);
  assert.match(candidate.page_authorities.find((source) => source.source_type === "PROPERTY_LIMIT_TOOL_AUTHORITY").authority_note, /not definitive/);
  assert.ok(candidate.property_figure_verification_scope.includes("9% LIHTC, 4% bond, HOME and NHTF layering"));
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "TX-LAYERED-PROGRAM-001"));
});

test("keeps property-specific utility allowances and owner reporting fail closed", () => {
  assert.match(exact.find((source) => source.source_type === "UTILITY_ALLOWANCE_GUIDANCE").status, /PENDING_PROPERTY_EVIDENCE/);
  assert.match(candidate.page_authorities.find((source) => source.source_type === "COMPLIANCE_PAGE").authority_note, /CMTS/);
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "TX-ANNUAL-CERT-SCOPE-001"));
});

test("keeps Texas blocked and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("county, designated place and property-specific income and rent limits"));
});
