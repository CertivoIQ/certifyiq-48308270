import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260830092000_product_feature_suggestions.sql");
const server = read("src/lib/feature-suggestions.functions.ts");
const template = read("src/lib/email-templates/product-feature-suggestion.tsx");
const registry = read("src/lib/email-templates/registry.ts");
const route = read("src/routes/_authenticated/feature-suggestions.tsx");
const appShell = read("src/components/app-shell.tsx");
const crmShell = read("src/components/crm/crm-shell.tsx");

test("suggestions are recorded in a tenant-safe, server-write-only table", () => {
  assert.match(migration, /create table if not exists public\.product_feature_suggestions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.product_feature_suggestions from anon, authenticated/);
  assert.match(migration, /grant select on table public\.product_feature_suggestions to authenticated/);
  assert.match(migration, /grant all on table public\.product_feature_suggestions to service_role/);
  assert.doesNotMatch(migration, /grant insert[^;]*authenticated/i);
  assert.match(migration, /auth\.uid\(\)\) = submitted_by/);
  assert.match(migration, /public\.has_role\(\(select auth\.uid\(\)\), 'staff'\)/);
  assert.match(migration, /drop policy if exists/);
  assert.match(migration, /drop trigger if exists/);
});

test("server verifies identity, derives role, rate limits, and preserves delivery evidence", () => {
  assert.match(server, /auth\.getUser\(data\.accessToken\)/);
  assert.match(server, /user\.email_confirmed_at/);
  assert.match(server, /\(count \?\? 0\) >= 5/);
  assert.match(server, /from\("customer_workspace_profiles"\)/);
  assert.match(server, /from\("pha_workspace_memberships"\)/);
  assert.match(server, /from\("crm_staff_access"\)/);
  assert.match(server, /from\("product_feature_suggestions"\)[\s\S]*?\.insert\(/);
  assert.match(server, /sendTemplateEmail\("product-feature-suggestion"/);
  assert.match(server, /idempotencyKey: `product-feature-suggestion-\$\{suggestion\.id\}`/);
  assert.match(server, /replyTo: user\.email/);
  assert.match(server, /email_delivery_status/);
  assert.match(server, /email_delivery_error/);
});

test("private product email route is fixed server-side and registered", () => {
  assert.match(template, /to: "rjwatkins@certivoiq\.com"/i);
  assert.match(registry, /product-feature-suggestion/);
  assert.doesNotMatch(route, /rjwatkins@certivoiq\.com/i);
});

test("all workspace and CRM roles receive suggestion access", () => {
  assert.equal((appShell.match(/to: "\/feature-suggestions"/g) ?? []).length, 2);
  assert.match(appShell, /label: "Suggest a Feature", icon: Lightbulb, key: "support"/);
  assert.match(appShell, /key === "command" \|\| key === "tasks" \|\| key === "support"/);
  assert.match(crmShell, /<Link to="\/feature-suggestions">/);
  assert.match(route, /title="Suggest a Feature"/);
  assert.match(route, /Your account, workspace, and role are attached automatically/);
  assert.match(route, /Only you and authorized CertivoIQ staff can view these records/);
});
