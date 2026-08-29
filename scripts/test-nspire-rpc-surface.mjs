import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260829040000_harden_nspire_release_rpcs.sql", import.meta.url),
  "utf8",
);

test("NSPIRE elevated implementations move out of public", () => {
  for (const signature of [
    "activate_pha_nspire_standard_release(uuid)",
    "refresh_pha_nspire_release_counts(uuid)",
    "attest_and_activate_pha_nspire_release(uuid, text)",
  ]) {
    assert.match(migration, new RegExp(`alter function public\\.${signature.replace(/[()]/g, "\\$&")}\\s+set schema private`));
  }
});

test("NSPIRE public RPCs are invoker wrappers with explicit grants", () => {
  assert.equal((migration.match(/security invoker/g) ?? []).length, 3);
  assert.equal((migration.match(/from public, anon/g) ?? []).length, 6);
  assert.equal((migration.match(/to authenticated, service_role/g) ?? []).length, 6);
});

test("NSPIRE trigger function has an immutable search path", () => {
  assert.match(
    migration,
    /alter function public\.prepare_pha_nspire_standard_release\(\)[\s\S]*set search_path = pg_catalog, public/,
  );
});
