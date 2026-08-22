import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidate = JSON.parse(await readFile(new URL("../src/lib/utah-state-pack-candidate.json", import.meta.url), "utf8"));

test("Test 88 records Utah official-site unavailability without inventing sources", () => {
  assert.equal(candidate.test_id, 88);
  assert.equal(candidate.source_capture.exact_binary_count, 0);
  assert.equal(candidate.source_capture.http_result, "NAVIGATION_TIMEOUT");
  assert.equal(candidate.source_capture.https_result, "502_BAD_GATEWAY_CONNECTION_REFUSED");
  assert.deepEqual(candidate.official_link_candidates, []);
});

test("does not create unverified Utah source identities", () => {
  assert.ok(!("sha256" in candidate.source_capture));
  assert.ok(!candidate.activation_requirements.some((requirement) => /guess|unofficial/i.test(requirement)));
  assert.equal(new URL(candidate.source_capture.https_url).hostname.replace(/^www\./, ""), candidate.agency.official_domain);
});

test("keeps Utah blocked on all missing operational authorities", () => {
  assert.match(candidate.release_status, /^BLOCKED_/);
  assert.deepEqual(new Set(candidate.blocking_conflicts.map((conflict) => conflict.conflict_id)), new Set(["UT-SITE-AVAILABILITY-001","UT-CURRENT-QAP-001","UT-COMPLIANCE-DOCUMENTS-001","UT-LIMITS-001"]));
  assert.ok(candidate.blocking_conflicts.every((conflict) => conflict.status === "UNRESOLVED"));
});

test("requires VP Compliance property verification and preserves enterprise records", () => {
  assert.equal(candidate.enterprise_activation_requires, "VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");
  assert.ok(candidate.property_figure_verification_scope.includes("HUD-confirmed income and rent limits"));
  assert.match(candidate.enterprise_boundary, /Completed tenant files/);
  assert.match(candidate.enterprise_boundary, /enterprise\/property records/);
});
