import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/washington-state-pack-candidate.json", import.meta.url), "utf8"),
);

const exact = candidate.exact_binary_sources;

test("Test 84 records exact identities for the captured WSHFC inventory", () => {
  assert.equal(candidate.test_id, 84);
  assert.equal(candidate.source_capture.exact_binary_count, 26);
  assert.equal(exact.length, 26);
  for (const source of exact) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    const host = new URL(source.official_url).hostname.replace(/^www\./, "");
    assert.equal(host, "wshfc.org");
    assert.match(source.status, /^EXACT_BYTES_CAPTURED/);
  }
});

test("captures the current Washington allocation package without flattening its authority layers", () => {
  const qap = exact.find((source) => source.source_type === "QUALIFIED_ALLOCATION_PLAN");
  const policies = exact.find((source) => source.source_type === "PROGRAM_POLICY");
  const instructions = exact.find((source) => source.source_type === "APPLICATION_INSTRUCTIONS");
  assert.equal(qap.document_self_identified_revision, "Amended 2012-06-28");
  assert.match(policies.document_self_identified_revision, /2026-08-05/);
  assert.match(instructions.status, /PROSPECTIVE_APPLICATION_ONLY/);
  assert.ok(exact.some((source) => source.source_type === "PROGRAM_RULES"));
});

test("captures all twelve compliance manual chapters and key supplements", () => {
  const chapters = exact
    .filter((source) => source.source_type === "COMPLIANCE_MANUAL_CHAPTER")
    .map((source) => source.chapter);
  assert.deepEqual(chapters, [1,2,3,4,5,6,7,8,9,10,11,12]);
  for (const title of [
    "Tax Credit Frequently Asked Questions",
    "Utility Allowance Procedures for LIHTC Properties",
    "Owner's Annual Certification",
    "2025 Tax Credit Annual Reports Submission Instructions",
  ]) assert.ok(exact.some((source) => source.title === title), `missing exact capture: ${title}`);
});

test("captures required tenant forms and preserves restricted scopes", () => {
  for (const title of [
    "Household Eligibility Application",
    "Tenant Income Certification with Calculations",
    "Self-Certification of Annual Income",
    "Student Certification",
    "Tax Credit Lease Rider - Tax Credit Property",
  ]) assert.ok(exact.some((source) => source.title === title), `missing exact capture: ${title}`);
  assert.match(exact.find((source) => source.title === "Self-Certification of Annual Income").status, /100_PERCENT_LIHTC/);
  assert.match(exact.find((source) => source.chapter === 11).status, /POST_YEAR_15/);
  assert.match(exact.find((source) => source.chapter === 8).status, /LAYERED_PROGRAM_ONLY/);
});

test("keeps interactive limits and inspection guidance fail closed", () => {
  assert.equal(candidate.page_only_sources.length, 2);
  assert.ok(candidate.page_only_sources.every((source) => /^OFFICIAL_/.test(source.status)));
  assert.ok(candidate.page_only_sources.every((source) => !source.sha256));
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
});

test("requires VP Compliance property verification and preserves enterprise records", () => {
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("property and county specific income and rent limits"));
  assert.ok(candidate.property_figure_verification_scope.includes("utility allowances"));
  assert.match(candidate.enterprise_boundary, /Only blank official forms/);
  assert.match(candidate.enterprise_boundary, /Completed tenant certifications/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
