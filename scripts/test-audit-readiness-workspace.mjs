import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(
  new URL("../src/routes/_authenticated/audit-readiness.tsx", import.meta.url),
  "utf8",
);
const shell = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20260829225804_audit_final_review_confirmations.sql", import.meta.url),
  "utf8",
);

test("installs a dedicated affordable-housing audit readiness workspace", () => {
  assert.match(workspace, /Affordable Housing Audit Readiness/);
  assert.match(workspace, /Audit Readiness/);
  assert.match(shell, /to:\s*["']\/audit-readiness["']/);
  assert.match(shell, /label:\s*["']Audit Readiness["']/);
});

test("uses the existing controlled audit evidence and remediation records", () => {
  assert.match(workspace, /mock_audit_runs/);
  assert.match(workspace, /evidence_manifests/);
  assert.match(workspace, /compliance_findings/);
  assert.match(workspace, /compliance_assurance_cases/);
  assert.match(workspace, /compliance_remediation_actions/);
  assert.match(workspace, /certification_import_items/);
});

test("provides program-aware preparation and package exports", () => {
  assert.match(workspace, /PROGRAM_REQUIREMENTS/);
  assert.match(workspace, /LIHTC/);
  assert.match(workspace, /HOME/);
  assert.match(workspace, /USDA Rural Development/);
  assert.match(workspace, /HUD \/ HOTMA/);
  assert.match(workspace, /Export package/);
  assert.match(workspace, /Print summary/);
  assert.match(workspace, /CERTIVOIQ_AFFORDABLE_HOUSING_AUDIT_PREPARATION/);
});

test("keeps audit preparation fail closed and uses final-review language", () => {
  assert.match(workspace, /Ready for final package review/);
  assert.match(workspace, /FINAL REVIEW READY/);
  assert.match(workspace, /Final compliance review remains required/);
  assert.match(workspace, /does not predict or guarantee an agency audit outcome/);
  assert.match(workspace, /criticalFindings\.length === 0/);
  assert.match(workspace, /openActions\.length === 0/);
  assert.doesNotMatch(workspace, /human|artificial intelligence|\\bAI\\b/i);
});
