import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828120000_pha_user_invitations.sql");
const users = read("src/routes/_authenticated/pha-users.tsx");
const gate = read("src/components/pha-invitation-gate.tsx");
const dashboard = read("src/routes/_authenticated/dashboard.tsx");
const shell = read("src/components/app-shell.tsx");

test("PHA invitations are email-bound, expiring, and auditable", () => {
  assert.match(migration, /pha_workspace_invitations/);
  assert.match(migration, /status in \('pending','accepted','revoked','expired'\)/);
  assert.match(migration, /now\(\) \+ interval '7 days'/);
  assert.match(migration, /accepted_by/);
  assert.match(migration, /accepted_at/);
  assert.match(migration, /invite_email = lower\(trim\(invite_email\)\)/);
});

test("invitation acceptance requires the signed-in email and creates a PHA membership", () => {
  assert.match(migration, /accept_pha_workspace_invitation/);
  assert.match(migration, /auth\.jwt\(\) ->> 'email'/);
  assert.match(migration, /lower\(invitation\.invite_email\) <> signed_in_email/);
  assert.match(migration, /insert into public\.pha_workspace_memberships/);
  assert.match(migration, /status = 'accepted'/);
});

test("workspace owner and agency admin manage invitations while agency admin cannot appoint another agency admin", () => {
  assert.match(migration, /pha_workspace_admin_access/);
  assert.match(migration, /m\.agency_role = 'agency_admin'/);
  assert.match(migration, /agency_role <> 'agency_admin'/);
  assert.match(users, /phaRole === "workspace_owner" \|\| phaRole === "agency_admin"/);
  assert.match(users, /Only the workspace owner can assign another Agency Admin/);
});

test("PHA users page creates, revokes, activates, and deactivates controlled access records", () => {
  assert.match(users, /Create secure invitation/);
  assert.match(users, /pha_workspace_invitations/);
  assert.match(users, /pha_workspace_memberships/);
  assert.match(users, /status: "revoked"/);
  assert.match(users, /Deactivate/);
  assert.match(users, /Reactivate/);
});

test("pending invitations surface on dashboard and invoke only the controlled acceptance function", () => {
  assert.match(dashboard, /PhaInvitationGate/);
  assert.match(gate, /PHA workspace invitation/);
  assert.match(gate, /accept_pha_workspace_invitation/);
  assert.match(gate, /target_invitation_id/);
  assert.doesNotMatch(gate, /pha_workspace_memberships.*insert/s);
});

test("PHA navigation routes admins to the dedicated users and permissions module", () => {
  assert.match(shell, /\/pha-users/);
  assert.match(shell, /Users & Permissions/);
});
