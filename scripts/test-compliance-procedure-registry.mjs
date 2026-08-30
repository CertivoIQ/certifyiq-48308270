import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPLIANCE_PROCEDURE_REGISTRY_BUILD,
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

test("registry separates every installed state rule into an auditable procedure", () => {
  const procedures = listComplianceProcedures();
  assert.equal(procedures.length, 73);
  assert.equal(new Set(procedures.map((procedure) => procedure.id)).size, 73);
  assert.ok(procedures.every((procedure) => !Object.hasOwn(procedure, "evaluate")));
  assert.deepEqual(
    listComplianceProcedures({ stateCode: "PA" }).map((procedure) => procedure.id),
    [
      "STATE-PA-ANNUAL-RECERTIFICATION-FILE",
      "STATE-PA-GROSS-RENT",
      "STATE-PA-MINIMUM-SET-ASIDE-ELECTION",
      "STATE-PA-UTILITY-ALLOWANCE-AUTHORITY",
    ],
  );
});

test("state procedures remain blocked without an exact validated state pack", () => {
  const scan = scanRecertificationComplianceProcedures({
    stateCode: "PA",
    eventDate: "2026-08-01",
    recertificationInput: {},
  });

  assert.equal(scan.registryBuild, COMPLIANCE_PROCEDURE_REGISTRY_BUILD);
  assert.equal(scan.selectedProcedureCount, 4);
  assert.ok(
    scan.findings.every(
      (finding) =>
        finding.status === "UNABLE_TO_DETERMINE" &&
        finding.ruleEvaluationStatus === "BLOCKED" &&
        finding.blockingReasons.includes(
          "STATE_COMPLIANCE_PROCEDURE_PACK_NOT_VALIDATED",
        ),
    ),
  );
});

test("validated procedure inputs execute separately during recertification scans", () => {
  const scan = scanRecertificationComplianceProcedures({
    stateCode: "PA",
    statePack,
    eventDate: "2026-08-01",
    recertificationInput: {},
    procedureInputs: {
      "STATE-PA-ANNUAL-RECERTIFICATION-FILE": {
        tenant_income_certification_present: true,
        income_verification_present: true,
        asset_verification_present: true,
        student_status_reviewed: true,
      },
      "STATE-PA-GROSS-RENT": {
        monthly_contract_rent: 900,
        tenant_paid_utility_allowance: 100,
        maximum_lihtc_gross_rent: 1000,
      },
      "STATE-PA-MINIMUM-SET-ASIDE-ELECTION": {
        form_8609_election: "40_60",
        proposed_election: "40_60",
      },
      "STATE-PA-UTILITY-ALLOWANCE-AUTHORITY": {
        building_assistance_type: "HUD_PROJECT_BASED",
        utility_allowance_method: "HUD",
      },
    },
  });

  assert.equal(scan.evaluatedProcedureCount, 4);
  assert.ok(scan.findings.every((finding) => finding.status === "PASS"));
  assert.ok(scan.findings.every((finding) => finding.humanApprovalRequired));
});

test("one procedure cannot borrow another procedure's inputs", () => {
  const scan = scanRecertificationComplianceProcedures({
    stateCode: "PA",
    statePack,
    eventDate: "2026-08-01",
    recertificationInput: {},
    procedureInputs: {
      "STATE-PA-GROSS-RENT": {
        monthly_contract_rent: 900,
        tenant_paid_utility_allowance: 100,
        maximum_lihtc_gross_rent: 1000,
      },
    },
  });

  assert.equal(scan.evaluatedProcedureCount, 1);
  assert.equal(
    scan.findings.find((finding) => finding.procedureId === "STATE-PA-GROSS-RENT")
      .status,
    "PASS",
  );
  assert.equal(
    scan.findings.find(
      (finding) =>
        finding.procedureId === "STATE-PA-ANNUAL-RECERTIFICATION-FILE",
    ).status,
    "UNABLE_TO_DETERMINE",
  );
});
