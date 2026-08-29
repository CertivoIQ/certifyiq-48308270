import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
const config = JSON.parse(readFileSync(new URL("../config/remaining-state-validation-sources.json", import.meta.url), "utf8"));
const script = readFileSync(new URL("./capture-remaining-state-validation-sources.mjs", import.meta.url), "utf8");
const evidenceUrl = new URL("../artifacts/remaining-state-source-evidence.json", import.meta.url);
const migration = readFileSync(
  new URL("../supabase/migrations/20260829065300_record_remaining_state_source_captures.sql", import.meta.url),
  "utf8",
);

test("inventory covers every remaining unique validation link", () => {
  assert.equal(config.sources.length, config.sourceCount);
  assert.equal(new Set(config.sources.map((source) => `${source.stateCode}|${source.sourceType}|${source.url}`)).size, config.sourceCount);
  assert.ok(config.sourceCount > 0);
  for (const source of config.sources) {
    assert.match(source.stateCode, /^[A-Z]{2}$/);
    assert.ok(source.url.startsWith("https://"));
    assert.ok(source.allowedHosts.includes(new URL(source.url).hostname));
  }
});
test("capture hashes exact bytes and pins redirect authorities", () => {
  assert.match(script, /response\.arrayBuffer\(\)/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /isAllowedHost\(source, finalUrl\.hostname/);
  assert.match(script, /AbortSignal\.timeout\(20_000\)/);
});
test("capture cannot activate rules or represent independent validation", () => {
  assert.match(script, /captureStatus: "captured_unvalidated"/);
  assert.match(script, /independentValidationRequired: true/);
  assert.equal((script.match(/complianceActivationAllowed: false/g) ?? []).length, 3);
});
test("committed evidence is structurally complete when present", () => {
  if (!existsSync(evidenceUrl)) return;
  const evidence = JSON.parse(readFileSync(evidenceUrl, "utf8"));
  assert.equal(evidence.sourceCount, config.sourceCount);
  assert.equal(evidence.sources.length, config.sourceCount);
  assert.equal(evidence.complianceActivationAllowed, false);
  for (const source of evidence.sources.filter((item) => item.captureStatus === "captured_unvalidated")) {
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.ok(source.byteSize > 0);
    assert.equal(source.complianceActivationAllowed, false);
  }
});

test("database reconciliation remains fail closed", () => {
  assert.match(migration, /captured_updates <> 113/);
  assert.match(migration, /blocked_updates <> 6/);
  assert.match(migration, /agent_verification_in_progress/);
  assert.match(migration, /independent_validation_required/);
  assert.match(migration, /compliance_activation_allowed = false/);
  assert.doesNotMatch(migration, /compliance_activation_allowed\s*=\s*true/);
});
