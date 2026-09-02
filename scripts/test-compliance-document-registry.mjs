import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  recognizeComplianceForm,
  registryRecognitionDisposition,
} from "../src/lib/compliance-form-recognition.mjs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260902033000_compliance_document_registry.sql");
const route = read("src/routes/_authenticated/document-intelligence.tsx");
const server = read("src/lib/compliance-document-recognition.functions.ts");
const shell = read("src/components/app-shell.tsx");

test("registry stores version, effective period, source identity, fields, signatures, and support state", () => {
  for (const table of [
    "compliance_form_registry",
    "compliance_form_registry_events",
    "certification_document_instances",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  for (const field of [
    "revision_label",
    "effective_from",
    "effective_to",
    "source_url",
    "source_sha256",
    "required_fields",
    "required_signatures",
    "support_status",
    "validation_support",
  ]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /source_validation_required/);
  assert.match(migration, /validated_supported/);
  assert.match(migration, /superseded/);
});

test("future-state form families are seeded fail-closed", () => {
  for (const code of ["HUD-50059", "HUD-50059-A", "HUD-9887", "HUD-9887-A", "HUD-9834", "HUD-50058"]) {
    assert.match(migration, new RegExp(code.replaceAll("-", "[-]")));
  }
  assert.match(migration, /HUD-MODEL-LEASE/);
  assert.match(migration, /OWNER-POLICY/);
  assert.match(migration, /decision_use.*false/is);
  assert.doesNotMatch(migration, /'validated_supported'.*HUD-50059/is);
});

test("registry is readable but customer sessions cannot mutate controlled definitions", () => {
  assert.match(migration, /grant\s+select\s+on\s+table\s+public\.compliance_form_registry\s+to\s+authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)\s+on\s+table\s+public\.compliance_form_registry\s+to\s+authenticated/i,
  );
  assert.match(migration, /grant\s+all\s+on\s+table\s+public\.compliance_form_registry\s+to\s+service_role/i);
  assert.match(migration, /Users read own recognized certification documents/i);
  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/i);
});

test("deterministic recognition distinguishes exact HUD form identifiers", () => {
  assert.deepEqual(
    recognizeComplianceForm({ fileName: "resident-HUD-50059-A.pdf", text: "HUD-50059-A certification" }).formCode,
    "HUD-50059-A",
  );
  assert.equal(recognizeComplianceForm({ text: "Form HUD 9887-A" }).formCode, "HUD-9887-A");
  assert.equal(recognizeComplianceForm({ text: "HUD-9834 Management Review" }).formCode, "HUD-9834");
  assert.equal(recognizeComplianceForm({ text: "HUD-50058 Family Report" }).formCode, "HUD-50058");
  assert.equal(recognizeComplianceForm({ text: "ordinary paystub" }).status, "unrecognized");
  assert.equal(
    recognizeComplianceForm({ text: "HUD-50059 and HUD-9834" }).status,
    "ambiguous",
  );
});

test("registry support state controls recognition disposition", () => {
  assert.equal(registryRecognitionDisposition(null), "unsupported");
  assert.equal(registryRecognitionDisposition({ support_status: "superseded" }), "outdated");
  assert.equal(registryRecognitionDisposition({ support_status: "unsupported" }), "unsupported");
  assert.equal(registryRecognitionDisposition({ support_status: "source_validation_required" }), "recognized");
});

test("certification files can be checked without granting decision authority", () => {
  assert.match(server, /certification_import_items/);
  assert.match(server, /certification-imports/);
  assert.match(server, /recognizeComplianceForm/);
  assert.match(server, /compliance_form_registry/);
  assert.match(server, /certification_document_instances/);
  assert.match(server, /pending_analyst_verification/);
  assert.match(server, /validated_supported/);
});

test("document intelligence workspace exposes registry and recent file recognition", () => {
  assert.match(route, /Document Intelligence/);
  assert.match(route, /Versioned forms, effective periods, required evidence, signatures, and recognition controls/i);
  assert.match(route, /Source validation required/);
  assert.match(route, /Validated supported/);
  assert.match(route, /Check form identity/);
  assert.match(route, /pending analyst verification/i);
  // Guard customer-visible positioning language without treating incidental source-code
  // tokens as product copy.
  assert.doesNotMatch(route, /AI[-\s]+(?:powered|assisted|review|verification)/i);
  assert.doesNotMatch(route, /artificial intelligence|human[-\s]+(?:review|approval|verification|sign[- ]?off)/i);
  assert.match(shell, /to: "\/document-intelligence", label: "Document Intelligence"/);
});
