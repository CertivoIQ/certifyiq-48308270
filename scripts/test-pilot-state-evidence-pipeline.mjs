import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../config/pilot-state-sources.json", import.meta.url), "utf8"),
);
const script = readFileSync(
  new URL("./capture-pilot-state-evidence.mjs", import.meta.url),
  "utf8",
);

test("pilot manifest covers every queued Tennessee and Texas source", () => {
  assert.deepEqual(config.states, ["TN", "TX"]);
  assert.equal(config.sources.filter((source) => source.stateCode === "TN").length, 4);
  assert.equal(config.sources.filter((source) => source.stateCode === "TX").length, 6);
  assert.equal(new Set(config.sources.map((source) => source.url)).size, 10);
});

test("capture hashes exact response bytes and pins redirect authorities", () => {
  assert.match(script, /response\.arrayBuffer\(\)/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /source\.allowedHosts\.includes\(finalUrl\.hostname\)/);
  assert.match(script, /AbortSignal\.timeout\(30_000\)/);
});

test("capture cannot activate compliance and requires independent validation", () => {
  assert.match(script, /captureStatus: "captured_unvalidated"/);
  assert.match(script, /independentValidationRequired: true/);
  assert.equal((script.match(/complianceActivationAllowed: false/g) ?? []).length, 3);
});
