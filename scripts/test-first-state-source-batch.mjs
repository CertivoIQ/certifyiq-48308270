import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../src/lib/first-state-source-batch-candidates.json", import.meta.url)));

test("contains the controlled four-state candidate batch", () => {
  assert.equal(data.test_id, 66);
  assert.deepEqual(data.states.map((s) => s.state_code), ["WY","WI","WA","VA"]);
  assert.equal(new Set(data.states.map((s) => s.state_code)).size, 4);
});
test("keeps every candidate blocked pending exact source validation", () => {
  assert.match(data.status, /^BLOCKED_/);
  for (const state of data.states) for (const source of state.sources) assert.match(source.status, /^PENDING_/);
});
test("limits sources to each registered official HFA domain", () => {
  for (const state of data.states) for (const source of state.sources) {
    const host = new URL(source.url).hostname.replace(/^www\./,"");
    assert.ok(host === state.official_domain || host.endsWith("." + state.official_domain));
  }
});
test("preserves enterprise property documents outside shared packs", () => {
  for (const required of ["property Form 8609","LURA","HAP contract","regulatory agreement"]) assert.ok(data.shared_pack_excludes.includes(required));
});
test("requires enterprise VP property figure verification before activation", () => {
  assert.equal(data.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(data.activation_requirements.includes("enterprise VP property figure verification"));
});
