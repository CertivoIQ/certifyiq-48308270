import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260830020000_dual_control_state_rule_pack_activation.sql";
const stateRoutePath = "src/routes/_authenticated/state-rule-validation.tsx";
const tasksRoutePath = "src/routes/_authenticated/tasks.tsx";

const [migration, stateRoute, tasksRoute] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(stateRoutePath, "utf8"),
  readFile(tasksRoutePath, "utf8"),
]);

test("first verification cannot activate a state pack", () => {
  assert.match(migration, /awaiting_second_verification/);
  assert.match(
    migration,
    /v_active := coalesce\(v_snapshot\.sources_ready, false\) and v_activation\.id is not null/,
  );
  assert.match(migration, /compliance_activation_allowed = v_active/);
});

test("activation requires a distinct active Administrator", () => {
  assert.match(migration, /access\.access_level = 'admin'/);
  assert.match(migration, /if v_user_id = any\(v_snapshot\.first_reviewer_ids\)/);
  assert.match(migration, /A different Administrator must activate this state pack/);
  assert.match(migration, /state_rule_pack_activation_events_distinct_activator/);
});

test("activation covers state sources and the shared federal baseline", () => {
  assert.match(migration, /source\.state_code = 'US'/);
  assert.match(migration, /pack\.state_code <> 'US'/);
  assert.match(migration, /Every required state and shared federal source/);
});

test("activation evidence is immutable and snapshot-bound", () => {
  assert.match(migration, /source_snapshot_sha256/);
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /events are immutable/);
  assert.match(migration, /before update or delete/);
  assert.match(migration, /revoke all on table .* from public, anon/s);
});

test("verified sources no longer show Verify source", () => {
  assert.match(
    stateRoute,
    /source\.agent_verification_status === "verified"[\s\S]*First verification complete/,
  );
  assert.match(stateRoute, /Activate state pack/);
  assert.match(stateRoute, /viewer_can_activate/);
  assert.match(stateRoute, /Different Administrator required/);
});

test("Tasks distinguishes source verification from pack activation", () => {
  assert.match(tasksRoute, /\.neq\("state_code", "US"\)/);
  assert.match(tasksRoute, /awaitingActivation/);
  assert.match(tasksRoute, /Activate state pack/);
  assert.match(tasksRoute, /independent Administrator activation required/);
});
