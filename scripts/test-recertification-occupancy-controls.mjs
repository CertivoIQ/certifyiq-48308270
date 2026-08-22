import assert from "node:assert/strict";
import test from "node:test";

import {
  RECERTIFICATION_OCCUPANCY_RULE_ID,
  evaluateRecertificationOccupancyControls,
} from "../src/lib/recertification-occupancy-controls.mjs";

const members = ["MEMBER-1", "MEMBER-2"];

function completedRecertification(overrides = {}) {
  return {
    completed_date: "2026-07-14",
    source_validated: true,
    household_roster_validated: true,
    income_calculation_validated: true,
    program_income_definition_validated: true,
    student_status_revalidated: true,
    asset_rule_revalidated: true,
    downstream_adjustment_handoff_validated: true,
    ...overrides,
  };
}

function certification(program, overrides = {}) {
  return {
    program_code: program,
    household_member_ids: members,
    cycle_start_date: "2025-07-15",
    current_recertification: completedRecertification(),
    source_validated: true,
    program_authority_validated: true,
    household_identity_validated: true,
    waiver: { claimed: false },
    ...overrides,
  };
}

function occupancy(overrides = {}) {
  return {
    minimum_set_aside: "40_60",
    current_annual_income: "60000.00",
    applicable_income_limit: "50000.00",
    unit_initially_qualified: true,
    income_calculation_validated: true,
    income_limit_validated: true,
    rent_restriction_validated: true,
    rent_restricted: true,
    building_unit_inventory_complete: true,
    available_unit_event_inventory_complete: true,
    over_income_determined_date: "2026-07-01",
    over_income_unit_bedrooms: 2,
    deep_rent_skewed: false,
    available_unit_events: [],
    ...overrides,
  };
}

function availableUnit(overrides = {}) {
  return {
    event_id: "AU-1",
    occupied_date: "2026-07-20",
    bedrooms: 1,
    was_low_income_before_vacancy: false,
    new_resident_annual_income: "45000.00",
    applicable_income_limit: "50000.00",
    source_validated: true,
    unit_size_validated: true,
    new_resident_income_validated: true,
    income_limit_validated: true,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    property_id: "PROP-59",
    building_id: "BIN-59",
    unit_id: "UNIT-59",
    household_id: "HH-59",
    household_member_ids: members,
    event_date: "2026-08-01",
    program_inventory: ["LIHTC"],
    program_certifications: [certification("LIHTC")],
    household_change_events: [],
    household_change_inventory_complete: true,
    lihtc_occupancy: occupancy(),
    property_identity_validated: true,
    building_identity_validated: true,
    unit_identity_validated: true,
    household_identity_validated: true,
    program_inventory_complete: true,
    program_authority_inventory_complete: true,
    state_finding_requested: false,
    ...overrides,
  };
}

test("an on-time LIHTC recertification with no over-income trigger passes", () => {
  const result = evaluateRecertificationOccupancyControls(input());
  assert.equal(result.finding, "PASS");
  assert.equal(result.rule_id, RECERTIFICATION_OCCUPANCY_RULE_ID);
  assert.equal(result.recertification_results[0].cycle_status, "COMPLETED_ON_TIME");
  assert.equal(result.available_unit_result.rule_status, "NOT_TRIGGERED");
  assert.equal(result.agent_approval_status, "PENDING");
});

test("a certification cycle that is not yet due remains current", () => {
  const data = input({ event_date: "2026-06-01" });
  data.program_certifications[0].current_recertification = null;
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "PASS");
  assert.equal(result.recertification_results[0].cycle_status, "NOT_YET_DUE");
});

test("a late annual recertification is a deterministic failure", () => {
  const data = input();
  data.program_certifications[0].current_recertification.completed_date = "2026-07-16";
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "FAIL");
  assert.equal(result.recertification_results[0].reason_code, "PROGRAM_RECERTIFICATION_COMPLETED_LATE");
});

test("a due annual recertification cannot be omitted", () => {
  const data = input();
  data.program_certifications[0].current_recertification = null;
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(result.blockers.some((item) => item.reason_code === "PROGRAM_RECERTIFICATION_DUE_MISSING"));
});

test("a caller-created LIHTC waiver cannot suppress recertification", () => {
  const data = input();
  data.program_certifications[0].waiver = {
    claimed: true,
    waiver_id: "CALLER-CREATED-WAIVER",
    sha256: "caller",
  };
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(result.blockers.some((item) => item.reason_code === "LIHTC_RECERTIFICATION_WAIVER_NOT_REGISTERED"));
});

test("a LIHTC waiver can never substitute for a layered HUD recertification", () => {
  const data = input();
  data.program_inventory.push("HUD_MFH_PROJECT_BASED");
  data.program_certifications[0].waiver = {
    claimed: true,
    waiver_id: "CALLER-CREATED-WAIVER",
  };
  data.program_certifications.push(
    certification("HUD_MFH_PROJECT_BASED", { current_recertification: null }),
  );
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(result.blockers.some((item) => item.program_code === "HUD_MFH_PROJECT_BASED"));
});

test("income at or below 140 percent does not trigger the available-unit rule", () => {
  const data = input();
  data.lihtc_occupancy.current_annual_income = "70000.00";
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "PASS");
  assert.equal(result.available_unit_result.rule_status, "NOT_TRIGGERED");
});

test("a compliant next available comparable unit preserves the over-income unit", () => {
  const data = input();
  data.lihtc_occupancy.current_annual_income = "70000.01";
  data.lihtc_occupancy.available_unit_events.push(availableUnit());
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "PASS");
  assert.equal(result.available_unit_result.rule_status, "TRIGGERED_COMPLIANT_OR_OPEN");
  assert.equal(result.available_unit_result.evaluated_events[0].finding, "PASS");
});

test("renting a relevant next available unit over its limit fails", () => {
  const data = input();
  data.lihtc_occupancy.current_annual_income = "70000.01";
  data.lihtc_occupancy.available_unit_events.push(
    availableUnit({ new_resident_annual_income: "50000.01" }),
  );
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "FAIL");
  assert.equal(result.available_unit_result.reason_code, "NEXT_AVAILABLE_UNIT_RULE_VIOLATION");
});

test("a larger unit is not substituted into the standard comparable-or-smaller rule", () => {
  const data = input();
  data.lihtc_occupancy.current_annual_income = "70000.01";
  data.lihtc_occupancy.available_unit_events.push(
    availableUnit({ bedrooms: 3, new_resident_annual_income: "90000.00" }),
  );
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "PASS");
  assert.equal(result.available_unit_result.evaluated_events.length, 0);
});

test("average-income over-income threshold uses the greater of 60 percent or the unit designation", () => {
  const data = input();
  data.lihtc_occupancy = occupancy({
    minimum_set_aside: "AVERAGE_INCOME",
    current_annual_income: "112000.00",
    sixty_percent_income_limit: "60000.00",
    unit_designated_income_limit: "80000.00",
    average_income_threshold_validated: true,
  });
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "PASS");
  assert.equal(result.available_unit_result.rule_status, "NOT_TRIGGERED");
});

test("average-income available-unit designation and resident limit are enforced", () => {
  const data = input();
  data.lihtc_occupancy = occupancy({
    minimum_set_aside: "AVERAGE_INCOME",
    current_annual_income: "112000.01",
    sixty_percent_income_limit: "60000.00",
    unit_designated_income_limit: "80000.00",
    average_income_threshold_validated: true,
    available_unit_events: [
      availableUnit({
        new_resident_annual_income: "70000.01",
        required_designated_income_limit: "70000.00",
        average_income_designation_validated: true,
        maximum_permitted_income_calculation_validated: true,
        project_average_after_designation: 60,
      }),
    ],
  });
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "FAIL");
  assert.equal(result.available_unit_result.reason_code, "NEXT_AVAILABLE_UNIT_RULE_VIOLATION");
});

test("deep-rent-skewed projects use the 170-percent trigger", () => {
  const data = input();
  data.lihtc_occupancy = occupancy({
    current_annual_income: "85000.00",
    deep_rent_skewed: true,
  });
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "PASS");
  assert.equal(result.available_unit_result.rule_status, "NOT_TRIGGERED");
});

test("unvalidated household-change impacts block the determination", () => {
  const data = input();
  data.household_change_events.push({
    event_id: "HC-1",
    change_date: "2026-07-20",
    resulting_household_member_ids: members,
    source_validated: true,
    identity_validated: true,
    resulting_roster_validated: true,
    program_impacts_complete: false,
  });
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(result.blockers.some((item) => item.reason_code === "HOUSEHOLD_CHANGE_EVENT_NOT_VALIDATED"));
});

test("a missed validated household-change action is a failure", () => {
  const data = input();
  data.household_change_events.push({
    event_id: "HC-2",
    change_date: "2026-07-20",
    resulting_household_member_ids: members,
    source_validated: true,
    identity_validated: true,
    resulting_roster_validated: true,
    program_impacts_complete: true,
    program_impacts: [
      {
        program_code: "LIHTC",
        authority_validated: true,
        action_requirement_validated: true,
        action_required: true,
        action_completed: false,
      },
    ],
  });
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "FAIL");
  assert.ok(result.confirmed_failure_indicators.includes("HOUSEHOLD_CHANGE:HC-2:LIHTC"));
});

test("state scope remains blocked while preserving a known federal failure", () => {
  const data = input({
    program_inventory: ["LIHTC", "STATE_HFA"],
    state_finding_requested: true,
  });
  data.lihtc_occupancy.current_annual_income = "70000.01";
  data.lihtc_occupancy.available_unit_events.push(
    availableUnit({ new_resident_annual_income: "50000.01" }),
  );
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(result.blockers.some((item) => item.reason_code === "STATE_RECERTIFICATION_PACK_NOT_VALIDATED"));
  assert.ok(result.confirmed_failure_indicators.includes("AVAILABLE_UNIT:AU-1"));
});

test("program certification inventory must match the federal layers exactly", () => {
  const data = input();
  data.program_certifications.push(certification("HOME"));
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(result.blockers.some((item) => item.reason_code === "PROGRAM_RECERTIFICATION_INVENTORY_MISMATCH"));
});

test("a malformed program certification roster fails closed", () => {
  const data = input();
  data.program_certifications[0].household_member_ids = "MEMBER-1";
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(
    result.blockers.some(
      (item) => item.reason_code === "RECERTIFICATION_HOUSEHOLD_ROSTER_INVALID",
    ),
  );
});

test("a future over-income determination date fails closed", () => {
  const data = input();
  data.lihtc_occupancy.current_annual_income = "70000.01";
  data.lihtc_occupancy.over_income_determined_date = "2026-08-02";
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(
    result.blockers.some(
      (item) => item.reason_code === "OVER_INCOME_DETERMINATION_FUTURE_DATED",
    ),
  );
});

test("a triggered standard rule requires the over-income unit bedroom count", () => {
  const data = input();
  data.lihtc_occupancy.current_annual_income = "70000.01";
  delete data.lihtc_occupancy.over_income_unit_bedrooms;
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(
    result.blockers.some(
      (item) => item.reason_code === "OVER_INCOME_UNIT_SIZE_INVALID",
    ),
  );
});

test("an average-income event requires a finite post-designation project average", () => {
  const data = input();
  data.lihtc_occupancy = occupancy({
    minimum_set_aside: "AVERAGE_INCOME",
    current_annual_income: "112000.01",
    sixty_percent_income_limit: "60000.00",
    unit_designated_income_limit: "80000.00",
    average_income_threshold_validated: true,
    available_unit_events: [
      availableUnit({
        new_resident_annual_income: "65000.00",
        required_designated_income_limit: "70000.00",
        average_income_designation_validated: true,
        maximum_permitted_income_calculation_validated: true,
      }),
    ],
  });
  const result = evaluateRecertificationOccupancyControls(data);
  assert.equal(result.finding, "UNABLE_TO_DETERMINE");
  assert.ok(
    result.blockers.some(
      (item) =>
        item.reason_code ===
        "AVERAGE_INCOME_AVAILABLE_UNIT_DESIGNATION_NOT_VALIDATED",
    ),
  );
});
