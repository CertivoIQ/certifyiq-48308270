import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RELEASE_CRITICAL_STATE_DOCUMENT_FAMILIES,
  REQUIRED_STATE_DOCUMENT_FAMILIES,
  classifyDocument,
  coverageGaps,
  extractOfficialLinks,
  releaseCoverageGaps,
  selectCurrentDocuments,
} from "../src/lib/state-validation-document-families.mjs";

const targetedCrawler = readFileSync(new URL("./crawl-tn-tx-release-critical-documents.mjs", import.meta.url), "utf8");
const tnTxMigration = readFileSync(
  new URL("../supabase/migrations/20260902033500_gate4_tn_tx_release_critical_sources.sql", import.meta.url),
  "utf8",
);

test("classifies the required Florida validation document families", () => {
  assert.deepEqual(
    classifyDocument({ label: "2026 Income Limits", url: "https://www.floridahousing.org/limits.pdf" }).families,
    ["INCOME_LIMITS"],
  );
  assert.deepEqual(
    classifyDocument({ label: "2026 Rent Limits", url: "https://www.floridahousing.org/rents.pdf" }).families,
    ["RENT_LIMITS"],
  );
  assert.ok(
    classifyDocument({ label: "Utility Allowance Energy Consumption Model Procedures and Forms", url: "https://www.floridahousing.org/ua.pdf" })
      .families.includes("UTILITY_ALLOWANCE"),
  );
  assert.ok(
    classifyDocument({ label: "Florida Housing Compliance Training Workshop v26.2", url: "https://www.floridahousing.org/training.pdf" })
      .families.includes("COMPLIANCE_TRAINING"),
  );
});

test("classifies West Virginia release-critical compliance resources", () => {
  assert.ok(
    classifyDocument({ label: "WVHDF Section 42 Tax Credit Compliance Manual", url: "https://www.wvhdf.com/manual.pdf" })
      .families.includes("COMPLIANCE_GUIDEBOOK"),
  );
  assert.ok(
    classifyDocument({ label: "2026 Income Limits Report", url: "https://www.wvhdf.com/income.pdf" })
      .families.includes("INCOME_LIMITS"),
  );
  assert.ok(
    classifyDocument({ label: "Tax Credit Eligibility and Maximum Rent", url: "https://www.wvhdf.com/rent.pdf" })
      .families.includes("RENT_LIMITS"),
  );
  assert.ok(
    classifyDocument({ label: "Lease Addendum Utility Allowance", url: "https://www.wvhdf.com/utility.pdf" })
      .families.includes("UTILITY_ALLOWANCE"),
  );
  assert.ok(
    classifyDocument({ label: "Household Eligibility Questionnaire", url: "https://www.wvhdf.com/forms.pdf" })
      .families.includes("COMPLIANCE_FORMS"),
  );
});

test("classifies direct versioned source identifiers with underscores and combined limits", () => {
  assert.ok(
    classifyDocument({ label: "", url: "https://agency.gov/file.pdf", sourceType: "HOME_2026_INCOME_LIMITS" })
      .families.includes("INCOME_LIMITS"),
  );
  const combined = classifyDocument({
    label: "",
    url: "https://agency.gov/file.pdf",
    sourceType: "NHTF_2026_INCOME_AND_RENT_LIMITS",
  }).families;
  assert.ok(combined.includes("INCOME_LIMITS"));
  assert.ok(combined.includes("RENT_LIMITS"));
});

test("extracts only HTTPS links remaining on the official authority domain", () => {
  const html = `
    <a href="/docs/compliance-manual.pdf">Compliance Manual</a>
    <a href="https://files.floridahousing.org/limits.pdf">2026 Income Limits</a>
    <a href="https://attacker.test/fake.pdf">Utility Allowance</a>
    <a href="http://www.floridahousing.org/insecure.pdf">Rent Limits</a>
  `;
  const links = extractOfficialLinks(
    html,
    "https://www.floridahousing.org/compliance",
    "floridahousing.org",
  );
  assert.equal(links.length, 2);
  assert.ok(links.every((link) => new URL(link.url).protocol === "https:"));
});

test("keeps the newest versioned schedules and preserves unversioned current manuals", () => {
  const documents = [
    { url: "https://agency.gov/income-2025.pdf", families: ["INCOME_LIMITS"], declared_year: 2025, score: 2 },
    { url: "https://agency.gov/income-2026.pdf", families: ["INCOME_LIMITS"], declared_year: 2026, score: 2 },
    { url: "https://agency.gov/manual.pdf", families: ["COMPLIANCE_GUIDEBOOK"], declared_year: null, score: 2 },
  ];
  const selected = selectCurrentDocuments(documents, { currentYear: 2026 });
  assert.deepEqual(selected.map((item) => item.url).sort(), [
    "https://agency.gov/income-2026.pdf",
    "https://agency.gov/manual.pdf",
  ]);
});

test("reports every unpublished or undiscovered intake family as a fail-closed gap", () => {
  const gaps = coverageGaps("FL", [
    { families: ["COMPLIANCE_GUIDEBOOK", "COMPLIANCE_TRAINING"] },
  ]);
  assert.equal(gaps.length, REQUIRED_STATE_DOCUMENT_FAMILIES.length - 2);
  assert.ok(gaps.every((gap) => gap.compliance_activation_allowed === false));
});

test("release coverage requires compliance evidence but not training publication", () => {
  const releaseComplete = [
    {
      families: [
        "COMPLIANCE_GUIDEBOOK",
        "INCOME_LIMITS",
        "RENT_LIMITS",
        "UTILITY_ALLOWANCE",
        "COMPLIANCE_FORMS",
      ],
    },
  ];
  assert.deepEqual(releaseCoverageGaps("WV", releaseComplete), []);
  assert.equal(RELEASE_CRITICAL_STATE_DOCUMENT_FAMILIES.length, 5);

  const incomplete = releaseCoverageGaps("WV", [
    { families: ["COMPLIANCE_GUIDEBOOK", "COMPLIANCE_FORMS"] },
  ]);
  assert.deepEqual(
    incomplete.map((gap) => gap.document_family),
    ["INCOME_LIMITS", "RENT_LIMITS", "UTILITY_ALLOWANCE"],
  );
  assert.ok(incomplete.every((gap) => gap.compliance_activation_allowed === false));
});

test("TN/TX targeted capture is allowlisted, exact-byte hashed, and cannot self-activate", () => {
  for (const phrase of [
    "Tennessee Housing Development Agency",
    "Texas Department of Housing and Community Affairs",
    "thda.org",
    "tdhca.texas.gov",
    "dogvxws799i6n.cloudfront.net",
    "createHash(\"sha256\")",
    "captured_unvalidated",
    "independent_validation_required: true",
    "compliance_activation_allowed: false",
  ]) {
    assert.match(targetedCrawler, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(targetedCrawler, /unapproved_source_host/);
  assert.match(targetedCrawler, /redirected_to_unapproved_host/);
  assert.doesNotMatch(targetedCrawler, /compliance_activation_allowed:\s*true/);
});

test("TN/TX capture migration preserves independent validation and zero release-critical gaps", () => {
  assert.match(tnTxMigration, /CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION/);
  assert.match(tnTxMigration, /'captured_unvalidated'/);
  assert.match(tnTxMigration, /'independent_validation_required',true/);
  assert.match(tnTxMigration, /'independent_validation_completed',false/);
  assert.match(tnTxMigration, /'compliance_activation_allowed',false/);
  assert.match(tnTxMigration, /release_critical_document_families_captured',true/);
  assert.match(tnTxMigration, /COMPLIANCE_GUIDEBOOK/);
  assert.match(tnTxMigration, /INCOME_LIMITS/);
  assert.match(tnTxMigration, /RENT_LIMITS/);
  assert.match(tnTxMigration, /UTILITY_ALLOWANCE/);
  assert.match(tnTxMigration, /COMPLIANCE_FORMS/);
  assert.doesNotMatch(tnTxMigration, /agent_verification_status\s*=\s*'verified'/i);
  assert.doesNotMatch(tnTxMigration, /compliance_activation_allowed\s*=\s*true/i);
});
