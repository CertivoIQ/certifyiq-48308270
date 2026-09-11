import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  "supabase/migrations/20260911170000_authorize_sole_state_rule_approver.sql",
  "utf8",
);
const route = await readFile("src/routes/_authenticated/state-rule-validation.tsx", "utf8");

test("only the verified active founder administrator may activate state packs", () => {
  assert.match(migration, /lower\(trim\(user_account\.email\)\) = 'rjwatkins@certivoiq\.com'/);
  assert.match(migration, /user_account\.email_confirmed_at is not null/);
  assert.match(migration, /access\.status = 'active'/);
  assert.match(migration, /access\.access_level = 'admin'/);
  assert.match(migration, /Sole Authorized State Rule Approver authority required/);
});

test("single-human activation preserves automated gates and honest audit language", () => {
  assert.match(migration, /snapshot\.sources_ready/);
  assert.match(migration, /source_snapshot_sha256/);
  assert.match(migration, /single_human_approval_with_automated_validation/);
  assert.match(migration, /automated_source_gates_required', true/);
  assert.match(migration, /independent_verification_claimed', false/);
});

test("operator UI no longer describes state-pack activation as independent or second validation", () => {
  assert.match(route, /Authorized Agent activation recorded/);
  assert.match(route, /Agent activation/);
  assert.match(route, /Awaiting your approval/);
  assert.doesNotMatch(
    route,
    /Independent activation recorded|Second validation|independent activation|second-verification|Two independent validation stages/,
  );
});
