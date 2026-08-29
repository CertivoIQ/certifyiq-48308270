import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260829050000_record_pilot_state_source_captures.sql", import.meta.url),
  "utf8",
);

test("pilot recording includes ten exact SHA-256 capture facts", () => {
  const hashes = migration.match(/'[0-9a-f]{64}'/g) ?? [];
  assert.equal(hashes.length, 11, "ten source hashes plus one artifact hash are required");
  assert.match(migration, /updated_sources <> 10/);
});

test("automated capture cannot impersonate independent review", () => {
  assert.match(migration, /agent_verification_status = 'captured_unvalidated'/);
  assert.match(migration, /'independent_validation_required', true/);
  assert.match(migration, /'human_verified', false/);
  assert.doesNotMatch(migration, /state_rule_source_verification_events/);
});

test("pilot packs remain fail closed", () => {
  assert.equal((migration.match(/compliance_activation_allowed = false/g) ?? []).length, 2);
  assert.match(migration, /status = 'agent_verification_in_progress'/);
  assert.doesNotMatch(migration, /status\s*=\s*'verified'/);
});
