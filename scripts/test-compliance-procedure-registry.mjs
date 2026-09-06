import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
  COMPLIANCE_PROCEDURE_SCAN_MODE,
  listComplianceProcedures,
  scanRecertificationComplianceProcedures,
} from "../src/lib/compliance-procedure-registry.mjs";

const statePack = {
  id: "pa-lihtc-controlled",
  state_code: "PA",
  jurisdiction: "PA",
  status: "validated",
  approvedBy: "reviewer-2",
  effectiveFrom: "2026-01-01",
  version: "2026.1",
  validatedRuleCount: 4,
};

const trustedEventDate = {
  value: "2026-08-01",
  provenance: "SERVER_RECORD",
  sourceRecordId: "certification:trusted-123",
  sourceDocumentRef: "tic:trusted-123",
  sourceSha256: "a".repeat(64),
  humanVerified: true,
};

test("registry inventories 76 LIHTC procedures across 21 states including Nebraska", () => {
  const procedures = listComplianceProcedures();
  assert.equal(procedures.length, 76);
  assert.equal(new Set(procedures.map((procedure) => procedure.id)).size, 76);
  assert.equal(new Set(procedures.map((procedure) => procedure.jurisdiction)).size, 21);
  assert.ok(procedures.every((procedure) => procedure.program === "LIHTC"));
  assert.ok(procedures.every((procedure) => !Object.hasOwn(procedure, "evaluate")));
  const neProcedures = listComplianceProcedures({ stateCode: "NE" });
  assert.deepEqual(
    neProcedures.map((procedure) => procedure.id).sort(),
    [
      "STATE-NE-AFFORDABILITY-PERIOD-BOUNDARY",
      "STATE-NE-NONCOMPLIANCE-RESPONSE",
      "STATE-NE-QUALIFIED-CONTRACT-DECONTROL-CERTIFICATION",
    ],
  );
  const neSourceTrace = new Set(
    neProcedures.flatMap((procedure) => procedure.sourceTrace),
  );
  assert.ok(
    neSourceTrace.has(
      "https://www.nifa.org/developers-property-managers/lihtc-compliance",
    ),
  );
  assert.ok(
    neSourceTrace.has(
      "https://www.nifa.org/developers-property-managers/forms-docs",
    ),
  );
  assert.ok(
    neSourceTrace.has(
      "https://www.nifa.org/developers-property-managers/qualified-contract-toolkit",
    ),
  );
  assert.ok(
    neProcedures.every((procedure) =>
      procedure.citation.includes("https://www.nifa.org/"),
    ),
  );
});

test("non-LIHTC reviews do not select or block on state LIHTC procedures", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["HCV_TENANT_BASED"],
    stateCode: "PA",
    statePack,
    trustedEventDate,
    recertificationInput: {},
  });

  assert.equal(scan.registryBuild, COMPLIANCE_PROCEDURE_REGISTRY_BUILD);
  assert.equal(scan.mode, COMPLIANCE_PROCEDURE_SCAN_MODE.notApplicable);
  assert.equal(scan.selectedProcedureCount, 0);
  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.deepEqual(scan.findings, []);
});

test("LIHTC reviews fail closed when state jurisdiction is not trusted", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    recertificationInput: {},
  });

  assert.equal(scan.mode, COMPLIANCE_PROCEDURE_SCAN_MODE.blockerInventory);
  assert.equal(scan.selectedProcedureCount, 0);
  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.equal(scan.findings.length, 1);
  assert.ok(
    scan.findings[0].blockingReasons.includes(
      "STATE_COMPLIANCE_PROCEDURE_JURISDICTION_REQUIRED",
    ),
  );
});

test("installed procedures remain UTD without an exact validated state pack", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    stateCode: "PA",
    trustedEventDate,
    recertificationInput: {},
  });

  assert.equal(scan.selectedProcedureCount, 4);
  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.ok(
    scan.findings.every(
      (finding) =>
        finding.status === "UNABLE_TO_DETERMINE" &&
        finding.ruleEvaluationStatus === "BLOCKED" &&
        finding.inventoryOnly === true &&
        finding.blockingReasons.includes(
          "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_VALIDATED",
        ),
    ),
  );
});

test("raw event dates and raw procedure payloads cannot execute procedures", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    stateCode: "PA",
    statePack,
    eventDate: "2026-08-01",
    procedureInputs: {
      "STATE-PA-GROSS-RENT": {
        monthly_contract_rent: 900,
        tenant_paid_utility_allowance: 100,
        maximum_lihtc_gross_rent: 1000,
      },
    },
    recertificationInput: {},
  });

  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.ok(scan.findings.every((finding) => finding.status === "UNABLE_TO_DETERMINE"));
  assert.ok(
    scan.findings.every((finding) =>
      finding.blockingReasons.includes(
        "STATE_COMPLIANCE_PROCEDURE_EVENT_DATE_NOT_TRUSTED",
      ),
    ),
  );
});

test("source-bound event date alone never activates raw client procedure inputs", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    stateCode: "PA",
    statePack,
    trustedEventDate,
    procedureInputs: {
      "STATE-PA-GROSS-RENT": {
        monthly_contract_rent: 900,
        tenant_paid_utility_allowance: 100,
        maximum_lihtc_gross_rent: 1000,
      },
    },
    complianceProcedureInputs: {
      "STATE-PA-ANNUAL-RECERTIFICATION-FILE": {
        tenant_income_certification_present: true,
      },
    },
    recertificationInput: {},
  });

  assert.equal(scan.evaluationReady, false);
  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.ok(scan.findings.every((finding) => finding.status === "UNABLE_TO_DETERMINE"));
  assert.ok(
    scan.findings.every((finding) =>
      finding.blockingReasons.includes(
        "COMPLIANCE_PROCEDURE_TRUSTED_INPUT_ADAPTER_NOT_WIRED",
      ),
    ),
  );

  const descriptors = new Map(
    listComplianceProcedures({ stateCode: "PA" }).map((procedure) => [
      procedure.id,
      procedure,
    ]),
  );
  for (const finding of scan.findings) {
    const descriptor = descriptors.get(finding.procedureId);
    assert.ok(descriptor);
    assert.equal(finding.rulePackId, "compliance-procedure-blocker-inventory");
    assert.equal(
      finding.rulePackVersion,
      COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
    );
    assert.notEqual(finding.rulePackId, statePack.id);
    assert.notEqual(finding.rulePackVersion, statePack.version);
    assert.equal(finding.statePackBindingStatus, "UNBOUND");
    assert.equal(finding.effectiveDateBindingStatus, "UNBOUND");
    assert.equal(finding.procedureInventoryBuild, descriptor.engineBuild);
    assert.equal(finding.procedureEffectiveFrom, descriptor.effectiveFrom);
    assert.deepEqual(finding.procedureSourceTrace, descriptor.sourceTrace);
  }
});

test("a malformed supplied effective-to date invalidates the state pack gate", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    stateCode: "PA",
    statePack: { ...statePack, effectiveTo: "not-a-date" },
    trustedEventDate,
    recertificationInput: {},
  });

  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.ok(
    scan.findings.every((finding) =>
      finding.blockingReasons.includes(
        "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_VALIDATED",
      ),
    ),
  );
});

test("trusted event dates outside the supplied metadata window remain blocked and unbound", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    stateCode: "PA",
    statePack: { ...statePack, effectiveFrom: "2026-09-01" },
    trustedEventDate,
    recertificationInput: {},
  });

  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.ok(
    scan.findings.every(
      (finding) =>
        finding.statePackBindingStatus === "UNBOUND" &&
        finding.effectiveDateBindingStatus === "UNBOUND" &&
        finding.blockingReasons.includes(
          "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_EFFECTIVE",
        ),
    ),
  );
});

test("an unsupported LIHTC state produces one explicit inventory blocker", () => {
  const scan = scanRecertificationComplianceProcedures({
    programs: ["LIHTC"],
    stateCode: "CA",
    statePack: { ...statePack, state_code: "CA", jurisdiction: "CA" },
    trustedEventDate,
    recertificationInput: {},
  });

  assert.equal(scan.selectedProcedureCount, 0);
  assert.equal(scan.evaluatedProcedureCount, 0);
  assert.equal(scan.findings.length, 1);
  assert.ok(
    scan.findings[0].blockingReasons.includes(
      "STATE_COMPLIANCE_PROCEDURE_INVENTORY_MISSING",
    ),
  );
});
