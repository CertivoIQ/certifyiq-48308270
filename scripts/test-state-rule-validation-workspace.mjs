import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260828352000_state_rule_validation_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);
const workspace = await readFile(
  new URL("../src/routes/_authenticated/state-rule-validation.tsx", import.meta.url),
  "utf8",
);
const shell = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const tasks = await readFile(new URL("../src/routes/_authenticated/tasks.tsx", import.meta.url), "utf8");

test("exposes a dedicated Manager/Admin validation workspace", () => {
  assert.match(workspace, /State Rule Validation/);
  assert.match(workspace, /useCrmStaffAuthority/);
  assert.match(workspace, /!canManageStaff/);
  assert.match(workspace, /state_rule_pack_candidates/);
  assert.match(workspace, /state_rule_source_candidates/);
  assert.match(workspace, /review_state_rule_source_candidate/);
  assert.match(shell, /to:\s*["']\/state-rule-validation["']/);
  assert.match(tasks, /destination:\s*["']\/state-rule-validation["']/);
});

test("requires exact-source evidence before verification", () => {
  assert.match(migration, /A lowercase 64-character SHA-256 is required/);
  assert.match(migration, /Retrieved time is required/);
  assert.match(migration, /Review notes must contain 10 to 4000 characters/);
  assert.match(migration, /state_rule_source_verification_events/);
  assert.match(migration, /reviewer_id uuid not null references auth\.users/);
  assert.match(migration, /prior_status text not null/);
  assert.match(migration, /effective_date/);
  assert.match(migration, /supersession_notes/);
});

test("keeps review fail closed and denies employee decisions", () => {
  assert.match(migration, /access_level in \('manager', 'admin'\)/);
  assert.match(migration, /compliance_activation_allowed = false/);
  assert.match(migration, /Never activates compliance rules/);
  assert.match(migration, /revoke all on function[\s\S]*from public/);
  assert.match(migration, /revoke all on function[\s\S]*from anon/);
  assert.match(migration, /grant execute on function[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /compliance_activation_allowed\s*=\s*true/);
});

