import assert from "node:assert/strict";
import test from "node:test";

import {
  LAYERED_RULE_ID,
  evaluateLayeredProgramRestrictions,
} from "../src/lib/layered-program-restrictions.mjs";

function projectAuthority(overrides = {}) {
  return {
    finding: "READY",
    rule_engine_authority: "ALLOWED",
    property_id: "WV-PROP-0001",
    layered_program_review_required: true,
    layered_program_rule_id: LAYERED_RULE_ID,
    authority_envelope: {
      project_authority_validated: true,
      project_authority_inventory_complete: true,
    },
    gross_rent_floor_handoff: {
      cap_outcome: "CAP_VALIDATED",
      project_maximum_gross_rent_cap: "1100.00",
    },
    ...overrides,
  };
}

function constraint(
  constraintId,
  metric,
  comparisonGroup,
  maximumAmount,
  sourceDocumentId,
  overrides = {},
) {
  return {
    constraint_id: constraintId,
    metric,
    comparison_group: comparisonGroup,
    maximum_amount: maximumAmount,
    currency: "USD",
    period: "MONTHLY",
    source_document_id: sourceDocumentId,
    citation: `Validated source for ${constraintId}`,
    source_validated: true,
    effective_for_event_date: true,
    calculation_validated: true,
    comparison_basis_validated: true,
    ...overrides,
  };
}

function requirement(
  requirementId,
  requirementType,
  status,
  sourceDocumentId,
) {
  return {
    requirement_id: requirementId,
    requirement_type: requirementType,
    status,
    source_document_id: sourceDocumentId,
    citation: `Validated source for ${requirementId}`,
    source_validated: true,
    effective_for_event_date: true,
    result_validated: true,
  };
}

function layer(
  layerId,
  programCode,
  documentType,
  documentId,
  constraints = [],
  requirements = [],
) {
  return {
    layer_id: layerId,
    program_code: programCode,
    primary_authority_document_type: documentType,
    authority_document_ids: [documentId],
    authority_citations: [`Validated authority for ${programCode}`],
    effective_start_date: "2026-06-01",
    effective_end_date: null,
    constraints,
    requirements,
    applicability_validated: true,
    authority_documents_recognized: true,
    authority_inventory_complete: true,
    primary_authority_executed_or_issued: true,
    current_rule_version_validated: true,
    effective_date_validated: true,
    unit_or_household_coverage_validated: true,
    calculation_or_determination_validated: true,
    amendments_waivers_inventory_complete: true,
  };
}

function observed(comparisonGroup, metric, amount) {
  return {
    comparison_group: comparisonGroup,
    metric,
    amount,
    currency: "USD",
    period: "MONTHLY",
    source_validated: true,
    measurement_basis_validated: true,
    event_date_match_validated: true,
    charge_inventory_complete: true,
    ...(metric === "MAXIMUM_GROSS_RENT"
      ? { rental_assistance_excluded: true }
      : {}),
  };
}

function layers() {
  return [
    layer(
      "LAYER-LIHTC",
      "LIHTC",
      "FORM_8609_LURA_AND_UNIT_DESIGNATION",
      "LIHTC-AUTHORITY-1",
      [
        constraint(
          "CAP-LIHTC-GROSS",
          "MAXIMUM_GROSS_RENT",
          "MONTHLY_UNIT_GROSS_RENT",
          "1200.00",
          "LIHTC-AUTHORITY-1",
          { rental_assistance_excluded: true },
        ),
      ],
      [
        requirement(
          "REQ-LIHTC-OCCUPANCY",
          "HOUSEHOLD_ELIGIBILITY_AND_OCCUPANCY",
          "PASS",
          "LIHTC-AUTHORITY-1",
        ),
      ],
    ),
    layer(
      "LAYER-PROJECT",
      "PROJECT_AUTHORITY",
      "RECORDED_LURA",
      "RECORDED-LURA-1",
      [
        constraint(
          "CAP-PROJECT-GROSS",
          "MAXIMUM_GROSS_RENT",
          "MONTHLY_UNIT_GROSS_RENT",
          "1100.00",
          "RECORDED-LURA-1",
        ),
      ],
    ),
    layer(
      "LAYER-HOME",
      "HOME",
      "HOME_WRITTEN_AGREEMENT",
      "HOME-AGREEMENT-1",
      [
        constraint(
          "CAP-HOME-GROSS",
          "MAXIMUM_GROSS_RENT",
          "MONTHLY_UNIT_GROSS_RENT",
          "1050.00",
          "HOME-AGREEMENT-1",
        ),
      ],
      [
        requirement(
          "REQ-HOME-OCCUPANCY",
          "HOME_INCOME_AND_OCCUPANCY",
          "PASS",
          "HOME-AGREEMENT-1",
        ),
      ],
    ),
    layer(
      "LAYER-HCV",
      "HCV_TENANT_BASED",
      "HUD_52641",
      "HUD-52641-1",
      [
        constraint(
          "CAP-HCV-RENT-TO-OWNER",
          "MAXIMUM_RENT_TO_OWNER",
          "MONTHLY_HCV_RENT_TO_OWNER",
          "1250.00",
          "HUD-52641-1",
        ),
      ],
      [
        requirement(
          "REQ-HCV-CONTRACT",
          "HAP_CONTRACT_AND_LEASE_CONSISTENCY",
          "PASS",
          "HUD-52641-1",
        ),
      ],
    ),
    layer(
      "LAYER-RD",
      "RURAL_DEVELOPMENT",
      "USDA_RD_LOAN_AND_RENT_APPROVAL",
      "USDA-RD-1",
      [
        constraint(
          "CAP-RD-BASIC-RENT",
          "MAXIMUM_BASIC_RENT",
          "MONTHLY_RD_BASIC_RENT",
          "850.00",
          "USDA-RD-1",
        ),
      ],
      [
        requirement(
          "REQ-RD-OCCUPANCY",
          "RD_TENANT_ELIGIBILITY",
          "PASS",
          "USDA-RD-1",
        ),
      ],
    ),
    layer(
      "LAYER-BOND",
      "TAX_EXEMPT_BOND",
      "TAX_EXEMPT_BOND_REGULATORY_AGREEMENT",
      "BOND-AGREEMENT-1",
      [],
      [
        requirement(
          "REQ-BOND-OCCUPANCY",
          "BOND_PROJECT_OCCUPANCY",
          "PASS",
          "BOND-AGREEMENT-1",
        ),
      ],
    ),
  ];
}

function input(overrides = {}) {
  return {
    property_id: "WV-PROP-0001",
    unit_id: "UNIT-201",
    household_id: "HH-201-2026",
    event_date: "2026-07-15",
    base_program_code: "LIHTC",
    applicable_program_codes: [
      "LIHTC",
      "PROJECT_AUTHORITY",
      "HOME",
      "HCV_TENANT_BASED",
      "RURAL_DEVELOPMENT",
      "TAX_EXEMPT_BOND",
    ],
    layers: layers(),
    observed_amounts: [
      observed("MONTHLY_UNIT_GROSS_RENT", "MAXIMUM_GROSS_RENT", "1040.00"),
      observed(
        "MONTHLY_HCV_RENT_TO_OWNER",
        "MAXIMUM_RENT_TO_OWNER",
        "1220.00",
      ),
      observed("MONTHLY_RD_BASIC_RENT", "MAXIMUM_BASIC_RENT", "800.00"),
    ],
    project_authority_result: projectAuthority(),
    unit_identity_validated: true,
    household_identity_validated: true,
    program_inventory_complete: true,
    program_inventory_sources_validated: true,
    funding_sources_reconciled: true,
    assistance_sources_reconciled: true,
    unit_program_designations_validated: true,
    state_finding_requested: false,
    state_rulepack_validated: false,
    state_authority_source_validated: false,
    ...overrides,
  };
}

test("comparable gross-rent caps reconcile while unlike metrics remain separate", () => {
  const result = evaluateLayeredProgramRestrictions(input());
  assert.equal(result.finding, "PASS");
  assert.equal(result.rule_engine_authority, "ALLOWED");
  assert.equal(result.rule_id, LAYERED_RULE_ID);
  assert.equal(result.human_approval_status, "PENDING");
  assert.equal(result.tax_exempt_bond_constraint_inference_performed, false);
  assert.equal(result.tax_exempt_bond_monetary_constraint_count, 0);

  const groups = Object.fromEntries(
    result.monetary_comparison_groups.map((group) => [group.comparison_group, group]),
  );
  assert.deepEqual(Object.keys(groups).sort(), [
    "MONTHLY_HCV_RENT_TO_OWNER",
    "MONTHLY_RD_BASIC_RENT",
    "MONTHLY_UNIT_GROSS_RENT",
  ]);
  assert.equal(
    groups.MONTHLY_UNIT_GROSS_RENT.controlling_maximum_amount,
    "1050.00",
  );
  assert.deepEqual(groups.MONTHLY_UNIT_GROSS_RENT.controlling_program_codes, [
    "HOME",
  ]);
  assert.equal(
    groups.MONTHLY_HCV_RENT_TO_OWNER.metric,
    "MAXIMUM_RENT_TO_OWNER",
  );
  assert.equal(groups.MONTHLY_RD_BASIC_RENT.metric, "MAXIMUM_BASIC_RENT");
});

test("the lowest comparable cap fails without collapsing HCV or RD metrics", () => {
  const data = input();
  data.observed_amounts[0].amount = "1060.00";
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "FAIL");
  assert.ok(
    result.confirmed_failure_indicators.includes(
      "RENT_GROUP:MONTHLY_UNIT_GROSS_RENT",
    ),
  );
  const byProgram = Object.fromEntries(
    result.layer_results.map((layerResult) => [
      layerResult.program_code,
      layerResult.finding,
    ]),
  );
  assert.equal(byProgram.HOME, "FAIL");
  assert.equal(byProgram.LIHTC, "PASS");
  assert.equal(byProgram.PROJECT_AUTHORITY, "PASS");
  assert.equal(byProgram.HCV_TENANT_BASED, "PASS");
});

test("tenant-based HAP assistance cannot cure an LIHTC gross-rent failure", () => {
  const data = input();
  data.layers[0].constraints[0].maximum_amount = "1000.00";
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "FAIL");
  assert.equal(result.hap_assistance_does_not_cure_lihtc_noncompliance, true);
  const byProgram = Object.fromEntries(
    result.layer_results.map((layerResult) => [
      layerResult.program_code,
      layerResult.finding,
    ]),
  );
  assert.equal(byProgram.LIHTC, "FAIL");
  assert.equal(byProgram.HCV_TENANT_BASED, "PASS");
});

test("HUD-52641 cannot be routed to the PBV branch", () => {
  const data = input();
  data.layers[3].program_code = "HUD_PBV";
  data.applicable_program_codes[3] = "HUD_PBV";
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "HAP_DOCUMENT_PROGRAM_BRANCH_CONFLICT");
});

test("an unresolved requirement blocks and preserves known failures", () => {
  const data = input();
  data.observed_amounts[0].amount = "1300.00";
  data.layers[5].requirements[0].status = "NOT_DETERMINED";
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.rule_engine_authority, "BLOCKED");
  assert.equal(
    result.reason_code,
    "LAYERED_PROGRAM_REQUIREMENT_NOT_DETERMINED",
  );
  assert.ok(
    result.confirmed_failure_indicators.includes(
      "RENT_GROUP:MONTHLY_UNIT_GROSS_RENT",
    ),
  );
});

test("the recorded project cap must survive the upstream handoff unchanged", () => {
  const data = input();
  data.layers[1].constraints[0].maximum_amount = "1099.00";
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "PROJECT_AUTHORITY_CAP_NOT_RECONCILED");
});

test("unlike monetary metrics cannot share a comparison group", () => {
  const data = input();
  data.layers[3].constraints[0].comparison_group = "MONTHLY_UNIT_GROSS_RENT";
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "NONCOMPARABLE_CONSTRAINTS_SHARE_GROUP");
});

test("a state finding remains blocked without an active validated state pack", () => {
  const result = evaluateLayeredProgramRestrictions(
    input({ state_finding_requested: true }),
  );
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "LAYERED_PROGRAM_SCOPE_NOT_VALIDATED");
  assert.ok(result.missing_inputs.includes("state_rulepack"));
});

test("caller booleans cannot bypass the validated state-pack gate", () => {
  const result = evaluateLayeredProgramRestrictions(
    input({
      state_finding_requested: true,
      state_rulepack_validated: true,
      state_authority_source_validated: true,
    }),
  );
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(result.reason_code, "LAYERED_PROGRAM_SCOPE_NOT_VALIDATED");
  assert.ok(result.missing_inputs.includes("state_rulepack"));
});

test("an actual approved and versioned state-pack record opens state scope", () => {
  const result = evaluateLayeredProgramRestrictions(
    input({
      state_finding_requested: true,
      state_rulepack: {
        status: "validated",
        approvedBy: "Compliance Officer",
        effectiveFrom: "2026-06-01",
        version: "2026.08.1",
        validatedRuleCount: 1,
      },
    }),
  );
  assert.equal(result.finding, "PASS");
  assert.equal(result.authority_scope, "STATE_PROJECT_AND_FEDERAL");
});

test("LIHTC rental-assistance exclusion must be validated on observed rent", () => {
  const data = input();
  delete data.observed_amounts[0].rental_assistance_excluded;
  const result = evaluateLayeredProgramRestrictions(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.equal(
    result.reason_code,
    "LIHTC_RENTAL_ASSISTANCE_TREATMENT_NOT_VALIDATED",
  );
});

test("project authority requires a validated cap or explicit validated no-cap", () => {
  const missing = input();
  delete missing.project_authority_result.gross_rent_floor_handoff;
  const blocked = evaluateLayeredProgramRestrictions(missing);
  assert.equal(blocked.finding, "UNABLE_TO_DETERMINE");
  assert.equal(blocked.reason_code, "PROJECT_AUTHORITY_HANDOFF_NOT_VALIDATED");

  const noCap = input();
  noCap.project_authority_result.gross_rent_floor_handoff = {
    cap_outcome: "NO_CAP_VALIDATED",
    project_maximum_gross_rent_cap: null,
  };
  const allowed = evaluateLayeredProgramRestrictions(noCap);
  assert.equal(allowed.finding, "PASS");
});
