import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/virgin-islands-state-pack-candidate.json", import.meta.url), "utf8"),
);

const exact = candidate.exact_binary_sources;

test("Test 86 records exact identities for the linked VIHFA QAP materials", () => {
  assert.equal(candidate.test_id, 86);
  assert.equal(candidate.source_capture.exact_binary_count, 3);
  assert.equal(exact.length, 3);
  for (const source of exact) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    assert.equal(new URL(source.official_url).hostname, "vihfa.gov");
    assert.match(source.status, /^EXACT_BYTES_CAPTURED/);
  }
});

test("does not promote historic or draft QAP material", () => {
  const historic = exact.find((source) => source.source_type === "HISTORIC_QAP");
  const draft = exact.find((source) => source.source_type === "QAP_DRAFT");
  assert.match(historic.status, /HISTORIC_NOT_CURRENT/);
  assert.equal(draft.official_page_label, "2023 Qualified Allocation Plan draft");
  assert.match(draft.status, /PENDING_ADOPTION_EVIDENCE/);
  assert.ok(!exact.some((source) => source.source_type === "CURRENT_ADOPTED_QAP"));
});

test("records the stale allocation figure and missing current operational sources", () => {
  const ids = new Set(candidate.official_page_findings.map((finding) => finding.finding_id));
  assert.deepEqual(ids, new Set(["VI-PAGE-ALLOCATION-2015", "VI-PAGE-LIMITS", "VI-PAGE-MONITORING"]));
  assert.ok(candidate.official_page_findings.some((finding) => /2015 territorial allocation/.test(finding.description)));
  assert.ok(candidate.official_page_findings.some((finding) => /no current limit schedule/.test(finding.description)));
  assert.ok(candidate.official_page_findings.some((finding) => /no compliance manual/.test(finding.description)));
});

test("keeps the Virgin Islands candidate blocked and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("HUD-confirmed income and rent limits"));
  assert.match(candidate.enterprise_boundary, /Completed tenant files/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
