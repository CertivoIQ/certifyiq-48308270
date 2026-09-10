import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260910173820_audit_simulator.sql", import.meta.url),
  "utf8",
);
const component = await readFile(
  new URL("../src/components/audit-simulator.tsx", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/audit-readiness.tsx", import.meta.url),
  "utf8",
);

test("supports only named review modes and conservative classifications", () => {
  for (const mode of [
    "lihtc_monitoring","hud_mor","home_monitoring",
    "hcv_pbv_review","investor_review","internal_qa_review",
  ]) assert.match(migration, new RegExp(mode));
  for (const outcome of [
    "Confirmed Deficiency","Potential Exposure","Missing Evidence","Unable to Determine",
  ]) assert.match(migration, new RegExp(outcome));
});

test("does not fabricate sampling or discretionary auditor behavior", () => {
  assert.match(migration, /All in-scope structured records; no discretionary or fabricated sampling/);
  assert.match(migration, /does not predict auditor discretion/);
  assert.match(migration, /No supported structured criteria were present/);
  assert.doesNotMatch(migration, /random\(|tablesample|machine learning|openai|anthropic/i);
});

test("preserves immutable tenant-scoped simulation reports", () => {
  assert.match(migration, /audit_simulation_reports_owner_read/);
  assert.match(migration, /auth\.uid\(\)\)=user_id/);
  assert.match(migration, /Audit simulation reports are immutable/);
  assert.match(migration, /report_sha256/);
  assert.match(migration, /revoke all on function public\.run_audit_simulation/);
});

test("renders modes, limitations, criteria, and evidence linkage", () => {
  assert.match(component, /LIHTC monitoring/);
  assert.match(component, /HUD MOR/);
  assert.match(component, /HCV\/PBV review/);
  assert.match(component, /Supported criteria/);
  assert.match(component, /source_table/);
  assert.match(component, /SHA-256/);
  assert.match(workspace, /<AuditSimulator \/>/);
});
