import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260826221500_enterprise_license_numbers.sql", import.meta.url),
  "utf8",
);

test("enterprise licenses use immutable customer-facing CIQ license numbers", () => {
  assert.match(migration, /add column if not exists license_number text/i);
  assert.match(migration, /CIQ-' \|\| license_year \|\| '-' \|\| lpad\(sequence_value::text, 6, '0'\)/i);
  assert.match(migration, /new\.status = 'active' and new\.license_number is null/i);
  assert.match(migration, /enterprise license number is immutable/i);
  assert.match(migration, /unique index if not exists enterprise_licenses_license_number_uq/i);
});
