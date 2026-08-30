import assert from "node:assert/strict";
import test from "node:test";

import {
  STATE_COMPLIANCE_MANUAL_INDEX_VERSION,
  STATE_RULE_GUIDE_CATEGORIES,
  gateStateComplianceRuleGuide,
  getStateComplianceRuleGuide,
  listStateComplianceManualSources,
} from "../src/lib/state-compliance-rule-guide-registry.mjs";
import { scanRecertificationComplianceProcedures } from "../src/lib/compliance-procedure-registry.mjs";

test("manual index covers every state exactly once and remains fail-closed", () => {
  const sources = listStateComplianceManualSources();
  assert.equal(sources.length, 50);
  assert.equal(new Set(sources.map((source) => source.code)).size, 50);
  assert.ok(sources.every((source) => source.activationAllowed === false));
  assert.ok(sources.every((source) => /^https:\/\//.test(source.url)));
});

test("each state receives the same controlled procedure taxonomy", () => {
  const guide = getStateComplianceRuleGuide("co");
  assert.equal(guide.jurisdiction, "CO");
  assert.equal(guide.manualIndexVersion, STATE_COMPLIANCE_MANUAL_INDEX_VERSION);
  assert.deepEqual(guide.procedureCategories, STATE_RULE_GUIDE_CATEGORIES);
  assert.equal(guide.status, "pending final review");
  assert.equal(guide.activationAllowed, false);
});

test("a source candidate cannot be activated without final page review", () => {
  const gate = gateStateComplianceRuleGuide(
    {
      status: "validated",
      jurisdiction: "CO",
      manualIndexVersion: STATE_COMPLIANCE_MANUAL_INDEX_VERSION,
      sourceSha256: "a".repeat(64),
      effectiveFrom: "2026-01-01",
      validatedRuleCount: 1,
      pageCitations: [{ documentId: "co-manual", page: 12 }],
      approval: { signature: "Responsible Party", position: "Compliance Director" },
    },
    "CO",
    "2026-08-30",
  );
  assert.equal(gate.allowed, false);
  assert.equal(gate.reasonCode, "STATE_COMPLIANCE_RULE_GUIDE_PENDING_FINAL_REVIEW");
  assert.match(gate.reason, /pending final review/i);
});

test("recertification scans carry the state rule guide even before procedures exist", () => {
  const scan = scanRecertificationComplianceProcedures({
    stateCode: "AL",
    eventDate: "2026-08-30",
    recertificationInput: {},
  });
  assert.equal(scan.stateRuleGuide.jurisdiction, "AL");
  assert.equal(scan.stateRuleGuide.status, "pending final review");
  assert.equal(scan.findings[0].status, "UNABLE_TO_DETERMINE");
  assert.match(scan.findings[0].citation, /ahfa\.com/);
});
