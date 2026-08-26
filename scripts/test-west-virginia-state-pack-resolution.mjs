import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resolution = JSON.parse(
  await readFile(new URL("../src/lib/west-virginia-state-pack-resolution.json", import.meta.url), "utf8"),
);

test("two-person approval attestation does not remove objective release gates", () => {
  assert.equal(resolution.approval_receipts_required_for_execution, false);
  assert.equal(
    resolution.approval_basis,
    "TWO_PERSON_HUMAN_APPROVAL_ATTESTED_OUTSIDE_RECEIPT_STORE",
  );
  assert.equal(resolution.release_status, "BLOCKED_PENDING_OBJECTIVE_SOURCE_AND_RULE_GATES");
  assert.ok(resolution.remaining_release_gates.includes("RAW_FORMS_INDEX_HASH"));
  assert.ok(resolution.remaining_release_gates.includes("CAPTURED_SOURCE_CONTENT_VALIDATION"));
  assert.ok(resolution.remaining_release_gates.includes("PAGE_LEVEL_RULE_CITATIONS"));
  assert.ok(resolution.remaining_release_gates.includes("DETERMINISTIC_RULE_FIXTURES"));
});

test("later official WVHDF sources supersede conflicting older manual language", () => {
  const byId = new Map(resolution.conflicts.map((item) => [item.conflict_id, item]));
  assert.equal(byId.get("WV-CURRENCY-001").status, "RESOLVED_WITH_SCOPE");
  assert.equal(byId.get("WV-RECERT-WAIVER-001").status, "RESOLVED");
  assert.equal(
    byId.get("WV-RECERT-WAIVER-001").rule_authority_effect,
    "USE_2019_PLUS_WAIVER_PROCEDURE_WHEN_APPLICABLE",
  );
});

test("owner certification form anomaly cannot create governing authority", () => {
  const item = resolution.conflicts.find((entry) => entry.conflict_id === "WV-OWNER-CERT-ISSUER-001");
  assert.equal(item.status, "RESOLVED_AS_NON_RULE_AUTHORITY");
  assert.equal(item.rule_authority_effect, "FORM_DOES_NOT_DEFINE_AUTHORITY");
});

test("HOME and HTF currency remains isolated from the LIHTC-only release", () => {
  const item = resolution.conflicts.find((entry) => entry.conflict_id === "WV-HOME-CURRENCY-001");
  assert.equal(item.status, "OUT_OF_LIHTC_RELEASE_SCOPE");
  assert.equal(item.rule_authority_effect, "BLOCK_HOME_HTF_ONLY");
});

test("unindexed updates never silently alter the active authority set", () => {
  const item = resolution.conflicts.find((entry) => entry.conflict_id === "WV-UNINDEXED-UPDATE-001");
  assert.equal(item.status, "RESOLVED_FAIL_CLOSED");
  assert.equal(
    item.rule_authority_effect,
    "IGNORE_UNVERIFIED_UPDATE_AND_CONTINUE_MONITORING",
  );
});
