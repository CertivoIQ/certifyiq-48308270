import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../src/lib/first-wave-state-pack-source-intake.json", import.meta.url)),
);

test("defines the approved first wave without activating it", () => {
  assert.equal(manifest.batch, "WA-WI-TX-MO-OH");
  assert.deepEqual(manifest.states.map((state) => state.state_code), ["WA", "WI", "TX", "MO", "OH"]);
  assert.match(manifest.activation_policy, /^NO_STATE_PACK_MAY_ACTIVATE/);
});

test("keeps every first-wave source and release fail-closed", () => {
  for (const state of manifest.states) {
    assert.equal(state.release_status, "BLOCKED_SOURCE_VALIDATION_AND_INDEPENDENT_APPROVAL");
    assert.ok(state.official_sources.length > 0);
    for (const source of state.official_sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:");
      assert.match(source.status, /^(OFFICIAL_PUBLIC_SOURCE_IDENTIFIED|PENDING_CURRENT_BYTES_AND_SUPERSESSION_VALIDATION)$/);
    }
  }
});

test("preserves source, fixture, approval, and property-authority release gates", () => {
  for (const requirement of [
    "Exact official source bytes and SHA-256 identity",
    "Source-content validation and supersession reconciliation",
    "Page-cited deterministic rules with positive, negative, boundary, layered-program, and supersession fixtures",
    "Two-person independent compliance approval",
    "Property-specific authority, limits, and regulatory-agreement terms remain separately verified",
  ]) {
    assert.ok(manifest.shared_release_requirements.includes(requirement));
  }
});
