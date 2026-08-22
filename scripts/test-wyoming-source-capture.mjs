import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/wyoming-state-pack-candidate.json", import.meta.url), "utf8"),
);

const exact = [
  ...candidate.official_source_candidates,
  ...candidate.official_blank_form_candidates,
].filter((source) => source.status.startsWith("EXACT_BYTES_CAPTURED"));

test("Test 82 records exact identities for the captured WCDA inventory", () => {
  assert.equal(candidate.test_id, 82);
  assert.equal(candidate.source_capture.exact_binary_count, 12);
  assert.equal(exact.length, 12);
  for (const source of exact) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(Number.isSafeInteger(source.observed_pages) && source.observed_pages > 0);
    const host = new URL(source.official_url).hostname.replace(/^www\./, "");
    assert.equal(host, "wyomingcda.com");
  }
});

test("captures the current plan, prospective variants, manual, TIC package, and blank forms", () => {
  const titles = new Set(exact.map((source) => source.title));
  for (const title of [
    "2026 Affordable Housing Allocation Plan",
    "2027 Affordable Housing Allocation Plan (FINAL-1)",
    "2027 Affordable Housing Allocation Plan (FINAL)",
    "2025-2026 Affordable Rental Housing Compliance Manual",
    "Tenant Income Certification",
    "Tenant Income Certification Instructions",
    "Annual Owner Certification for LIHTC (2021 secured)",
    "Certification of Zero Income",
    "Self Certification Questionnaire (LIHTC)",
    "Student Self-Certification (LIHTC)",
  ]) assert.ok(titles.has(title), `missing exact capture: ${title}`);
});

test("detects duplicate and competing official byte identities", () => {
  const plans = candidate.official_source_candidates.filter((s) => s.source_type === "PROSPECTIVE_ALLOCATION_PLAN_VARIANT");
  assert.equal(plans.length, 2);
  assert.notEqual(plans[0].sha256, plans[1].sha256);
  assert.equal(plans[0].extracted_text_sha256, plans[1].extracted_text_sha256);
  assert.equal(plans[0].file_bytes, plans[1].file_bytes);
  const owner2019 = candidate.official_blank_form_candidates.filter((s) => s.document_self_identified_version === "2019");
  assert.equal(owner2019.length, 2);
  assert.equal(owner2019[0].sha256, owner2019[1].sha256);
  assert.ok(candidate.official_blank_form_candidates.some((s) => s.document_self_identified_version === "2021"));
});

test("keeps incomplete binaries and external property figures fail closed", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.equal(candidate.pending_official_binary_candidates.length, 2);
  assert.ok(candidate.pending_official_binary_candidates.every((source) => source.sha256 === null && source.status.startsWith("PENDING_")));
  assert.equal(candidate.external_figure_source_candidates[0].publisher_domain, "novoco.com");
  assert.match(candidate.external_figure_source_candidates[0].status, /^THIRD_PARTY_/);
});

test("retains every observed Wyoming authority conflict", () => {
  assert.deepEqual(
    new Set(candidate.blocking_conflicts.map((conflict) => conflict.conflict_id)),
    new Set([
      "WY-2027-PLAN-VARIANTS-001",
      "WY-PROSPECTIVE-2027-001",
      "WY-OWNER-CERT-LINEAGE-001",
      "WY-MISLABELED-PLAN-LINK-001",
      "WY-THIRD-PARTY-LIMITS-001",
      "WY-PLAN-AMENDMENT-001",
    ]),
  );
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
});

test("requires VP Compliance property verification and preserves enterprise records", () => {
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.deepEqual(candidate.property_figure_verification_scope, [
    "income limits",
    "rent limits",
    "utility allowances",
    "set-asides",
    "effective dates",
    "property-specific program layering",
  ]);
  assert.match(candidate.enterprise_boundary, /Only blank official forms/);
  assert.match(candidate.enterprise_boundary, /Completed tenant certifications/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
