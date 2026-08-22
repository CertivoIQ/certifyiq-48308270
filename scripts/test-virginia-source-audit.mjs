import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/virginia-state-pack-candidate.json", import.meta.url), "utf8"),
);

test("Test 85 records exact official Virginia links without inventing binary identities", () => {
  assert.equal(candidate.test_id, 85);
  assert.equal(candidate.source_capture.exact_binary_count, 0);
  assert.equal(candidate.official_link_candidates.length, 14);
  assert.ok(candidate.official_link_candidates.every((source) => /^OFFICIAL_/.test(source.status)));
  assert.ok(candidate.official_link_candidates.every((source) => !source.sha256 && !source.file_bytes && !source.observed_pages));
  const hosts = new Set(candidate.official_link_candidates.map((source) => new URL(source.official_url).hostname));
  assert.deepEqual(hosts, new Set([candidate.agency.official_asset_host, "www.ncsha.org"]));
});

test("separates the adopted QAP from prospective draft materials", () => {
  assert.ok(candidate.official_link_candidates.some((source) => source.source_type === "CURRENT_QAP" && source.title === "2026 QAP"));
  assert.ok(candidate.official_link_candidates.some((source) => source.source_type === "PROSPECTIVE_DRAFT_QAP" && /PROSPECTIVE_DRAFT/.test(source.status)));
  assert.ok(candidate.official_link_candidates.some((source) => source.source_type === "PROSPECTIVE_QAP_CHANGES" && /PROSPECTIVE_PROPOSAL/.test(source.status)));
});

test("keeps Virginia figure sources resource-only and HUD-confirmed", () => {
  const figures = candidate.official_link_candidates.filter((source) => ["LIMIT_MEMO", "LIMIT_WORKBOOK", "HERA_LIMITS"].includes(source.source_type));
  assert.equal(figures.length, 3);
  assert.ok(figures.every((source) => /RESOURCE_ONLY|HERA_SCOPE/.test(source.status)));
  assert.ok(candidate.official_authority_notes.some((note) => /confirm MTSP and National Non-Metropolitan limits on HUD/.test(note)));
  assert.ok(candidate.property_figure_verification_scope.includes("HERA Special locality and pre-2009 eligibility"));
});

test("preserves external model-form and financing-only form boundaries", () => {
  const model = candidate.official_link_candidates.find((source) => source.source_type === "MODEL_FORM_DEPENDENCY");
  const lease = candidate.official_link_candidates.find((source) => source.title === "Lease Addendum (MD 225)");
  assert.match(model.status, /VERSION_BINDING/);
  assert.match(lease.status, /FINANCING_ONLY/);
});

test("keeps Virginia blocked and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.match(candidate.enterprise_boundary, /Completed tenant certifications/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
