import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batch = JSON.parse(await readFile(new URL("../src/lib/twelfth-state-source-batch-candidates.json", import.meta.url), "utf8"));

test("Test 101 audits the canonical GA, FL, DC and DE batch", () => {
  assert.equal(batch.test_id, 77);
  assert.equal(batch.source_capture_test_id, 101);
  assert.deepEqual(batch.states.map((state) => state.state_code), ["GA", "FL", "DC", "DE"]);
});

test("sources stay on declared official domains without fabricated hashes", () => {
  for (const jurisdiction of batch.states) {
    const domains = jurisdiction.official_domains ?? [jurisdiction.official_domain];
    for (const source of jurisdiction.sources) {
      assert.ok(domains.includes(new URL(source.url).hostname.replace(/^www\./, "")));
      assert.ok(!("sha256" in source));
      assert.match(source.status, /^(?:PENDING|BLOCKED)_/);
    }
  }
});

test("preserves key authority blockers and property exclusions", () => {
  const byCode = Object.fromEntries(batch.states.map((state) => [state.state_code, state]));
  assert.ok(byCode.GA.conflicts.some((value) => value.includes("March 2024")));
  assert.ok(byCode.FL.conflicts.some((value) => value.includes("Competitive RFAs")));
  assert.ok(byCode.DC.conflicts.some((value) => value.includes("DCHFA")));
  assert.ok(byCode.DE.conflicts.some((value) => value.includes("separately distributed")));
  for (const value of ["property Form 8609", "LURA or declaration", "HAP contract"]) assert.ok(batch.shared_pack_excludes.includes(value));
});

test("canonical candidates remain fail-closed and VP-gated", () => {
  assert.match(batch.status, /^BLOCKED_/);
  assert.equal(batch.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(batch.activation_requirements.includes("conflict resolution"));
  assert.ok(batch.states.every((state) => state.sources.length >= 2 && state.conflicts.length >= 2));
});
