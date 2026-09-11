import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  "supabase/migrations/20260907030000_allow_admin_state_pack_single_operator_activation.sql",
  "utf8",
);
const route = await readFile(
  "src/routes/_authenticated/state-rule-validation.tsx",
  "utf8",
);

test("the exact founder email can activate a pack they first-reviewed", () => {
  assert.match(
    migration,
    /lower\(trim\(user_account\.email\)\) = 'rjwatkins@certivoiq\.com'/,
  );
  assert.match(
    migration,
    /v_is_first_reviewer and not v_is_authorized_founder/,
  );
  assert.match(
    migration,
    /v_is_authorized_founder[\s\S]*or not \(v_user_id = any\(snapshot\.first_reviewer_ids\)\)/,
  );
});

test("the exception does not bypass active-admin or source-readiness checks", () => {
  assert.match(migration, /access\.status = 'active'/);
  assert.match(migration, /access\.access_level = 'admin'/);
  assert.match(migration, /not coalesce\(v_snapshot\.sources_ready, false\)/);
  assert.match(migration, /First-review evidence is unavailable/);
  assert.match(migration, /source_snapshot_sha256/);
  assert.match(migration, /Activation notes must contain 10 to 4000 characters/);
});

test("legacy migration retained its original dual-control guard", () => {
  assert.match(
    migration,
    /A different Administrator must activate this state pack/,
  );
  assert.match(migration, /enforce_state_rule_pack_activation_actor/);
});

test("verified-source UI places activation directly under review notes", () => {
  assert.match(route, /The Sole Authorized State Rule Approver can activate the completed pack/);
  assert.match(
    route,
    /Review notes[\s\S]*Activate \$\{activation\.state_code\} state pack/,
  );
  assert.match(route, /disabled=\{!activation\.viewer_can_activate/);
  assert.doesNotMatch(
    route,
    /This source no longer requires validation[\s\S]{0,160}must be completed by a different Administrator/,
  );
});
