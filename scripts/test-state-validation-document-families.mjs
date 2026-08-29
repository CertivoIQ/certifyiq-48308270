import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_STATE_DOCUMENT_FAMILIES,
  classifyDocument,
  coverageGaps,
  extractOfficialLinks,
  selectCurrentDocuments,
} from "../src/lib/state-validation-document-families.mjs";

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

test("reports every unpublished or undiscovered family as a fail-closed gap", () => {
  const gaps = coverageGaps("FL", [
    { families: ["COMPLIANCE_GUIDEBOOK", "COMPLIANCE_TRAINING"] },
  ]);
  assert.equal(gaps.length, REQUIRED_STATE_DOCUMENT_FAMILIES.length - 2);
  assert.ok(gaps.every((gap) => gap.compliance_activation_allowed === false));
});
