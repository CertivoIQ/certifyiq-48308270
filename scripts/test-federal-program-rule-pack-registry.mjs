import assert from "node:assert/strict";
import test from "node:test";

import {
  FEDERAL_PROGRAM_RULE_PACKS,
  federalProgramPackGate,
} from "../src/lib/federal-program-rule-pack-registry.mjs";
import {
  evaluateCertification,
  normalizeCertificationPrograms,
} from "../src/lib/compliance-rule-engine.mjs";

const PROGRAMS = [
  "LIHTC",
  "HOME",
  "HTF",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "PUBLIC_HOUSING",
  "RURAL_DEVELOPMENT",
  "TAX_EXEMPT_BOND",
];

test("every supported federal certification program has an explicit coverage record", () => {
  assert.deepEqual(Object.keys(FEDERAL_PROGRAM_RULE_PACKS).sort(), PROGRAMS.sort());
  assert.deepEqual(normalizeCertificationPrograms(PROGRAMS), [...PROGRAMS].sort());
});

test("only LIHTC is partial; incomplete substantive packs remain blocked", () => {
  assert.equal(FEDERAL_PROGRAM_RULE_PACKS.LIHTC.activationStatus, "PARTIAL");
  for (const program of PROGRAMS.filter((value) => value !== "LIHTC")) {
    const entry = FEDERAL_PROGRAM_RULE_PACKS[program];
    assert.equal(entry.activationStatus, "BLOCKED");
    assert.ok(entry.requiredControls.length > 0);
    assert.ok(entry.officialSources.every((url) => /^https:\/\//.test(url)));
  }
});

test("HUD Multifamily records the official January 1 2027 HOTMA deadline", () => {
  const multifamily = FEDERAL_PROGRAM_RULE_PACKS.HUD_MFH_PROJECT_BASED;
  assert.equal(multifamily.mandatoryComplianceDate, "2027-01-01");
  assert.match(multifamily.citation, /Notice H 2025-07/);
  assert.ok(multifamily.officialSources.includes("https://www.hud.gov/hud-partners/multifamily-hotma"));
});

test("inactive program packs produce BLOCKED findings, never evaluated findings", () => {
  for (const program of PROGRAMS.filter((value) => value !== "LIHTC")) {
    const result = evaluateCertification({ facts: [], programs: [program] });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].status, "UNABLE_TO_DETERMINE");
    assert.equal(result.findings[0].ruleEvaluationStatus, "BLOCKED");
    assert.match(result.findings[0].blockingReasons.join(" "), /inactive pending controlled authority/);
  }
});

test("gate findings disclose the specific missing controlled authorities", () => {
  const gate = federalProgramPackGate("HCV_TENANT_BASED");
  assert.equal(gate.activationStatus, "blocked");
  assert.ok(gate.missingControls.includes("asset_enforcement_policy"));
  assert.ok(gate.missingControls.includes("real_property_restriction"));
  assert.match(gate.citation, /24 CFR 5\.618/);
});
