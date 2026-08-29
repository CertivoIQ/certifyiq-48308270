import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260829123000_activate_validated_state_rule_packs.sql", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/state-rule-validation.tsx", import.meta.url),
  "utf8",
);

test("activates a complete state pack and records only its validation date", () => {
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /compliance_activation_allowed = v_active/);
  assert.match(migration, /validated_on date/);
  assert.match(migration, /coalesce\(pack\.validated_on, current_date\)/);
  assert.match(migration, /agent_verification_required = not v_active/);
  assert.match(migration, /state_rule_pack_candidates_activation_state_check/);
});

test("keeps incomplete packs closed and includes the federal baseline", () => {
  assert.match(migration, /v_active := v_own_ready and v_federal_ready/);
  assert.match(migration, /agent_verification_status in \('blocked', 'rejected'\)/);
  assert.match(migration, /where source\.state_code = 'US'/);
  assert.match(migration, /source\.source_sha256 is not null/);
  assert.match(migration, /source\.retrieved_at is not null/);
});

test("keeps emails out of operational validation evidence", () => {
  assert.match(migration, /- 'reviewer_email'/);
  assert.match(migration, /- 'approver_email'/);
  assert.match(migration, /'reviewer_id', v_user_id/);
  assert.match(migration, /'validated_on'.*current_date/s);
  assert.doesNotMatch(workspace, /reviewer_email|approver_email|email signature/i);
});

test("tells operators that completed packs activate automatically", () => {
  assert.match(workspace, /Complete packs activate automatically/);
  assert.match(workspace, /Validation date:/);
  assert.match(workspace, /Pack activated automatically/);
});
