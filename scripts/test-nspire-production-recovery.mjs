import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260829030000_restore_nspire_registry_schema.sql", import.meta.url),
  "utf8",
);

test("NSPIRE bootstrap defaults every registry row to fail closed", () => {
  assert.match(migration, /source_status text not null default 'pending_source'/);
  assert.match(migration, /active boolean not null default false/);
});

test("NSPIRE bootstrap enables RLS and limits writes to staff", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for all to authenticated[\s\S]*public\.has_role\(auth\.uid\(\), 'staff'\)/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all)\s+on[^;]+to\s+anon/i);
});

test("NSPIRE bootstrap is compatible with controlled release migrations", () => {
  for (const column of [
    "release_id uuid",
    "source_checksum text",
    "hcv_correction_hours integer",
    "hcv_pass_fail text not null",
  ]) {
    assert.ok(migration.includes(column), `missing compatibility column: ${column}`);
  }
});
