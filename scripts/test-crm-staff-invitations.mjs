import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828320000_crm_staff_access_invitations.sql");
const server = read("src/lib/crm-staff-access.functions.ts");
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
  assert.match(migration, /'admin'/i);
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

test("server enforces manager and administrator authority", () => {
  assert.match(server, /Only an active CertivoIQ administrator or manager/i);
  assert.match(server, /requesterLevel === "manager" && accessLevel !== "employee"/i);
  assert.match(server, /CRM invitations require a @certivoiq\.com employee address/i);
  assert.match(server, /auth\.admin\.inviteUserByEmail/i);
  assert.match(server, /redirectTo: "https:\/\/certivoiq\.com\/reset-password"/i);
  assert.match(server, /You cannot change your own CRM access/i);
  assert.match(server, /\.delete\(\)\.eq\("user_id", target\.user_id\)\.eq\("role", "staff"\)/i);
  assert.match(server, /crm_staff_access_events/i);
});

test("CRM visibly exposes staff access only to managers and administrators", () => {
  assert.match(shell, /canManageStaff \? \(/i);
  assert.match(shell, /to="\/crm-staff"/i);
  assert.match(shell, />Staff Access</i);
  assert.match(route, /Administrator or manager access required/i);
  assert.match(route, /Employee accounts cannot invite, activate, or deactivate CRM users/i);
  assert.match(route, /Send CRM invitation/i);
  assert.match(route, /Manager — may invite employees/i);
  assert.match(route, /Administrator — full staff-access authority/i);
  for (const action of ["Resend", "Revoke", "Deactivate", "Reactivate"]) {
    assert.match(route, new RegExp(action, "i"));
  }
});
