import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260829130000_exclude_redundant_state_sources.sql", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/state-rule-validation.tsx", import.meta.url),
  "utf8",
);

test("keeps redundant rejections in history without blocking validated packs", () => {
  assert.match(migration, /EXCLUDED_REDUNDANT_SOURCE/);
  assert.match(migration, /agent_verification_status = 'rejected'/);
  assert.match(migration, /already recorded and validated/);
  assert.match(migration, /refresh_state_rule_pack_activation/);
  assert.match(workspace, /excludedRedundant/);
  assert.match(workspace, /Excluded redundant source/);
});
