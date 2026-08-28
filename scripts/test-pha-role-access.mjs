import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828110000_pha_role_access.sql");
const inspectionMigration = read("supabase/migrations/20260828150000_pha_nspire_inspections.sql");
const portabilityMigration = read("supabase/migrations/20260828160000_pha_hcv_portability.sql");
const waitingMigration = read("supabase/migrations/20260828170000_pha_waiting_lists.sql");
const legalNoticeMigration = read("supabase/migrations/20260828140000_pha_legal_notice_controls.sql");
const inspectionsWorkspace = read("src/components/pha-inspections-workspace.tsx");
const inspectionsRoute = read("src/routes/_authenticated/pha-inspections.tsx");
const portabilityWorkspace = read("src/components/pha-portability-workspace.tsx");
const portabilityRoute = read("src/routes/_authenticated/pha-portability.tsx");
const waitingWorkspace = read("src/components/pha-waiting-list-workspace.tsx");
const waitingRoute = read("src/routes/_authenticated/pha-waiting-lists.tsx");
const policyConsole = read("src/components/pha-policy-overlay-console.tsx");
const policyRoute = read("src/routes/_authenticated/pha-policies.tsx");
const profileHook = read("src/hooks/use-workspace-profile.ts");
const appShell = read("src/components/app-shell.tsx");

test("PHA membership defines operational agency roles and one active workspace per login", () => {
  assert.match(migration, /pha_workspace_memberships/);
  for (const role of ["executive", "agency_admin", "compliance_admin", "hcv_pbv_specialist", "public_housing_specialist", "inspection_staff"]) assert.match(migration, new RegExp(role));
  assert.match(migration, /pha_workspace_memberships_one_active_workspace_uidx/);
  assert.match(migration, /where active = true/);
  assert.match(migration, /check \(workspace_user_id <> member_user_id\)/);
});

test("executives are read-only while specialists are program scoped", () => {
  const accessBlock = migration.slice(migration.indexOf("create or replace function public.pha_program_access"), migration.indexOf("create or replace function public.pha_family_access"));
  assert.match(accessBlock, /write_access = false and m\.agency_role = 'executive'/);
  assert.match(accessBlock, /hcv_pbv_specialist.*target_program_code in \('hcv','pbv','mod_rehab'\)/s);
  assert.match(accessBlock, /public_housing_specialist.*target_program_code = 'public_housing'/s);
  assert.doesNotMatch(accessBlock, /m\.agency_role = 'inspection_staff'/);
});

test("inspection staff receive inspection-only database access", () => {
  assert.match(inspectionMigration, /PHA inspection staff write inspections/);
  assert.match(inspectionMigration, /PHA inspection staff write deficiencies/);
  assert.match(inspectionMigration, /agency_role = 'inspection_staff'/);
});

test("NSPIRE transition logic keeps Public Housing on NSPIRE and voucher programs within February 1 2027", () => {
  assert.match(inspectionMigration, /program_code = 'public_housing' and current_standard = 'nspire'/);
  assert.match(inspectionMigration, /planned_nspire_date <= date '2027-02-01'/);
  assert.match(inspectionMigration, /new\.standard_used := parent_row\.standard_used/);
});

test("PHA inspection route is live", () => {
  assert.match(inspectionsRoute, /PhaInspectionsWorkspace/);
  assert.match(inspectionsWorkspace, /NSPIRE transition controls/);
  assert.match(inspectionsWorkspace, /Inspection register/);
});

test("portability is HCV-only and protected at the family-action boundary", () => {
  assert.match(portabilityMigration, /Portability family actions are supported only for HCV tenant-based assistance/);
  assert.match(portabilityMigration, /new\.action_type = 'portability' and new\.program_code <> 'hcv'/);
  assert.match(portabilityMigration, /Portability case requires an HCV portability family action/);
});

test("HCV portability does not redetermine participant income merely due to a port", () => {
  assert.match(portabilityMigration, /if new\.family_status = 'participant' then new\.income_redetermination_required := false/);
  assert.match(portabilityWorkspace, /Participant income redetermination solely for port: <strong>No<\/strong>/);
});

test("portability handoff requires receiving PHA decision and HUD packet", () => {
  assert.match(portabilityMigration, /Receiving PHA absorption decision cannot be reversed without initial PHA consent/);
  assert.match(portabilityMigration, /HUD-52665 Part I is required before portability packet release/);
  assert.match(portabilityMigration, /Current HUD-50058 and related verification packet are required before portability packet release/);
  assert.match(portabilityRoute, /PhaPortabilityWorkspace/);
});

test("agency notice policy overlays remain distinct from federal authority profiles", () => {
  assert.match(legalNoticeMigration, /pha_notice_requirement_profiles/);
  assert.match(legalNoticeMigration, /pha_notice_policy_overlays/);
  assert.match(legalNoticeMigration, /administrative_plan/);
  assert.match(legalNoticeMigration, /acop/);
});

test("PHA policy console creates unvalidated versions and validates explicitly", () => {
  assert.match(policyRoute, /PhaPolicyOverlayConsole/);
  assert.match(policyConsole, /Save unvalidated policy version/);
  assert.match(policyConsole, /validated: false/);
  assert.match(policyConsole, /validated_by: user\.id/);
  assert.match(policyConsole, /Validate version/);
});

test("waiting lists are scoped to verified HCV and Public Housing rules only", () => {
  assert.match(waitingMigration, /program_code text not null check \(program_code in \('hcv','public_housing'\)\)/);
  assert.match(waitingMigration, /Validated current agency policy overlay is required for waiting-list operations/);
  assert.match(waitingMigration, /expected_policy := case when new\.program_code='public_housing' then 'acop' else 'administrative_plan'/);
  assert.match(waitingWorkspace, /PBV is excluded until its separate waiting-list rules are activated/);
});

test("waiting-list preference ranking and selection are server derived and auditable", () => {
  assert.match(waitingMigration, /Applicant preference code is not an active controlled preference/);
  assert.match(waitingMigration, /select min\(preference_priority\)/);
  assert.match(waitingMigration, /select_next_pha_waiting_list_applicant/);
  assert.match(waitingMigration, /candidate_snapshot/);
  assert.match(waitingMigration, /policy_snapshot/);
  assert.match(waitingMigration, /Waiting list must be closed before selection to preserve the candidate pool/);
  assert.match(waitingMigration, /order by application_received_at,id limit 1/);
  assert.match(waitingMigration, /order by random\(\) limit 1/);
});

test("waiting-list removal protects reasonable-accommodation review", () => {
  assert.match(waitingMigration, /Applicant cannot be removed while reasonable-accommodation review is required/);
  assert.match(waitingMigration, /Waiting-list removal requires a documented reason/);
  assert.match(waitingWorkspace, /Reasonable-accommodation review required before any nonresponse removal/);
});

test("waiting-list workspace exposes controlled preferences, applicants, and selection audit", () => {
  assert.match(waitingRoute, /PhaWaitingListWorkspace/);
  assert.match(waitingWorkspace, /Controlled local preferences/);
  assert.match(waitingWorkspace, /Select next applicant/);
  assert.match(waitingWorkspace, /Preference verification due/);
  assert.match(appShell, /\/pha-waiting-lists/);
  assert.match(appShell, /waiting_lists/);
});

test("workspace hook resolves a member to the PHA owner's workspace and role", () => {
  assert.match(profileHook, /PhaAgencyRole/);
  assert.match(profileHook, /workspaceUserId/);
  assert.match(profileHook, /phaRole/);
  assert.match(profileHook, /pha_workspace_memberships/);
});

test("PHA navigation is role aware", () => {
  assert.match(appShell, /phaNavAllowed/);
  assert.match(appShell, /role === "executive"/);
  assert.match(appShell, /role === "inspection_staff"/);
  assert.match(appShell, /role === "hcv_pbv_specialist"/);
  assert.match(appShell, /role === "public_housing_specialist"/);
  assert.match(appShell, /PHA_NAV\.filter/);
});
