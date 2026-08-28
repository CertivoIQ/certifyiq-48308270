import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828050000_pha_family_reexamination_workflow.sql");
const noticeMigration = read("supabase/migrations/20260828080000_pha_notice_issuance.sql");
const verificationMigration = read("supabase/migrations/20260828090000_pha_derived_verification_eiv.sql");
const workflow = read("src/components/pha-family-workflow.tsx");
const route = read("src/routes/_authenticated/pha-families.tsx");
const intake = read("src/components/pha-family-intake.tsx");
const intakeRoute = read("src/routes/_authenticated/pha-family-intake.tsx");
const noticeCenter = read("src/components/pha-notice-center.tsx");
const noticeRoute = read("src/routes/_authenticated/pha-notices.tsx");
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

test("verification and EIV completion are derived from a controlled requirement matrix", () => {
  assert.match(verificationMigration, /pha_verification_requirement_matrix/);
  assert.match(verificationMigration, /general_verification/);
  assert.match(verificationMigration, /eiv_review/);
  assert.match(verificationMigration, /verified_non_eiv_evidence/);
  assert.match(verificationMigration, /verified_eiv_or_controlled_exception/);
  assert.match(verificationMigration, /new\.verification_complete :=/);
  assert.match(verificationMigration, /new\.eiv_review_complete :=/);
  assert.match(verificationMigration, /Fail closed when the controlled matrix is absent or inactive/);
});

test("EIV exception requires controlled source readiness and cannot itself bypass evidence conflicts", () => {
  assert.match(verificationMigration, /pha_family_eiv_exceptions/);
  assert.match(verificationMigration, /controlled_source_release_approved/);
  assert.match(verificationMigration, /current_rule_version_validated/);
  assert.match(verificationMigration, /not action_row\.source_status_conflict/);
  assert.match(verificationMigration, /and not has_conflict/);
  assert.doesNotMatch(verificationMigration, /using \(true\)/);
});

test("evidence and EIV exception changes automatically recompute compatibility completion fields", () => {
  assert.match(verificationMigration, /refresh_pha_family_verification_state/);
  assert.match(verificationMigration, /after insert or update or delete on public\.pha_family_evidence/);
  assert.match(verificationMigration, /after insert or update or delete on public\.pha_family_eiv_exceptions/);
  assert.match(verificationMigration, /pha_family_action_derived_verification_before_write/);
});

test("notice issuance requires validated calculation and current controlled sources", () => {
  assert.match(noticeMigration, /prepare_pha_family_notice/);
  assert.match(noticeMigration, /calculation_status <> 'validated'/);
  assert.match(noticeMigration, /controlled_source_release_approved/);
  assert.match(noticeMigration, /current_rule_version_validated/);
  assert.match(noticeMigration, /source_status_conflict/);
  assert.match(noticeMigration, /Delivery method is required before notice issuance/);
});

test("issued notice completion is derived and issued notices cannot be reverted", () => {
  assert.match(noticeMigration, /old\.status = 'issued' and new\.status <> 'issued'/);
  assert.match(noticeMigration, /Issued PHA family notices are immutable/);
  assert.match(noticeMigration, /set notice_complete = has_issued_notice/);
  assert.match(noticeMigration, /status = 'issued'/);
  assert.match(noticeMigration, /issued_at is not null/);
  assert.match(noticeMigration, /source_validated = true/);
});

test("notice content snapshot is generated server-side from the validated determination", () => {
  assert.match(noticeMigration, /determination_snapshot/);
  assert.match(noticeMigration, /jsonb_build_object/);
  assert.match(noticeMigration, /total_tenant_payment/);
  assert.match(noticeMigration, /housing_assistance_payment/);
  assert.match(noticeMigration, /contract_rent_to_owner/);
  assert.match(noticeMigration, /PHA_ANNUAL_REEXAMINATION_DETERMINATION/);
});

test("PHA notice center generates drafts and issues notices without manual notice completion bypass", () => {
  assert.match(noticeRoute, /PhaNoticeCenter/);
  assert.match(noticeCenter, /Generate notice draft/);
  assert.match(noticeCenter, /Issue notice & continue workflow/);
  assert.match(noticeCenter, /status: "issued"/);
  assert.match(noticeCenter, /delivery_method: deliveryMethod/);
  const mutationBlock = noticeCenter.slice(noticeCenter.indexOf("const generateDraft"), noticeCenter.indexOf("const sourceReady"));
  assert.doesNotMatch(mutationBlock, /notice_complete\s*:/);
});

test("PHA navigation exposes intake, determination, notices, and HUD-50058 as separate workflow modules", () => {
  assert.match(appShell, /\/pha-family-intake/);
  assert.match(appShell, /Family Intake & Evidence/);
  assert.match(appShell, /\/pha-families/);
  assert.match(appShell, /Families & Reexaminations/);
  assert.match(appShell, /\/pha-notices/);
  assert.match(appShell, /Family Notices/);
  assert.match(appShell, /\/pha-50058/);
  assert.match(appShell, /HUD-50058 Queue/);
});
