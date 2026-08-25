import assert from "node:assert/strict";
import test from "node:test";

import {
  FEDERAL_JURISDICTION_DIRECTORY,
  FEDERAL_PROGRAM_RULE_PACKS,
  STATE_PROGRAM_OVERLAYS,
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

test("program pages are guidance and controlling authorities are separately recorded", () => {
  for (const entry of Object.values(FEDERAL_PROGRAM_RULE_PACKS)) {
    assert.ok(Array.isArray(entry.sourceHierarchy.programGuidance));
    assert.ok(entry.sourceHierarchy.controllingLaw.length > 0);
    assert.ok(entry.sourceHierarchy.controllingLaw.every((url) => /^https:\/\//.test(url)));
  }
  assert.ok(
    FEDERAL_PROGRAM_RULE_PACKS.HOME.sourceHierarchy.programGuidance.includes(
      "https://www.hudexchange.info/programs/home/",
    ),
  );
  assert.ok(
    FEDERAL_PROGRAM_RULE_PACKS.HTF.sourceHierarchy.programGuidance.includes(
      "https://www.hudexchange.info/programs/htf/",
    ),
  );
  assert.ok(
    FEDERAL_PROGRAM_RULE_PACKS.TAX_EXEMPT_BOND.sourceHierarchy.controllingLaw.some(
      (url) => url.includes("title26-section142"),
    ),
  );
});

test("HUD state directory and California CDLAC cannot act as federal rule authority", () => {
  assert.equal(FEDERAL_JURISDICTION_DIRECTORY.role, "JURISDICTION_DISCOVERY_ONLY");
  assert.equal(FEDERAL_JURISDICTION_DIRECTORY.complianceRuleAuthority, false);
  assert.equal(FEDERAL_JURISDICTION_DIRECTORY.url, "https://www.hud.gov/states/");

  const cdlac = STATE_PROGRAM_OVERLAYS.CA_TAX_EXEMPT_BOND_CDLAC;
  assert.equal(cdlac.jurisdiction, "CA");
  assert.equal(cdlac.program, "TAX_EXEMPT_BOND");
  assert.equal(cdlac.federalBaselineAuthority, false);
  assert.equal(cdlac.url, "https://www.treasurer.ca.gov/cdlac");
});

test("HOME and HTF retain a verified, non-activated rule inventory", () => {
  const homeRules = FEDERAL_PROGRAM_RULE_PACKS.HOME.verifiedRules;
  const htfRules = FEDERAL_PROGRAM_RULE_PACKS.HTF.verifiedRules;
  assert.deepEqual(
    homeRules.map((rule) => rule.id),
    [
      "HOME-INCOME-DETERMINATION",
      "HOME-RENT-LIMIT",
      "HOME-AFFORDABILITY-PERIOD",
      "HOME-LEASE-AND-TENANT-PROTECTIONS",
    ],
  );
  assert.deepEqual(
    htfRules.map((rule) => rule.id),
    [
      "HTF-INCOME-DETERMINATION",
      "HTF-RENT-LIMIT",
      "HTF-AFFORDABILITY-PERIOD",
      "HTF-ANNUAL-INCOME-REEXAMINATION",
      "HTF-LEASE-AND-TENANT-PROTECTIONS",
    ],
  );
  assert.ok(homeRules.every((rule) => rule.evidenceFields.length > 0));
  assert.ok(htfRules.every((rule) => rule.evidenceFields.length > 0));
  assert.ok(Object.isFrozen(homeRules[0].evidenceFields));
});

test("HCV, PBV, Public Housing, and Multifamily rules preserve program-specific policy boundaries", () => {
  const hcv = FEDERAL_PROGRAM_RULE_PACKS.HCV_TENANT_BASED;
  const pbv = FEDERAL_PROGRAM_RULE_PACKS.HUD_PBV;
  const publicHousing = FEDERAL_PROGRAM_RULE_PACKS.PUBLIC_HOUSING;
  const multifamily = FEDERAL_PROGRAM_RULE_PACKS.HUD_MFH_PROJECT_BASED;

  assert.equal(hcv.verifiedRules.length, 3);
  assert.ok(
    hcv.verifiedRules
      .find((rule) => rule.id === "HCV-ASSET-RESTRICTION-AND-POLICY")
      .evidenceFields.includes("pha_asset_enforcement_policy"),
  );
  assert.ok(
    hcv.sourceHierarchy.controllingLaw.some((url) => url.endsWith("/part-982")),
  );

  assert.equal(pbv.verifiedRules.length, 5);
  assert.ok(pbv.verifiedRules.some((rule) => rule.id === "PBV-CONTRACT-UNIT-ELIGIBILITY"));
  assert.ok(pbv.verifiedRules.some((rule) => rule.id === "PBV-REASONABLE-RENT"));

  assert.equal(publicHousing.verifiedRules.length, 4);
  assert.ok(
    publicHousing.verifiedRules
      .find((rule) => rule.id === "PUBLIC-HOUSING-OVER-INCOME-PERIOD")
      .evidenceFields.includes("over_income_start_date"),
  );

  assert.equal(multifamily.verifiedRules.length, 3);
  assert.ok(
    multifamily.verifiedRules.every((rule) =>
      rule.evidenceFields.includes("mfh_program_subtype"),
    ),
  );
  assert.match(multifamily.verifiedRules[2].requirement, /not to listed PRAC\/PRA\/PAC\/SPRAC/);
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

test("gate findings disclose verified rules and missing controlled authorities", () => {
  const homeGate = federalProgramPackGate("HOME");
  assert.equal(homeGate.activationStatus, "blocked");
  assert.equal(homeGate.verifiedRules.length, 4);
  assert.ok(homeGate.missingControls.includes("controlled_home_income_limit_receipt"));

  const hcvGate = federalProgramPackGate("HCV_TENANT_BASED");
  assert.ok(hcvGate.missingControls.includes("asset_enforcement_policy"));
  assert.ok(hcvGate.missingControls.includes("real_property_restriction"));
  assert.match(hcvGate.citation, /24 CFR 5\.618/);
});
