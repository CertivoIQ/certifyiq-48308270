import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260830020000_dual_control_state_rule_pack_activation.sql";
const founderMigrationPath =
  "supabase/migrations/20260903202500_founder_state_rule_single_operator_activation.sql";
const stateRoutePath = "src/routes/_authenticated/state-rule-validation.tsx";
const tasksRoutePath = "src/routes/_authenticated/tasks.tsx";

const [migration, founderMigration, stateRoute, tasksRoute] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(founderMigrationPath, "utf8"),
  readFile(stateRoutePath, "utf8"),
  readFile(tasksRoutePath, "utf8"),
]);

test("first verification remains required before state pack activation", () => {
  assert.match(migration, /awaiting_second_verification/);
  assert.match(
    migration,
    /v_active := coalesce\(v_snapshot\.sources_ready, false\) and v_activation\.id is not null/,
  );
  assert.match(migration, /compliance_activation_allowed = v_active/);
  assert.match(founderMigration, /Every required state and shared federal source must complete first verification/);
  assert.match(founderMigration, /First-review evidence is unavailable/);
});

test("ordinary Administrators still require a different activator", () => {
  assert.match(founderMigration, /access_level = 'admin'/);
  assert.match(founderMigration, /v_is_first_reviewer and not v_is_founder/);
  assert.match(founderMigration, /A different Administrator must activate this state pack/);
  assert.match(founderMigration, /enforce_state_rule_pack_activation_actor/);
});

test("only the exact founder account receives the second-verifier bypass", () => {
  assert.match(founderMigration, /rjwatkins@certivoiq\.com/);
  assert.match(founderMigration, /SECOND_VERIFIER_BYPASS_ONLY/);
  assert.match(founderMigration, /founder_single_operator_activation/);
  assert.match(founderMigration, /founder_override_scope/);
  assert.match(founderMigration, /second_verifier_only/);
  assert.doesNotMatch(founderMigration, /@certivoiq\.com%|like\s+['"]%@/i);
});

test("founder exception does not bypass source readiness or downstream release gating", () => {
  assert.match(founderMigration, /snapshot\.sources_ready/);
  assert.match(founderMigration, /refresh_state_rule_pack_activation/);
  assert.match(founderMigration, /verified_source_count/);
  assert.doesNotMatch(founderMigration, /sources_ready\s*:=\s*true/i);
});

test("activation covers state sources and the shared federal baseline", () => {
  assert.match(migration, /source\.state_code = 'US'/);
  assert.match(migration, /pack\.state_code <> 'US'/);
  assert.match(founderMigration, /shared federal source/);
});

test("activation evidence remains immutable and snapshot-bound", () => {
  assert.match(migration, /source_snapshot_sha256/);
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /events are immutable/);
  assert.match(migration, /before update or delete/);
  assert.match(founderMigration, /source_snapshot_sha256/);
});

test("verified sources no longer show Verify source", () => {
  assert.match(
    stateRoute,
    /source\.agent_verification_status === "verified"[\s\S]*First verification complete/,
  );
  assert.match(stateRoute, /Activate state pack/);
  assert.match(stateRoute, /viewer_can_activate/);
});

test("Tasks distinguishes source verification from pack activation", () => {
  assert.match(tasksRoute, /\.neq\("state_code", "US"\)/);
  assert.match(tasksRoute, /\.neq\("candidate_status", "EXCLUDED_REDUNDANT_SOURCE"\)/);
  assert.match(tasksRoute, /awaitingActivation/);
  assert.match(tasksRoute, /Activate state pack/);
  assert.match(tasksRoute, /independent Administrator activation required/);
});
