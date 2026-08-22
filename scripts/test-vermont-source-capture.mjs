import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/vermont-state-pack-candidate.json", import.meta.url), "utf8"),
);

const exact = candidate.exact_binary_sources;

test("Test 87 records exact identities for the captured VHFA inventory", () => {
  assert.equal(candidate.test_id, 87);
  assert.equal(candidate.source_capture.exact_binary_count, 14);
  assert.equal(exact.length, 14);
  for (const source of exact) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    assert.equal(new URL(source.official_url).hostname.replace(/^www\./, ""), "vhfa.org");
    assert.match(source.status, /^EXACT_BYTES_CAPTURED/);
  }
});

test("preserves the approved current QAP and the non-operative 2026 draft", () => {
  const current = exact.find((source) => source.source_type === "CURRENT_QAP");
  const draft = exact.find((source) => source.source_type === "PROSPECTIVE_DRAFT_QAP");
  assert.match(current.official_page_authority, /Governor approved 2023-05/);
  assert.match(current.document_self_identified_revision, /effective 2023-10-01/);
  assert.match(draft.status, /DRAFT_NOT_ADOPTED/);
  assert.notEqual(current.sha256, draft.sha256);
});

test("captures Vermont limits without flattening program and property scopes", () => {
  const types = new Set(exact.map((source) => source.source_type));
  for (const type of ["SECTION_8_LIMITS", "LIHTC_LIMITS", "AVERAGE_INCOME_LIMITS", "AVERAGE_INCOME_POLICY"])
    assert.ok(types.has(type), `missing source type: ${type}`);
  assert.match(exact.find((source) => source.source_type === "SECTION_8_LIMITS").status, /LAYERED_PROGRAM_ONLY/);
  assert.match(exact.find((source) => source.source_type === "LIHTC_LIMITS").status, /PROPERTY_DATE_AND_HOLD_HARMLESS/);
  assert.equal(exact.find((source) => source.source_type === "AVERAGE_INCOME_LIMITS").effective_date, "2026-05-01");
});

test("captures compliance, owner and tenant sources with restricted scopes", () => {
  for (const title of [
    "VHFA LIHTC Compliance Manual",
    "Owner's Certificate of Continuing Program Compliance",
    "Tenant Income Certification Form",
    "Full-time Student Eligibility Form",
    "Student Financial Assistance Affidavit",
    "Housing Tax Credit Year 15 Policy",
    "Resident Annual Self-Certification",
  ]) assert.ok(exact.some((source) => source.title === title), `missing exact capture: ${title}`);
  assert.match(exact.find((source) => source.source_type === "COMPLIANCE_MANUAL").status, /HOTMA_AND_NEWER_FORM_RECONCILIATION/);
  assert.match(exact.find((source) => source.source_type === "EXTENDED_USE_POLICY").status, /POST_YEAR_15_ONLY/);
});

test("keeps Vermont blocked and VP-gated", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("placed-in-service and hold-harmless dates"));
  assert.match(candidate.enterprise_boundary, /Completed tenant certifications/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
