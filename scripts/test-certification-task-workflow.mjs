import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260830022000_certification_role_task_workflow.sql",
  "utf8",
);
const shell = readFileSync("src/components/app-shell.tsx", "utf8");
const tasks = readFileSync("src/routes/_authenticated/tasks.tsx", "utf8");
const actions = readFileSync("src/components/certification-task-actions.tsx", "utf8");

test("Tasks is available in every customer workspace menu", () => {
  assert.match(shell, /MULTIFAMILY_NAV[\s\S]*?to: "\/tasks"/);
  assert.match(shell, /PHA_NAV[\s\S]*?to: "\/tasks"[\s\S]*?key: "tasks"/);
  assert.match(shell, /key === "tasks"/);
  assert.doesNotMatch(tasks, /Staff authority required/);
  assert.match(tasks, /enabled: !loading/);
});

test("certification findings route to assignees and rerun after final resolution", () => {
  assert.match(migration, /certification_finding_assignments/);
  assert.match(migration, /private\.certification_pick_employee/);
  assert.match(migration, /'finding_assigned'/);
  assert.match(migration, /'certification_rerun_requested'/);
  assert.match(migration, /'certification_rerun_completed'/);
  assert.equal((migration.match(/extensions\\.digest\\(/g) ?? []).length, 2);
  assert.match(migration, /all_assigned_findings_resolved/);
  assert.match(actions, /resolve_certification_finding/);
});

test("manager-only final approval files immutable audit evidence", () => {
  assert.match(migration, /private\.certification_is_manager\(_actor, _case\.workspace_user_id\)/);
  assert.match(migration, /raise exception 'manager authority required'/);
  assert.match(migration, /all findings must be resolved before final approval/);
  assert.match(migration, /insert into public\.evidence_manifests/);
  assert.match(migration, /insert into public\.certification_audit_files/);
  assert.match(migration, /certification_audit_files_immutable/);
  assert.match(migration, /revoke all on public\.certification_audit_files from anon, authenticated/);
  assert.match(actions, /approve_certification_final/);
});

test("task RPC returns employee finding work and manager approval history", () => {
  assert.match(migration, /create or replace function public\.certification_task_queue/);
  assert.match(migration, /a\.assigned_to = actor\.id/);
  assert.match(migration, /private\.certification_is_manager\(actor\.id,c\.workspace_user_id\)/);
  assert.match(migration, /c\.status in \('awaiting_manager_approval','approved_filed'\)/);
  assert.match(tasks, /certification_task_queue/);
  assert.match(tasks, /CertificationTaskActions/);
});
