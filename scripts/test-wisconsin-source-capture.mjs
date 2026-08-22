import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/wisconsin-state-pack-candidate.json", import.meta.url), "utf8"),
);

const exact = [
  ...candidate.official_source_candidates,
  ...candidate.official_blank_form_candidates,
  ...candidate.official_figure_candidates,
  ...candidate.monitoring_policy_candidates,
];

test("Test 83 records exact identities for the captured WHEDA inventory", () => {
  assert.equal(candidate.test_id, 83);
  assert.equal(candidate.source_capture.exact_binary_count, 26);
  assert.equal(exact.length, 26);
  for (const source of exact) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    const host = new URL(source.official_url).hostname.replace(/^www\./, "");
    assert.equal(host, "wheda.com");
    assert.match(source.status, /^EXACT_BYTES_CAPTURED/);
  }
});

test("captures a complete seven-document modification lineage for the current QAP", () => {
  const current = candidate.official_source_candidates.find((s) => s.source_type === "CURRENT_CONSOLIDATED_QAP");
  assert.equal(current.document_self_identified_revision, "2026-07");
  const modifications = candidate.official_source_candidates.filter((s) => s.source_type === "QAP_MODIFICATION");
  assert.deepEqual(modifications.map((s) => s.modification_number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(modifications.map((s) => s.sha256)).size, 7);
  assert.ok(candidate.official_source_candidates.some((s) => s.source_type === "PROSPECTIVE_QAP"));
});

test("captures the compliance manual and required blank monitoring forms", () => {
  const titles = new Set(exact.map((source) => source.title));
  for (const title of [
    "HTC Compliance Monitoring Manual",
    "Owner Certificate of Continuing Compliance",
    "Form 100 Instructions",
    "Tenant Income Certification",
    "TIC Instructions",
    "Student Status Verification",
    "Affidavit of Student Financial Assistance",
    "Tenant Income Self-Recertification",
  ]) assert.ok(titles.has(title), `missing exact capture: ${title}`);
});

test("keeps each Wisconsin figure table in its own program scope", () => {
  assert.deepEqual(candidate.official_figure_candidates.map((s) => s.figure_type), [
    "MTSP_LIMITS",
    "HERA_SPECIAL_LIMITS",
    "AVERAGE_INCOME_LIMITS",
    "SECTION_8_INCOME_LIMITS",
    "WHEDA_FINANCING_ONLY_LIMITS",
  ]);
  assert.equal(candidate.official_figure_candidates[0].effective_date, "2026-05-01");
  assert.ok(candidate.official_figure_candidates.every((source) => /SCOPE|FIGURE/.test(source.status)));
});

test("keeps Wisconsin source and scope conflicts fail closed", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.deepEqual(
    new Set(candidate.blocking_conflicts.map((conflict) => conflict.conflict_id)),
    new Set([
      "WI-QAP-COMPOSITION-001",
      "WI-PROSPECTIVE-2027-001",
      "WI-MODIFICATION-SCOPE-001",
      "WI-LIMIT-LAYERING-001",
      "WI-EXTENDED-USE-FORM-SCOPE-001",
      "WI-MANUAL-SUPPLEMENT-001",
    ]),
  );
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
});

test("requires VP Compliance property verification and preserves enterprise records", () => {
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("property-specific program layering"));
  assert.ok(candidate.property_figure_verification_scope.includes("utility allowances"));
  assert.match(candidate.enterprise_boundary, /Only blank official forms/);
  assert.match(candidate.enterprise_boundary, /Completed tenant certifications/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
