import assert from "node:assert/strict";
import test from "node:test";
import {
  createCapturedSourceRecord,
  extractDeclaredEffectiveDate,
  isOfficialSourceUrl,
} from "../src/lib/nationwide-state-source-evidence-pipeline.mjs";

const jurisdiction = Object.freeze({
  state_code: "WA",
  scope: "STATEWIDE",
  agency: "Washington State Housing Finance Commission",
  official_domain: "wshfc.org",
});
const source = Object.freeze({
  type: "COMPLIANCE_MANUAL",
  status: "PENDING_EXACT_BYTES_AND_HASHES",
  url: "https://www.wshfc.org/managers/manual.pdf",
});

test("official-host validation permits only HTTPS hosts owned by the listed authority", () => {
  assert.equal(isOfficialSourceUrl(source.url, jurisdiction.official_domain), true);
  assert.equal(isOfficialSourceUrl("https://cdn.wshfc.org/file.pdf", jurisdiction.official_domain), true);
  assert.equal(isOfficialSourceUrl("https://wshfc.org.attacker.test/file.pdf", jurisdiction.official_domain), false);
  assert.equal(isOfficialSourceUrl("http://www.wshfc.org/file.pdf", jurisdiction.official_domain), false);
});

test("effective date extraction preserves the declaration but does not treat it as a release approval", () => {
  const declaration = extractDeclaredEffectiveDate("This manual is effective January 1, 2026.");
  assert.equal(declaration.effective_date, "2026-01-01");
  assert.equal(declaration.effective_date_status, "DECLARED_DATE_EXTRACTED_PENDING_SUPERSESSION_RECONCILIATION");
});

test("exact source bytes receive a stable hash and remain unavailable for activation", () => {
  const record = createCapturedSourceRecord({
    jurisdiction,
    source,
    finalUrl: source.url,
    httpStatus: 200,
    contentType: "application/pdf",
    body: Buffer.from("%PDF-1.7 This manual is effective January 1, 2026."),
    retrievedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(record.source_evidence_status, "CAPTURED_UNVALIDATED");
  assert.equal(record.source_sha256.length, 64);
  assert.equal(record.effective_date, "2026-01-01");
  assert.equal(record.compliance_activation_allowed, false);
});

test("a redirect to a non-official host is blocked before any source can be trusted", () => {
  const record = createCapturedSourceRecord({
    jurisdiction,
    source,
    finalUrl: "https://files.example.test/manual.pdf",
    httpStatus: 200,
    body: Buffer.from("not used"),
    retrievedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(record.source_evidence_status, "CAPTURE_BLOCKED");
  assert.equal(record.reason_code, "FINAL_URL_NOT_OFFICIAL_ALLOWLISTED");
  assert.equal(record.compliance_activation_allowed, false);
});
