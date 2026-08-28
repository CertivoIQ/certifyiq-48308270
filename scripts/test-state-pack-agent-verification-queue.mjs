import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = JSON.parse(
  await readFile(
    new URL("../src/lib/nationwide-state-source-discovery.json", import.meta.url),
  ),
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/20260828330000_state_pack_agent_verification_queue.sql",
    import.meta.url,
  ),
  "utf8",
);

const stateCodes = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const jurisdictions = inventory.jurisdictions.filter((entry) =>
  stateCodes.includes(entry.state_code),
);
const sourceCandidates = jurisdictions.flatMap((entry) =>
  entry.sources.map((source) => ({ ...source, state_code: entry.state_code })),
);

test("queues exactly all 50 states and every official-source candidate", () => {
  assert.equal(new Set(jurisdictions.map((entry) => entry.state_code)).size, 50);
  assert.equal(sourceCandidates.length, 145);

  for (const code of stateCodes) {
    assert.match(
      migration,
      new RegExp(`\\('${code}','2026-08-27T00:00:00\\.000Z'::timestamptz,'queued_for_agent_verification'`),
      `${code} is missing from the agent-verification queue`,
    );
  }

  for (const source of sourceCandidates) {
    assert.ok(
      migration.includes(source.url.replaceAll("'", "''")),
      `${source.state_code} source is missing: ${source.url}`,
    );
  }
});

test("keeps candidate upload fail closed until independent release", () => {
  assert.match(migration, /compliance_activation_allowed boolean not null default false/);
  assert.match(migration, /check \(compliance_activation_allowed = false\)/);
  assert.match(migration, /agent_verification_required boolean not null default true/);
  assert.match(migration, /exact_bytes_captured boolean not null default false/);
  assert.match(migration, /source_sha256 text check/);
  assert.doesNotMatch(migration, /status[^\n]*'validated'/);
});

test("protects the review queue with RLS and staff-only visibility", () => {
  assert.match(migration, /alter table public\.state_rule_pack_candidates enable row level security/);
  assert.match(migration, /alter table public\.state_rule_source_candidates enable row level security/);
  assert.match(migration, /public\.has_role\(auth\.uid\(\), 'staff'::public\.app_role\)/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all)[^;]* to authenticated/i);
});
