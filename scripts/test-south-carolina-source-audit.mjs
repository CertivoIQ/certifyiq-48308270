import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(
    new URL(
      "../src/lib/south-carolina-state-pack-candidate.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("Test 92 records the official South Carolina domain transition", () => {
  assert.equal(candidate.test_id, 92);
  assert.equal(new URL(candidate.source_capture.supplied_official_url).hostname, "www.schousing.com");
  assert.equal(new URL(candidate.source_capture.redirected_official_url).hostname, "schousing.sc.gov");
  assert.equal(candidate.agency.legacy_domain, "schousing.com");
  assert.equal(candidate.agency.official_domain, "schousing.sc.gov");
});

test("records exact official links without inventing binary hashes", () => {
  assert.equal(candidate.source_capture.exact_binary_count, 0);
  assert.equal(candidate.source_capture.official_link_candidate_count, 14);
  assert.equal(candidate.official_link_candidates.length, 14);
  for (const source of candidate.official_link_candidates) {
    assert.equal(new URL(source.observed_url).hostname, candidate.agency.official_domain);
    assert.ok(!("sha256" in source));
    assert.ok(Number.isInteger(source.observed_page_count));
    assert.ok(source.observed_page_count > 0);
    assert.match(source.status, /^OFFICIAL_EXACT_LINK_OBSERVED_/);
  }
});

test("keeps the adopted 2026 authority separate from 2027 drafts", () => {
  const currentQap = candidate.official_link_candidates.find((source) => source.source_type === "CURRENT_QAP_WITH_AMENDMENTS");
  const approval = candidate.official_link_candidates.find((source) => source.source_type === "QAP_APPROVAL_CERTIFICATION");
  const draft = candidate.official_link_candidates.find((source) => source.source_type === "PROSPECTIVE_DRAFT_TAX_CREDIT_MANUAL");
  assert.equal(currentQap.observed_page_count, 23);
  assert.equal(approval.observed_page_count, 1);
  assert.match(draft.status, /DRAFT_NONOPERATIVE/);
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "SC-QAP-COMPOSITION-001"));
});

test("preserves separate compliance-manual and program-form scopes", () => {
  const types = new Set(candidate.official_link_candidates.map((source) => source.source_type));
  for (const type of ["LIHTC_COMPLIANCE_MANUAL","FEDERAL_STATE_PROGRAMS_COMPLIANCE_MANUAL","MULTIPLE_PROGRAM_GUIDEBOOK","TENANT_INCOME_CERTIFICATION","ASSET_SELF_CERTIFICATION","STUDENT_SELF_CERTIFICATION","LAYERED_ANNUAL_OWNER_CERTIFICATION"]) assert.ok(types.has(type), `missing source type: ${type}`);
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "SC-MANUAL-PRIORITY-001"));
  assert.ok(candidate.blocking_conflicts.some((conflict) => conflict.conflict_id === "SC-LAYERED-OWNER-CERT-001"));
});

test("keeps program limits and utility figures property scoped", () => {
  const utilitySources = candidate.official_link_candidates.filter((source) => source.source_type.startsWith("UTILITY_ALLOWANCE_"));
  assert.equal(utilitySources.length, 3);
  assert.ok(candidate.official_page_findings.some((finding) => finding.finding_id === "SC-2026-LIMIT-EFFECTIVE-DATES"));
  assert.ok(candidate.official_page_findings.some((finding) => finding.finding_id === "SC-2026-UTILITY-REGIONS"));
  assert.ok(candidate.property_figure_verification_scope.includes("approved utility allowance region, building type, method, evidence and effective date"));
});

test("keeps South Carolina fail-closed and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("HUD-confirmed county and property-specific income and rent limits with program effective dates"));
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
