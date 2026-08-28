import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828350000_founder_admin_bootstrap.sql");
const route = read("src/routes/founder-setup.tsx");

test("founder bootstrap is exact-email, verified, one-time, and fail-closed", () => {
  assert.match(migration, /auth\.uid\(\) is null/i);
  assert.match(migration, /email_confirmed_at is null/i);
  assert.match(migration, /lower\(v_user\.email\) <> 'rjwatkins@certivoiq\.com'/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /founder_already_activated/i);
  assert.match(migration, /insert into public\.user_roles/i);
  assert.match(migration, /'admin', 'active'/i);
  assert.match(migration, /'founder_internal'/i);
  assert.match(migration, /revoke all on function public\.claim_certivoiq_founder_admin\(\) from public/i);
});

test("founder setup is separate from trial and requires verification before claim", () => {
  assert.match(route, /createFileRoute\("\/founder-setup"\)/);
  assert.match(route, /This one-time flow creates the permanent CertivoIQ founder account/i);
  assert.match(route, /does not start a trial or require billing/i);
  assert.match(route, /emailRedirectTo: `\$\{window\.location\.origin\}\/founder-setup`/i);
  assert.match(route, /claim_certivoiq_founder_admin/i);\n  assert.match(route, /supabase\\.rpc\\.bind\\(supabase\\)/i);\n  assert.doesNotMatch(route, /const rpc = supabase\\.rpc as unknown as FounderRpc/i);
  assert.doesNotMatch(route, /\/trial/);
  assert.match(route, /noindex, nofollow/i);
});
