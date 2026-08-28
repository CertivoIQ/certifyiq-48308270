import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828050000_pha_family_reexamination_workflow.sql");
const workflow = read("src/components/pha-family-workflow.tsx");
const route = read("src/routes/_authenticated/pha-families.tsx");
const intake = read("src/components/pha-family-intake.tsx");
const intakeRoute = read("src/routes/_authenticated/pha-family-intake.tsx");
const appShell = read("src/components/app-shell.tsx");

test("family actions model admissions annuals interims verification EIV calculation and notices", () => {
  assert.match(migration, /pha_family_actions/);
  assert.match(migration, /annual_reexamination/);
  assert.match(migration, /interim_reexamination/);
  assert.match(migration, /pha_family_evidence/);
  assert.match(migration, /eiv_review_complete/);
  assert.match(migration, /calculation_complete/);
  assert.match(migration, /pha_family_notices/);
});

test("family workflow is tenant isolated", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.doesNotMatch(migration, /using \(true\)/);
});

test("completed family actions create exactly one HUD-50058 queue record", () => {
  assert.match(migration, /source_family_action_id/);
  assert.match(migration, /unique index/);
  assert.match(migration, /enqueue_pha_50058_from_family_action/);
  assert.match(migration, /insert into public\.pha_50058_transactions/);
  assert.match(migration, /on conflict \(source_family_action_id\)/);
  assert.match(migration, /workflow_status = 'routed'/);
});

test("family page exposes live workflow stages and controls", () => {
  assert.match(route, /PhaFamilyWorkflow/);
  assert.match(workflow, /Verification \/ EIV/);
  assert.match(workflow, /Calculation/);
  assert.match(workflow, /Notice/);
  assert.match(workflow, /HUD-50058 queued/);
});

test("PHA family intake creates only supported operational action types", () => {
  assert.match(intakeRoute, /PhaFamilyIntake/);
  assert.match(intake, /Create family action/);
  assert.match(intake, /annual_reexamination/);
  assert.match(intake, /interim_reexamination/);
  assert.match(intake, /portability/);
  assert.match(intake, /program_code: actionDraft\.program_code/);
  assert.match(intake, /workflow_status: "verification"/);
  assert.doesNotMatch(intake, /calculation_complete\s*:/);
  assert.doesNotMatch(intake, /notice_complete\s*:/);
});

test("PHA evidence intake captures verification and conflict state against the selected family action", () => {
  assert.match(intake, /Verification \/ EIV evidence/);
  assert.match(intake, /family_action_id: selected\.id/);
  assert.match(intake, /evidence_type: evidenceDraft\.evidence_type/);
  assert.match(intake, /verified: evidenceDraft\.verified/);
  assert.match(intake, /conflict_detected: evidenceDraft\.conflict_detected/);
  assert.match(intake, /Evidence conflicts/);
  assert.match(intake, /pha_family_evidence/);
});

test("PHA navigation exposes family intake separately from determination workflow", () => {
  assert.match(appShell, /\/pha-family-intake/);
  assert.match(appShell, /Family Intake & Evidence/);
  assert.match(appShell, /\/pha-families/);
  assert.match(appShell, /Families & Reexaminations/);
});
