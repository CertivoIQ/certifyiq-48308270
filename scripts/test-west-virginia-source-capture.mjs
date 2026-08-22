import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(
  await readFile(new URL("../src/lib/west-virginia-state-pack-candidate.json", import.meta.url), "utf8"),
);

const allCaptured = [
  ...candidate.official_source_candidates,
  ...candidate.official_blank_form_candidates,
  ...candidate.inspection_and_monitoring_candidates,
  ...candidate.related_home_document_candidates,
].filter((source) => source.status.startsWith("EXACT_BYTES_CAPTURED"));

test("Test 81 records exact identities for the captured WVHDF binary inventory", () => {
  assert.equal(candidate.source_capture_test_id, 81);
  assert.equal(candidate.source_capture.exact_binary_count, 21);
  assert.equal(allCaptured.length, 21);
  for (const source of allCaptured) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.file_bytes) && source.file_bytes > 0);
    assert.ok(source.file_name);
    assert.equal(new URL(source.official_url).hostname, "www.wvhdf.com");
    assert.match(source.official_url, /\/wp-content\/uploads\/2026\//);
    assert.equal(new URL(source.landing_page_url).hostname, "www.wvhdf.com");
  }
});

test("captures the complete requested LIHTC manual, limit, form, lease, and monitoring set", () => {
  const titles = new Set(allCaptured.map((source) => source.title));
  for (const title of [
    "2025 and 2026 Allocation Plan",
    "2025 and 2026 Tax Credit Manual",
    "2025 and 2026 Program Calendar",
    "WVHDF Section 42 Tax Credit Compliance Manual",
    "West Virginia Income Limits Report",
    "LIHTC Income Asset Worksheet",
    "WV LIHTC Tenant Income Certification Form",
    "WVHDF Annual Self Certification of Tenant Income",
    "LIHTC Annual Income Recertification Waiver Certification",
    "Certification Waiver Procedures",
    "WV Annual Owner Certification",
    "Student Status Household Affidavit",
    "Household Eligibility Questionnaire",
    "Lease Addendum Utility Allowance",
    "Lease Addendum Tax Credit Eligibility and Maximum Rent",
    "Lease Addendum Income Limits",
    "Lease Addendum 140 Rule",
    "WV POST Year 15 Monitoring Changes 2016",
  ]) {
    assert.ok(titles.has(title), `missing exact capture: ${title}`);
  }
});

test("preserves original filenames for the previously identified WV source set", () => {
  const names = new Set(allCaptured.map((source) => source.file_name));
  for (const name of [
    "2025-and-2026-Tax-Credit-Manual-1.pdf",
    "2025-and-2026-Allocation-Plan-1.pdf",
    "WVHDF-Section-42-Tax-Credit-Compliance-Manual.pdf",
    "2025-and-2026-LIHTCP-Program-Calendar.pdf",
    "WV-LIHTC-Tenant-Income-Certification-Form.pdf",
    "LIHTC-IncomeAssetWorksheet.xls",
    "LIHTC-Annual-Income-Recertification-Waiver-Certification.pdf",
    "WVHDF-Annual-Self-Certification-of-Tenant-Income.pdf",
    "West-Virginia-Income-Limits-Report.pdf",
  ]) {
    assert.ok(names.has(name), `missing original filename: ${name}`);
  }
});

test("keeps unresolved WVHDF authority conflicts fail closed", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.equal(candidate.official_source_candidates.find((s) => s.source_type === "COMPLIANCE_FORMS_INDEX").status, "PENDING_RAW_HTML_CAPTURE");
  assert.equal(candidate.related_home_document_candidates.find((s) => s.title.startsWith("HOME Form 300")).status, "PENDING_EXACT_BYTES");
  assert.deepEqual(
    new Set(candidate.blocking_conflicts.map((conflict) => conflict.conflict_id)),
    new Set([
      "WV-CURRENCY-001",
      "WV-RECERT-WAIVER-001",
      "WV-OWNER-CERT-ISSUER-001",
      "WV-PLAN-CHANGE-001",
      "WV-HOME-CURRENCY-001",
      "WV-UNINDEXED-UPDATE-001",
    ]),
  );
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
});

test("requires VP Compliance to verify property figures before enterprise activation", () => {
  assert.equal(
    candidate.enterprise_activation_requires,
    "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION",
  );
  assert.deepEqual(candidate.property_figure_verification_scope, [
    "income limits",
    "rent limits",
    "utility allowances",
    "set-asides",
    "effective dates",
    "property-specific program layering",
  ]);
});

test("keeps completed property and tenant records outside the shared state pack", () => {
  assert.match(candidate.enterprise_boundary, /Only blank official forms/);
  assert.match(candidate.enterprise_boundary, /Completed tenant forms/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
