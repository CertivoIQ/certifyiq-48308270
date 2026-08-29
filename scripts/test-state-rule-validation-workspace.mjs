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
const creationMigration = await readFile(
  new URL(
    "../supabase/migrations/20260829070000_admin_add_state_source_records.sql",
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
  assert.match(workspace, /State & Federal Rule Validation/);
  assert.match(workspace, /useCrmStaffAuthority/);
  assert.match(workspace, /!canManageStaff/);
  assert.match(workspace, /state_rule_pack_candidates/);
  assert.match(workspace, /state_rule_source_candidates/);
  assert.match(workspace, /review_state_rule_source_candidate/);
  assert.match(shell, /Library, LogOut, FileSearch/);
  assert.match(shell, /to:\s*["']\/state-rule-validation["']/);
  assert.match(tasks, /destination:\s*active\s*\?\s*["']\/state-rule-validation["']/);
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


test("lets active administrators create audited exact-file source records", () => {
  assert.match(workspace, /Add source record/);
  assert.match(workspace, /Create validation record/);
  assert.match(workspace, /isCrmAdmin/);
  assert.match(workspace, /create_state_rule_source_candidate/);
  assert.match(creationMigration, /access_level = 'admin'/);
  assert.match(creationMigration, /state_rule_source_creation_events/);
  assert.match(creationMigration, /agent_verification_status[\s\S]*'queued_for_agent_verification'/);
  assert.match(creationMigration, /exact_bytes_captured[\s\S]*false/);
  assert.match(creationMigration, /compliance_activation_allowed[\s\S]*false/);
  assert.match(creationMigration, /Official source URL must match the official domain/);
  assert.match(creationMigration, /revoke all on function[\s\S]*from public/);
  assert.match(creationMigration, /revoke all on function[\s\S]*from anon/);
  assert.doesNotMatch(creationMigration, /compliance_activation_allowed\s*=\s*true/);
});


test("surfaces actionable creation errors and derives the official domain", () => {
  assert.match(workspace, /messageForError/);
  assert.match(workspace, /officialDomainFor/);
  assert.match(workspace, /Automatically derived from the exact official file URL/);
  assert.match(workspace, /toast\.error\(messageForError\(error, "Source record could not be created"\)\)/);
});


test("deep-links each state task into its filtered validation queue", () => {
  assert.match(workspace, /validateSearch/);
  assert.match(workspace, /routeSearch\.state \?\? "ALL"/);
  assert.match(tasks, /validationStateCode:\s*active \? candidate\.state_code : undefined/);
  assert.match(tasks, /search=\{\{ state: task\.validationStateCode, status: "active" \}\}/);
});


test("shows the shared federal baseline inside every selected state queue", () => {
  assert.match(workspace, /source\.state_code === "US" \|\| source\.scope === "FEDERAL_SHARED"/);
  assert.match(workspace, /inheritedFederal/);
  assert.match(workspace, /inherited by/);
  assert.match(workspace, /!inheritedFederal && status === "active"/);
});
