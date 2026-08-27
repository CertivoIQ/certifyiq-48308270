import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = JSON.parse(
  await readFile(new URL("../src/lib/nationwide-state-source-discovery.json", import.meta.url)),
);

test("covers every state, the District of Columbia, and all tracked territories", () => {
  assert.equal(inventory.coverage_status, "SOURCE_CANDIDATES_ONLY");
  assert.equal(inventory.counts.state_and_district_codes, 51);
  assert.equal(inventory.counts.territory_codes, 4);
  assert.equal(inventory.counts.jurisdiction_scopes, 56);
  assert.ok(inventory.counts.source_candidates >= 152);
});

test("keeps discovered sources fail-closed until the controlled release gate passes", () => {
  assert.match(inventory.activation_policy, /^CANDIDATE DISCOVERY DOES NOT ACTIVATE/);
  for (const jurisdiction of inventory.jurisdictions) {
    assert.match(jurisdiction.state_code, /^[A-Z]{2}$/);
    assert.ok(jurisdiction.agency);
    assert.ok(jurisdiction.official_domain);
    assert.ok(jurisdiction.sources.length > 0);
    for (const source of jurisdiction.sources) {
      assert.equal(new URL(source.url).protocol, "https:");
      assert.match(source.status, /^(PENDING_|BLOCKED_)/);
    }
  }
});
