import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batch = JSON.parse(await readFile(new URL("../src/lib/ok-oh-mp-nd-state-pack-candidates.json", import.meta.url), "utf8"));

test("Test 94 covers the next four reverse-alphabetical jurisdictions", () => {
  assert.equal(batch.test_id, 94);
  assert.deepEqual(batch.jurisdictions.map(({ state_code }) => state_code), ["OK", "OH", "MP", "ND"]);
  assert.equal(new Set(batch.jurisdictions.map(({ state_code }) => state_code)).size, 4);
});

test("all sources stay on each jurisdiction's official domain without invented hashes", () => {
  for (const jurisdiction of batch.jurisdictions) {
    assert.equal(new URL(jurisdiction.source_page).hostname.replace(/^www\./, ""), jurisdiction.official_domain);
    for (const source of jurisdiction.sources) {
      assert.equal(new URL(source.observed_url).hostname.replace(/^www\./, ""), jurisdiction.official_domain);
      assert.ok(!("sha256" in source));
      assert.match(source.status, /^OFFICIAL_/);
    }
  }
});

test("records the two verified PDF page observations", () => {
  const pdfs = batch.jurisdictions.flatMap(({ sources }) => sources.filter((source) => "observed_page_count" in source));
  assert.deepEqual(pdfs.map(({ observed_page_count }) => observed_page_count), [24, 20]);
});

test("preserves jurisdiction-specific authority conflicts", () => {
  const byCode = Object.fromEntries(batch.jurisdictions.map((item) => [item.state_code, item]));
  assert.ok(byCode.OK.blocking_conflicts.some((item) => item.includes("2027 draft")));
  assert.ok(byCode.OH.blocking_conflicts.some((item) => item.includes("not LIHTC authority")));
  assert.ok(byCode.MP.blocking_conflicts.some((item) => item.includes("DRAFT")));
  assert.ok(byCode.ND.blocking_conflicts.some((item) => item.includes("past allocation plans")));
});

test("keeps property records outside the shared pack", () => {
  for (const excluded of ["completed tenant records", "property Form 8609", "LURA or declaration", "HAP contract", "property utility schedule"]) {
    assert.ok(batch.shared_pack_excludes.includes(excluded));
  }
});

test("keeps every jurisdiction fail-closed and VP-gated", () => {
  assert.match(batch.release_status, /^BLOCKED_/);
  assert.equal(batch.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(batch.jurisdictions.every(({ blocking_conflicts, sources }) => blocking_conflicts.length >= 3 && sources.length >= 3));
  assert.ok(batch.activation_requirements.includes("enterprise VP Compliance property-figure verification at onboarding"));
});
