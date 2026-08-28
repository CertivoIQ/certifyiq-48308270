import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828110000_pha_role_access.sql");
const inspectionMigration = read("supabase/migrations/20260828150000_pha_nspire_inspections.sql");
const portabilityMigration = read("supabase/migrations/20260828160000_pha_hcv_portability.sql");
const inspectionsWorkspace = read("src/components/pha-inspections-workspace.tsx");
const inspectionsRoute = read("src/routes/_authenticated/pha-inspections.tsx");
const portabilityWorkspace = read("src/components/pha-portability-workspace.tsx");
const portabilityRoute = read("src/routes/_authenticated/pha-portability.tsx");
const profileHook = read("src/hooks/use-workspace-profile.ts");
const appShell = read("src/components/app-shell.tsx");

test("PHA membership defines operational agency roles and one active workspace per login", () => {
  assert.match(migration, /pha_workspace_memberships/);
  for (const role of ["executive", "agency_admin", "compliance_admin", "hcv_pbv_specialist", "public_housing_specialist", "inspection_staff"]) assert.match(migration, new RegExp(role));
  assert.match(migration, /pha_workspace_memberships_one_active_workspace_uidx/);
  assert.match(migration, /where active = true/);
  assert.match(migration, /check \(workspace_user_id <> member_user_id\)/);
});

test("PHA members resolve records to the agency workspace instead of personal tenancy", () => {
  assert.match(migration, /current_pha_workspace_user_id/);
  assert.match(migration, /alter table public\.pha_family_actions alter column user_id set default public\.current_pha_workspace_user_id\(\)/);
  assert.match(migration, /alter table public\.pha_family_evidence alter column user_id set default public\.current_pha_workspace_user_id\(\)/);
  assert.match(migration, /alter table public\.pha_family_notices alter column user_id set default public\.current_pha_workspace_user_id\(\)/);
  assert.match(migration, /alter table public\.pha_50058_transactions alter column user_id set default public\.current_pha_workspace_user_id\(\)/);
});

test("executives are read-only while specialists are program scoped", () => {
  const accessBlock = migration.slice(migration.indexOf("create or replace function public.pha_program_access"), migration.indexOf("create or replace function public.pha_family_access"));
  assert.match(accessBlock, /write_access = false and m\.agency_role = 'executive'/);
  assert.match(accessBlock, /hcv_pbv_specialist.*target_program_code in \('hcv','pbv','mod_rehab'\)/s);
  assert.match(accessBlock, /public_housing_specialist.*target_program_code = 'public_housing'/s);
  assert.doesNotMatch(accessBlock, /m\.agency_role = 'inspection_staff'/);
});

test("family EIV calculation notice and HUD-50058 RLS use agency role functions", () => {
  assert.match(migration, /PHA family actions read/);
  assert.match(migration, /PHA family actions insert/);
  assert.match(migration, /pha_family_access\(family_action_id, false\)/);
  assert.match(migration, /pha_family_access\(family_action_id, true\)/);
  assert.match(migration, /PHA family calculations read/);
  assert.match(migration, /PHA 50058 transactions read/);
  assert.match(migration, /PHA EIV exceptions read/);
});

test("inspection staff receive inspection-only database access", () => {
  assert.match(inspectionMigration, /PHA inspection staff write inspections/);
  assert.match(inspectionMigration, /PHA inspection staff write deficiencies/);
  assert.match(inspectionMigration, /agency_role = 'inspection_staff'/);
  assert.match(inspectionMigration, /pha_inspection_transition_profiles/);
  assert.match(inspectionMigration, /pha_inspections/);
  assert.match(inspectionMigration, /pha_inspection_deficiencies/);
});

test("NSPIRE transition logic keeps Public Housing on NSPIRE and voucher programs within February 1 2027", () => {
  assert.match(inspectionMigration, /program_code = 'public_housing' and current_standard = 'nspire'/);
  assert.match(inspectionMigration, /planned_nspire_date <= date '2027-02-01'/);
  assert.match(inspectionMigration, /cannot be later than February 1, 2027/);
  assert.match(inspectionMigration, /new\.standard_used := parent_row\.standard_used/);
});

test("PHA inspection route is a live transition and scheduling workspace", () => {
  assert.match(inspectionsRoute, /PhaInspectionsWorkspace/);
  assert.match(inspectionsWorkspace, /NSPIRE transition controls/);
  assert.match(inspectionsWorkspace, /HUD notification/);
  assert.match(inspectionsWorkspace, /Schedule inspection/);
  assert.match(inspectionsWorkspace, /Inspection register/);
});

test("portability is HCV-only and protected at the family-action boundary", () => {
  assert.match(portabilityMigration, /Portability family actions are supported only for HCV tenant-based assistance/);
  assert.match(portabilityMigration, /new\.action_type = 'portability' and new\.program_code <> 'hcv'/);
  assert.match(portabilityMigration, /Portability case requires an HCV portability family action/);
  assert.match(portabilityMigration, /PHA HCV users write portability cases/);
});

test("HCV portability does not redetermine participant income merely due to a port", () => {
  assert.match(portabilityMigration, /if new\.family_status = 'participant' then new\.income_redetermination_required := false/);
  assert.match(portabilityMigration, /24 CFR 982\.353/);
  assert.match(portabilityWorkspace, /Participant income redetermination solely for port: <strong>No<\/strong>/);
});

test("portability handoff requires receiving PHA decision and HUD packet", () => {
  assert.match(portabilityMigration, /confirmed receiving-PHA contact/);
  assert.match(portabilityMigration, /written receiving-PHA confirmation/);
  assert.match(portabilityMigration, /Receiving PHA absorption decision cannot be reversed without initial PHA consent/);
  assert.match(portabilityMigration, /HUD-52665 Part I is required before portability packet release/);
  assert.match(portabilityMigration, /Current HUD-50058 and related verification packet are required before portability packet release/);
  assert.match(portabilityMigration, /special_purpose_voucher_code/);
});

test("portability billing keeps federal formula but fails closed on financial procedure source", () => {
  assert.match(portabilityMigration, /round\(new\.initial_pha_admin_fee \* 0\.80, 2\)/);
  assert.match(portabilityMigration, /least\(eighty_percent, new\.receiving_pha_admin_fee\)/);
  assert.match(portabilityMigration, /financial_procedure_source_status/);
  assert.match(portabilityMigration, /pending_source/);
});

test("HCV portability route is role-scoped and operational", () => {
  assert.match(portabilityRoute, /PhaPortabilityWorkspace/);
  assert.match(portabilityWorkspace, /Receiving PHA coordination/);
  assert.match(portabilityWorkspace, /HUD-52665 Part I reference/);
  assert.match(portabilityWorkspace, /Record absorb \/ bill decision/);
  assert.match(appShell, /\/pha-portability/);
  assert.match(appShell, /hcv_operations/);
  assert.match(appShell, /role === "hcv_pbv_specialist"/);
});

test("workspace hook resolves a member to the PHA owner's workspace and role", () => {
  assert.match(profileHook, /PhaAgencyRole/);
  assert.match(profileHook, /workspaceUserId/);
  assert.match(profileHook, /phaRole/);
  assert.match(profileHook, /pha_workspace_memberships/);
  assert.match(profileHook, /member_user_id/);
  assert.match(profileHook, /membership\.data\.workspace_user_id/);
});

test("PHA navigation is role aware", () => {
  assert.match(appShell, /phaNavAllowed/);
  assert.match(appShell, /role === "executive"/);
  assert.match(appShell, /role === "inspection_staff"/);
  assert.match(appShell, /role === "hcv_pbv_specialist"/);
  assert.match(appShell, /role === "public_housing_specialist"/);
  assert.match(appShell, /PHA_NAV\.filter/);
});
