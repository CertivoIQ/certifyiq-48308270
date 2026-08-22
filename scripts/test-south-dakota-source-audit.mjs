import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/south-dakota-state-pack-candidate.json", import.meta.url), "utf8"),
);

test("Test 91 records the official South Dakota domain transition", () => {
  assert.equal(candidate.test_id, 91);
  assert.equal(new URL(candidate.source_capture.supplied_official_url).hostname, "www.sdhda.org");
  assert.equal(new URL(candidate.source_capture.redirected_official_url).hostname, "www.sdhousing.org");
  assert.equal(candidate.agency.legacy_domain, "sdhda.org");
  assert.equal(candidate.agency.official_domain, "sdhousing.org");
});

test("records exact official link candidates without inventing binary identities", () => {
  assert.equal(candidate.source_capture.exact_binary_count, 0);
  assert.equal(candidate.source_capture.official_link_candidate_count, 7);
  assert.equal(candidate.official_link_candidates.length, 7);
  for (const source of candidate.official_link_candidates) {
    assert.equal(new URL(source.observed_url).hostname.replace(/^www\./, ""), candidate.agency.official_domain);
    assert.ok(!("sha256" in source));
    assert.match(source.status, /^OFFICIAL_PAGE_LINK_OBSERVED_EXACT_BYTES_NOT_CAPTURED/);
  }
});

test("covers current-looking QAP, compliance, utility and tenant sources", () => {
  const types = new Set(candidate.official_link_candidates.map((source) => source.source_type));
  for (const type of [
    "CURRENT_QAP",
    "COMPLIANCE_MANUAL",
    "UTILITY_ALLOWANCE_WORKSHEET",
    "TENANT_INCOME_CERTIFICATION",
    "STUDENT_SELF_CERTIFICATION",
    "STUDENT_FINANCIAL_ASSISTANCE_FORM",
    "ASSET_CERTIFICATION",
  ]) assert.ok(types.has(type), `missing source type: ${type}`);
});

test("keeps HUD limits and 2026 utility methods property scoped", () => {
  assert.ok(candidate.official_page_findings.some((finding) => finding.finding_id === "SD-HUD-LIMIT-AUTHORITY"));
  assert.ok(candidate.official_page_findings.some((finding) => finding.finding_id === "SD-2026-UTILITY-METHODS"));
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "SD-UTILITY-ALLOWANCE-001"));
  assert.ok(candidate.property_figure_verification_scope.includes("approved utility allowance method, evidence and effective date"));
});

test("keeps South Dakota blocked and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("HUD-confirmed county and property-specific income and rent limits"));
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
