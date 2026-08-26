import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL("../supabase/migrations/20260826035500_external_state_pack_attestation.sql", import.meta.url),
  "utf8",
);

test("external approval path is explicit and never invents an internal approver", () => {
  assert.match(sql, /external_approval_attested boolean not null default false/);
  assert.match(sql, /external_approval_basis text/);
  assert.match(sql, /elsif new\.external_approval_attested is true/);
  assert.match(sql, /explicit external approval attestation/);
});

test("validated releases still require exact CI evidence or a validation report", () => {
  assert.match(sql, /validated_commit_sha !~ '\^\[0-9a-f\]\{40\}\$'/);
  assert.match(sql, /validation_workflow_run_id is null/);
  assert.match(sql, /validation report or exact commit and workflow-run evidence/);
});

test("validated releases still require at least one deterministic rule", () => {
  assert.match(sql, /validated_rule_count < 1/);
});
