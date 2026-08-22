import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/tennessee-state-pack-candidate.json", import.meta.url), "utf8"),
);

test("Test 90 records exact Tennessee QAP identities", () => {
  assert.equal(candidate.test_id, 90);
  assert.equal(candidate.source_capture.exact_binary_count, 2);
  assert.equal(candidate.exact_binary_sources.length, 2);
  for (const source of candidate.exact_binary_sources) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    assert.equal(new URL(source.official_url).hostname, "thda.org");
    assert.match(source.status, /^EXACT_BYTES_CAPTURED/);
  }
});

test("preserves approved current QAP and excludes the prospective draft", () => {
  const current = candidate.exact_binary_sources.find((source) => source.source_type === "CURRENT_QAP");
  const draft = candidate.exact_binary_sources.find((source) => source.source_type === "PROSPECTIVE_DRAFT_QAP");
  assert.match(current.document_self_identified_authority, /Governor approved 2025-12-17/);
  assert.match(current.status, /CURRENT_GOVERNOR_APPROVED/);
  assert.match(draft.document_self_identified_authority, /approval dates blank/);
  assert.match(draft.status, /DRAFT_NOT_ADOPTED/);
  assert.notEqual(current.sha256, draft.sha256);
});

test("records only observed THDA-linked CDN candidates without inventing hashes", () => {
  assert.equal(candidate.source_capture.official_link_candidate_count, 6);
  assert.equal(candidate.official_link_candidates.length, 6);
  for (const source of candidate.official_link_candidates) {
    assert.equal(new URL(source.official_page_url).hostname, "thda.org");
    assert.equal(new URL(source.observed_url).hostname, candidate.agency.official_cdn_domain);
    assert.ok(!("sha256" in source));
    assert.match(source.status, /^OFFICIAL_PAGE_LINK_OBSERVED_CDN_BYTES_NOT_CAPTURED/);
  }
});

test("keeps broken compliance navigation and incomplete 2026 guidance fail closed", () => {
  assert.equal(candidate.source_capture.advertised_compliance_result, "404_PAGE_NOT_FOUND");
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "TN-COMPLIANCE-NAV-001"));
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "TN-2026-GUIDANCE-CURRENCY-001"));
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "TN-LIMITS-001"));
});

test("keeps Tennessee blocked and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("county and property-specific income and rent limits"));
  assert.match(candidate.enterprise_boundary, /THOMAS records/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
