import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828110000_pha_role_access.sql");
const profileHook = read("src/hooks/use-workspace-profile.ts");
const appShell = read("src/components/app-shell.tsx");

test("PHA membership defines operational agency roles and one active workspace per login", () => {
  assert.match(migration, /pha_workspace_memberships/);
  for (const role of ["executive", "agency_admin", "compliance_admin", "hcv_pbv_specialist", "public_housing_specialist", "inspection_staff"]) {
    assert.match(migration, new RegExp(role));
  }
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
  assert.match(migration, /write_access = false and m\.agency_role = 'executive'/);
  assert.match(migration, /hcv_pbv_specialist.*target_program_code in \('hcv','pbv','mod_rehab'\)/s);
  assert.match(migration, /public_housing_specialist.*target_program_code = 'public_housing'/s);
  assert.doesNotMatch(migration, /inspection_staff'.*target_program_code/s);
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
