import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batch = JSON.parse(
  await readFile(
    new URL("../src/lib/ri-pr-pa-or-state-pack-candidates.json", import.meta.url),
    "utf8",
  ),
);

test("Test 93 covers the next four reverse-alphabetical jurisdictions", () => {
  assert.equal(batch.test_id, 93);
  assert.deepEqual(
    batch.jurisdictions.map((jurisdiction) => jurisdiction.state_code),
    ["RI", "PR", "PA", "OR"],
  );
  assert.equal(
    new Set(batch.jurisdictions.map((jurisdiction) => jurisdiction.state_code))
      .size,
    4,
  );
});

test("all sources stay on each jurisdiction's official domain", () => {
  for (const jurisdiction of batch.jurisdictions) {
    assert.equal(
      new URL(jurisdiction.source_page).hostname.replace(/^www\./, ""),
      jurisdiction.official_domain,
    );
    for (const source of jurisdiction.sources) {
      assert.equal(
        new URL(source.observed_url).hostname.replace(/^www\./, ""),
        jurisdiction.official_domain,
      );
      assert.ok(!("sha256" in source));
      assert.match(source.status, /^OFFICIAL_/);
    }
  }
});

test("records exact PDF links and page observations without claiming byte identity", () => {
  const pdfSources = batch.jurisdictions.flatMap((jurisdiction) =>
    jurisdiction.sources.filter((source) => "observed_page_count" in source),
  );
  assert.equal(pdfSources.length, 7);
  assert.ok(
    pdfSources.every(
      (source) =>
        Number.isInteger(source.observed_page_count) &&
        source.observed_page_count > 0,
    ),
  );
  assert.match(batch.release_status, /^BLOCKED_/);
});

test("preserves jurisdiction-specific currency and authority conflicts", () => {
  const byCode = Object.fromEntries(
    batch.jurisdictions.map((jurisdiction) => [
      jurisdiction.state_code,
      jurisdiction,
    ]),
  );
  assert.ok(
    byCode.RI.blocking_conflicts.some((conflict) =>
      conflict.includes("58 percent Average Income Test"),
    ),
  );
  assert.ok(
    byCode.PR.blocking_conflicts.some((conflict) =>
      conflict.includes("no adopted 2026 QAP"),
    ),
  );
  assert.ok(
    byCode.PA.blocking_conflicts.some((conflict) =>
      conflict.includes("cannot be substituted"),
    ),
  );
  assert.ok(
    byCode.OR.blocking_conflicts.some((conflict) =>
      conflict.includes("2025 QAP"),
    ),
  );
});

test("keeps property records outside the shared pack", () => {
  for (const excluded of [
    "completed tenant records",
    "property Form 8609",
    "LURA or declaration",
    "HAP contract",
    "property utility schedule",
  ]) {
    assert.ok(batch.shared_pack_excludes.includes(excluded));
  }
});

test("keeps every jurisdiction fail-closed and VP-gated", () => {
  assert.equal(
    batch.enterprise_activation_requires,
    "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION",
  );
  assert.ok(
    batch.jurisdictions.every(
      (jurisdiction) =>
        jurisdiction.blocking_conflicts.length >= 3 &&
        jurisdiction.sources.length >= 3,
    ),
  );
  assert.ok(
    batch.property_figure_verification_scope.includes(
      "HUD-confirmed geography, household size, income and rent limits",
    ),
  );
  assert.ok(
    batch.activation_requirements.includes(
      "enterprise VP Compliance property-figure verification at onboarding",
    ),
  );
});
