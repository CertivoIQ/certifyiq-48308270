import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828320000_crm_staff_access_invitations.sql");
const edge = read("supabase/functions/crm-staff-access/index.ts");
const client = read("src/lib/crm-staff-access.functions.ts");
const route = read("src/routes/_authenticated/crm-staff.tsx");
const shell = read("src/components/crm/crm-shell.tsx");
const session = read("src/hooks/use-session.tsx");

test("staff invitation migration creates the access, invitation, and append-only audit records", () => {
  for (const table of ["crm_staff_access", "crm_staff_invitations", "crm_staff_access_events"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  assert.match(migration, /access_level in \('employee',\s*'manager',\s*'admin'\)/i);
  assert.match(migration, /crm_staff_can_manage/i);
  assert.match(migration, /crm_staff_is_admin/i);
  assert.match(migration, /rjwatkins@certivoiq\.com/i);
  assert.match(migration, /access events are append-only/i);
});

test("new staff access is controlled by an exact pending invitation, not the email domain alone", () => {
  const handler = migration.slice(migration.lastIndexOf("create or replace function public.handle_new_user"));
  assert.match(handler, /from public\.crm_staff_invitations/i);
  assert.match(handler, /status = 'pending'/i);
  assert.match(handler, /expires_at > now\(\)/i);
  assert.match(handler, /insert into public\.user_roles/i);
  assert.match(migration, /create or replace function public\.claim_crm_staff_invitation\(\)/i);
  assert.match(migration, /select \* into v_user from auth\.users where id = auth\.uid\(\)/i);
  assert.match(migration, /grant execute on function public\.claim_crm_staff_invitation\(\) to authenticated, service_role/i);
  assert.doesNotMatch(migration, /create trigger accept_crm_staff_invitation_after_confirmation/i);
  assert.doesNotMatch(handler, /if v_email_domain = 'certivoiq\.com' then[\s\S]*insert into public\.user_roles/i);
  assert.match(session, /administrator- or manager-issued invitation/i);
});

test("Edge Function enforces manager and administrator authority", () => {
  assert.match(edge, /Only an active CertivoIQ administrator or manager/i);
  assert.match(edge, /requesterLevel === "manager" && level !== "employee"/i);
  assert.match(edge, /BETA EMAIL POLICY — revert this set to only "certivoiq\.com" before launch/i);
  for (const domain of ["certivoiq.com", "gmail.com", "outlook.com", "hotmail.com", "live.com"]) {
    assert.match(edge, new RegExp(`"${domain.replace(".", "\\.")}"`, "i"));
  }
  assert.match(edge, /allowedStaffEmailDomains\.has\(emailDomain\)/i);
  assert.match(edge, /auth\.admin\.inviteUserByEmail/i);
  assert.match(edge, /APP_ORIGIN \+ "\/reset-password"/i);
  assert.match(edge, /You cannot change your own CRM access/i);
  assert.match(edge, /\.delete\(\)\.eq\("user_id", target\.user_id\)\.eq\("role", "staff"\)/i);
  assert.match(edge, /crm_staff_access_events/i);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/i);
});

test("browser client invokes the protected Edge Function without exposing server credentials", () => {
  assert.match(client, /supabase\.functions\.invoke\("crm-staff-access"/i);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i);
});

test("CRM visibly exposes staff access only to managers and administrators", () => {
  assert.match(shell, /canManageStaff \? \(/i);
  assert.match(shell, /to="\/crm-staff"/i);
  assert.match(shell, />Staff Access</i);
  assert.match(route, /Administrator or manager access required/i);
  assert.match(route, /Employee accounts cannot invite, activate, or deactivate CRM users/i);
  assert.match(route, /Send invitation/i);
  assert.match(route, /Account role/i);
  assert.match(route, /Public Housing Agency/i);
  assert.match(route, /PHA workspace/i);
  assert.match(route, /pha_workspace_invitations/i);
  assert.match(route, /sendPhaWorkspaceInvitationEmail/i);
  for (const role of [
    "executive",
    "agency_admin",
    "compliance_admin",
    "hcv_pbv_specialist",
    "public_housing_specialist",
    "inspection_staff",
  ]) {
    assert.match(route, new RegExp(role, "i"));
  }
  assert.match(route, /Administrator access is required to assign a PHA role/i);
  assert.match(route, /No configured PHA workspace is available/i);
  assert.match(route, /Beta email policy/i);
  assert.match(route, /External domains will be removed before launch/i);
  assert.match(route, /Manager — may invite employees/i);
  assert.match(route, /Administrator — full staff-access authority/i);
  for (const action of ["Resend", "Revoke", "Deactivate", "Reactivate"]) {
    assert.match(route, new RegExp(action, "i"));
  }
});
