/**
 * Deterministic Test #59 recertification and LIHTC occupancy controls.
 *
 * The engine evaluates annual program recertification cycles, household-change
 * handoffs, and the IRC 42 next-available-unit rule. It never treats a LIHTC
 * waiver as a waiver of another housing program and fails closed for state or
 * local rules until a controlled state pack is activated.
 */

export const RECERTIFICATION_OCCUPANCY_RULE_ID =
  "FED-RECERTIFICATION-OCCUPANCY-CONTROLS-001";
export const RECERTIFICATION_OCCUPANCY_ENGINE_BUILD =
  "recertification-occupancy-engine-2026.08.1";

const PROGRAM_CODES = new Set([
  "LIHTC",
  "HOME",
  "HTF",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "RURAL_DEVELOPMENT",
  "TAX_EXEMPT_BOND",
  "STATE_HFA",
  "LOCAL_PROGRAM",
]);

const STATE_PROGRAMS = new Set(["STATE_HFA", "LOCAL_PROGRAM"]);
const FEDERAL_ANNUAL_PROGRAMS = new Set([
  "LIHTC",
  "HOME",
  "HTF",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "RURAL_DEVELOPMENT",
  "TAX_EXEMPT_BOND",
]);

const APPROVED_LIHTC_RECERTIFICATION_WAIVERS = Object.freeze({});

function uniqueSorted(values = []) {
  return [...new Set(values.map(String))].sort();
}

function blocked(code, reason, missing = [], details = {}) {
  return {
    finding: "NOT_DETERMINED",
    reason_code: code,
    reason,
    missing_inputs: uniqueSorted(missing),
    ...details,
  };
}

function parseIsoDate(value, field) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a real calendar date`);
  }
  return text;
}

function addCalendarYear(value) {
  const text = parseIsoDate(value, "certification_date");
  const [year, month, day] = text.split("-").map(Number);
  const candidate = new Date(Date.UTC(year + 1, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) {
    return `${year + 1}-${String(month).padStart(2, "0")}-${String(
      new Date(Date.UTC(year + 1, month, 0)).getUTCDate(),
    ).padStart(2, "0")}`;
  }
  return candidate.toISOString().slice(0, 10);
}

function moneyToCents(value, field) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`${field} must be a non-negative decimal amount`);
  }
  const [whole, fraction = ""] = text.split(".");
  const padded = `${fraction}000`;
  let cents = BigInt(whole) * 100n + BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  return cents;
}

function formatCents(value) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function sameRoster(left, right) {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
}

function validateWaiver(waiver, eventDate, buildingId) {
  if (waiver?.claimed !== true) return { claimed: false };
  const waiverId = String(waiver.waiver_id ?? "");
  const approved = APPROVED_LIHTC_RECERTIFICATION_WAIVERS[waiverId];
  if (!approved || approved.active !== true) {
    return blocked(
      "LIHTC_RECERTIFICATION_WAIVER_NOT_REGISTERED",
      "A claimed LIHTC annual-recertification waiver must match an active controlled waiver release.",
      ["lihtc_recertification_waiver.waiver_id"],
    );
  }

  const mismatches = [];
  if (String(waiver.sha256) !== String(approved.sha256)) mismatches.push("sha256");
  if (String(waiver.building_id) !== String(buildingId)) mismatches.push("building_id");
  if (String(waiver.building_id) !== String(approved.building_id)) mismatches.push("approved_building_id");
  if (String(waiver.issuer) !== String(approved.issuer)) mismatches.push("issuer");
  if (waiver.entire_building_low_income_validated !== true) {
    mismatches.push("entire_building_low_income_validated");
  }
  if (waiver.other_program_requirements_cleared !== true) {
    mismatches.push("other_program_requirements_cleared");
  }
  let effectiveFrom;
  let effectiveTo;
  try {
    effectiveFrom = parseIsoDate(approved.effective_from, "approved_waiver.effective_from");
    effectiveTo = approved.effective_to
      ? parseIsoDate(approved.effective_to, "approved_waiver.effective_to")
      : null;
  } catch (error) {
    return blocked("LIHTC_RECERTIFICATION_WAIVER_DATE_INVALID", error.message);
  }
  if (eventDate < effectiveFrom || (effectiveTo && eventDate > effectiveTo)) {
    mismatches.push("event_date_coverage");
  }
  if (mismatches.length) {
    return blocked(
      "LIHTC_RECERTIFICATION_WAIVER_IDENTITY_CONFLICT",
      "The waiver does not match the approved building, issuer, hash, scope, or effective period.",
      mismatches,
    );
  }
  return { claimed: true, approved: true, waiver_id: waiverId };
}

function evaluateRecertification(program, record, input, eventDate) {
  if (!record) {
    return blocked(
      "PROGRAM_RECERTIFICATION_RECORD_MISSING",
      "Every applicable federal program requires a controlled certification-cycle record.",
      [program],
      { program_code: program },
    );
  }
  const prefix = `program_certifications.${program}`;
  if (
    record.source_validated !== true ||
    record.program_authority_validated !== true ||
    record.household_identity_validated !== true
  ) {
    return blocked(
      "PROGRAM_RECERTIFICATION_CYCLE_NOT_VALIDATED",
      "The program certification cycle requires validated source, authority, and household identity.",
      [prefix],
      { program_code: program },
    );
  }
  if (!sameRoster(record.household_member_ids, input.household_member_ids)) {
    return blocked(
      "RECERTIFICATION_HOUSEHOLD_ROSTER_CONFLICT",
      "The program certification cycle used a different household roster.",
      [`${prefix}.household_member_ids`],
      { program_code: program },
    );
  }

  if (program === "LIHTC" && record.waiver?.claimed === true) {
    const waiver = validateWaiver(record.waiver, eventDate, input.building_id);
    if (waiver.finding === "NOT_DETERMINED") {
      return { ...waiver, program_code: program };
    }
    return {
      program_code: program,
      finding: "PASS",
      cycle_status: "CONTROLLED_WAIVER_APPLIED",
      waiver_id: waiver.waiver_id,
    };
  }

  let cycleStart;
  let dueDate;
  try {
    cycleStart = parseIsoDate(record.cycle_start_date, `${prefix}.cycle_start_date`);
    dueDate = addCalendarYear(cycleStart);
  } catch (error) {
    return blocked("PROGRAM_RECERTIFICATION_DATE_INVALID", error.message, [prefix], {
      program_code: program,
    });
  }

  if (eventDate < dueDate) {
    return {
      program_code: program,
      finding: "PASS",
      cycle_status: "NOT_YET_DUE",
      cycle_start_date: cycleStart,
      due_date: dueDate,
    };
  }

  const current = record.current_recertification;
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return blocked(
      "PROGRAM_RECERTIFICATION_DUE_MISSING",
      "The annual program recertification is due and no completed event was supplied.",
      [`${prefix}.current_recertification`],
      { program_code: program, due_date: dueDate },
    );
  }
  const requiredTrue = [
    "source_validated",
    "household_roster_validated",
    "income_calculation_validated",
    "program_income_definition_validated",
    "student_status_revalidated",
    "asset_rule_revalidated",
    "downstream_adjustment_handoff_validated",
  ].filter((field) => current[field] !== true);
  if (requiredTrue.length) {
    return blocked(
      "PROGRAM_RECERTIFICATION_EVENT_NOT_VALIDATED",
      "A completed recertification requires validated roster, income, student, asset, and downstream adjustment handoffs.",
      requiredTrue.map((field) => `${prefix}.current_recertification.${field}`),
      { program_code: program, due_date: dueDate },
    );
  }

  let completedDate;
  try {
    completedDate = parseIsoDate(
      current.completed_date,
      `${prefix}.current_recertification.completed_date`,
    );
  } catch (error) {
    return blocked("PROGRAM_RECERTIFICATION_DATE_INVALID", error.message, [prefix], {
      program_code: program,
    });
  }
  if (completedDate > eventDate) {
    return blocked(
      "PROGRAM_RECERTIFICATION_EVENT_FUTURE_DATED",
      "A future recertification cannot satisfy the current evaluation date.",
      [`${prefix}.current_recertification.completed_date`],
      { program_code: program },
    );
  }
  if (completedDate > dueDate) {
    return {
      program_code: program,
      finding: "FAIL",
      reason_code: "PROGRAM_RECERTIFICATION_COMPLETED_LATE",
      cycle_status: "COMPLETED_LATE",
      due_date: dueDate,
      completed_date: completedDate,
    };
  }
  const nextDueDate = addCalendarYear(completedDate);
  if (eventDate >= nextDueDate) {
    return blocked(
      "PROGRAM_RECERTIFICATION_SCHEDULE_STALE",
      "The supplied completed recertification is itself followed by another due annual cycle.",
      [`${prefix}.current_recertification`],
      { program_code: program, due_date: nextDueDate },
    );
  }
  return {
    program_code: program,
    finding: "PASS",
    cycle_status: "COMPLETED_ON_TIME",
    due_date: dueDate,
    completed_date: completedDate,
    next_due_date: nextDueDate,
  };
}

function evaluateHouseholdChanges(input, programs, eventDate) {
  if (!Array.isArray(input.household_change_events)) {
    return blocked(
      "HOUSEHOLD_CHANGE_INVENTORY_MISSING",
      "Household changes require a structured complete event inventory.",
      ["household_change_events"],
    );
  }
  if (input.household_change_inventory_complete !== true) {
    return blocked(
      "HOUSEHOLD_CHANGE_INVENTORY_NOT_VALIDATED",
      "The household-change event inventory must be marked complete.",
      ["household_change_inventory_complete"],
    );
  }

  const failures = [];
  const blockers = [];
  const normalized = [];
  for (const [index, change] of input.household_change_events.entries()) {
    const prefix = `household_change_events[${index}]`;
    if (!change || typeof change !== "object" || Array.isArray(change)) {
      blockers.push(blocked("HOUSEHOLD_CHANGE_EVENT_INVALID", "Each household change must be a structured event.", [prefix]));
      continue;
    }
    const requiredTrue = [
      "source_validated",
      "identity_validated",
      "resulting_roster_validated",
      "program_impacts_complete",
    ].filter((field) => change[field] !== true);
    let changeDate;
    try {
      changeDate = parseIsoDate(change.change_date, `${prefix}.change_date`);
    } catch (error) {
      blockers.push(blocked("HOUSEHOLD_CHANGE_DATE_INVALID", error.message, [prefix]));
      continue;
    }
    if (changeDate > eventDate) {
      blockers.push(blocked("HOUSEHOLD_CHANGE_FUTURE_DATED", "A future household change cannot affect the current evaluation.", [prefix]));
      continue;
    }
    if (requiredTrue.length) {
      blockers.push(blocked("HOUSEHOLD_CHANGE_EVENT_NOT_VALIDATED", "Household changes require validated identity, roster, source, and program impacts.", requiredTrue.map((field) => `${prefix}.${field}`)));
      continue;
    }
    if (!Array.isArray(change.program_impacts)) {
      blockers.push(blocked("HOUSEHOLD_CHANGE_PROGRAM_IMPACTS_MISSING", "Every change requires an impact record for each applicable federal program.", [`${prefix}.program_impacts`]));
      continue;
    }
    const impactPrograms = uniqueSorted(
      change.program_impacts.map((impact) => String(impact.program_code ?? "").toUpperCase()),
    );
    const difference = [
      ...programs.filter((program) => !impactPrograms.includes(program)),
      ...impactPrograms.filter((program) => !programs.includes(program)),
    ];
    if (difference.length) {
      blockers.push(blocked("HOUSEHOLD_CHANGE_PROGRAM_SCOPE_MISMATCH", "Household-change impacts must exactly match the applicable federal program inventory.", difference));
      continue;
    }
    for (const impact of change.program_impacts) {
      if (impact.authority_validated !== true || impact.action_requirement_validated !== true) {
        blockers.push(blocked("HOUSEHOLD_CHANGE_PROGRAM_IMPACT_NOT_VALIDATED", "Each program impact requires validated authority and action requirements.", [`${prefix}:${impact.program_code}`]));
      } else if (impact.action_required === true && impact.action_completed !== true) {
        failures.push(`HOUSEHOLD_CHANGE:${change.event_id}:${impact.program_code}`);
      }
    }
    normalized.push({
      event_id: String(change.event_id),
      change_date: changeDate,
      resulting_household_member_ids: uniqueSorted(change.resulting_household_member_ids),
    });
  }

  if (normalized.length) {
    const latest = [...normalized].sort((left, right) => left.change_date.localeCompare(right.change_date)).at(-1);
    if (!sameRoster(latest.resulting_household_member_ids, input.household_member_ids)) {
      blockers.push(blocked("CURRENT_HOUSEHOLD_ROSTER_NOT_RECONCILED", "The latest validated household change does not match the current household roster.", [latest.event_id]));
    }
  }
  return {
    finding: blockers.length ? "NOT_DETERMINED" : failures.length ? "FAIL" : "PASS",
    events: normalized,
    blockers,
    confirmed_failure_indicators: failures,
  };
}

function evaluateAvailableUnitRule(input, eventDate) {
  const occupancy = input.lihtc_occupancy;
  if (!occupancy || typeof occupancy !== "object" || Array.isArray(occupancy)) {
    return blocked(
      "LIHTC_OCCUPANCY_HANDOFF_MISSING",
      "LIHTC and bond projects require a validated occupancy and available-unit handoff.",
      ["lihtc_occupancy"],
    );
  }
  const requiredTrue = [
    "unit_initially_qualified",
    "income_calculation_validated",
    "income_limit_validated",
    "rent_restriction_validated",
    "building_unit_inventory_complete",
    "available_unit_event_inventory_complete",
  ].filter((field) => occupancy[field] !== true);
  if (requiredTrue.length) {
    return blocked(
      "LIHTC_OCCUPANCY_HANDOFF_NOT_VALIDATED",
      "Available-unit evaluation requires validated initial qualification, income, rent restriction, and complete building inventory.",
      requiredTrue.map((field) => `lihtc_occupancy.${field}`),
    );
  }
  if (!Array.isArray(occupancy.available_unit_events)) {
    return blocked("AVAILABLE_UNIT_EVENT_INVENTORY_MISSING", "Available-unit events must be a structured list.", ["lihtc_occupancy.available_unit_events"]);
  }

  const setAside = String(occupancy.minimum_set_aside ?? "").toUpperCase();
  if (!["20_50", "40_60", "AVERAGE_INCOME"].includes(setAside)) {
    return blocked("LIHTC_MINIMUM_SET_ASIDE_INVALID", "The minimum set-aside must be 20_50, 40_60, or AVERAGE_INCOME.", ["lihtc_occupancy.minimum_set_aside"]);
  }

  let income;
  let thresholdBase;
  try {
    income = moneyToCents(occupancy.current_annual_income, "lihtc_occupancy.current_annual_income");
    if (setAside === "AVERAGE_INCOME") {
      if (occupancy.average_income_threshold_validated !== true) {
        return blocked("AVERAGE_INCOME_OVER_INCOME_THRESHOLD_NOT_VALIDATED", "Average-income projects require validated 60-percent and unit-designated limits.", ["lihtc_occupancy.average_income_threshold_validated"]);
      }
      thresholdBase = [
        moneyToCents(occupancy.sixty_percent_income_limit, "lihtc_occupancy.sixty_percent_income_limit"),
        moneyToCents(occupancy.unit_designated_income_limit, "lihtc_occupancy.unit_designated_income_limit"),
      ].reduce((left, right) => (left > right ? left : right));
    } else {
      thresholdBase = moneyToCents(occupancy.applicable_income_limit, "lihtc_occupancy.applicable_income_limit");
    }
  } catch (error) {
    return blocked("LIHTC_OVER_INCOME_CALCULATION_INVALID", error.message, ["lihtc_occupancy"]);
  }
  const thresholdPercent = occupancy.deep_rent_skewed === true ? 170n : 140n;
  const overIncome = income * 100n > thresholdBase * thresholdPercent;
  const thresholdAmount = (thresholdBase * thresholdPercent) / 100n;
  if (!overIncome) {
    return {
      finding: "PASS",
      rule_status: "NOT_TRIGGERED",
      current_annual_income: formatCents(income),
      trigger_amount: formatCents(thresholdAmount),
    };
  }
  if (occupancy.rent_restricted !== true) {
    return {
      finding: "FAIL",
      reason_code: "OVER_INCOME_UNIT_NOT_RENT_RESTRICTED",
      rule_status: "TRIGGERED_NONCOMPLIANT",
    };
  }

  let determinedDate;
  try {
    determinedDate = parseIsoDate(
      occupancy.over_income_determined_date,
      "lihtc_occupancy.over_income_determined_date",
    );
  } catch (error) {
    return blocked("OVER_INCOME_DETERMINATION_DATE_INVALID", error.message, ["lihtc_occupancy.over_income_determined_date"]);
  }

  const failures = [];
  const evaluatedEvents = [];
  for (const [index, unitEvent] of occupancy.available_unit_events.entries()) {
    const prefix = `lihtc_occupancy.available_unit_events[${index}]`;
    const requiredEventTrue = [
      "source_validated",
      "unit_size_validated",
      "new_resident_income_validated",
      "income_limit_validated",
    ].filter((field) => unitEvent?.[field] !== true);
    if (requiredEventTrue.length) {
      return blocked("AVAILABLE_UNIT_EVENT_NOT_VALIDATED", "Each available-unit occupancy event requires validated source, unit size, resident income, and limit.", requiredEventTrue.map((field) => `${prefix}.${field}`));
    }
    let occupiedDate;
    try {
      occupiedDate = parseIsoDate(unitEvent.occupied_date, `${prefix}.occupied_date`);
    } catch (error) {
      return blocked("AVAILABLE_UNIT_EVENT_DATE_INVALID", error.message, [prefix]);
    }
    if (occupiedDate < determinedDate || occupiedDate > eventDate) continue;

    const relevant = occupancy.deep_rent_skewed === true
      ? unitEvent.was_low_income_before_vacancy === true
      : Number(unitEvent.bedrooms) <= Number(occupancy.over_income_unit_bedrooms);
    if (!relevant) continue;

    let newResidentIncome;
    let permittedIncome;
    try {
      newResidentIncome = moneyToCents(unitEvent.new_resident_annual_income, `${prefix}.new_resident_annual_income`);
      if (occupancy.deep_rent_skewed === true) {
        if (unitEvent.deep_rent_skewed_threshold_validated !== true) {
          return blocked("DEEP_RENT_SKEWED_AVAILABLE_UNIT_THRESHOLD_NOT_VALIDATED", "Deep-rent-skewed events require validated 40-percent and designation thresholds.", [prefix]);
        }
        const forty = moneyToCents(unitEvent.forty_percent_ami_limit, `${prefix}.forty_percent_ami_limit`);
        if (setAside === "AVERAGE_INCOME") {
          const designated = moneyToCents(unitEvent.designated_income_limit, `${prefix}.designated_income_limit`);
          permittedIncome = forty < designated ? forty : designated;
        } else {
          permittedIncome = forty;
        }
      } else if (setAside === "AVERAGE_INCOME") {
        if (
          unitEvent.average_income_designation_validated !== true ||
          Number(unitEvent.project_average_after_designation) > 60
        ) {
          return blocked("AVERAGE_INCOME_AVAILABLE_UNIT_DESIGNATION_NOT_VALIDATED", "The available unit must preserve a validated project average no greater than 60 percent.", [prefix]);
        }
        permittedIncome = moneyToCents(unitEvent.maximum_permitted_income, `${prefix}.maximum_permitted_income`);
      } else {
        permittedIncome = moneyToCents(unitEvent.applicable_income_limit, `${prefix}.applicable_income_limit`);
      }
    } catch (error) {
      return blocked("AVAILABLE_UNIT_INCOME_CALCULATION_INVALID", error.message, [prefix]);
    }
    const compliant = newResidentIncome <= permittedIncome;
    if (!compliant) failures.push(`AVAILABLE_UNIT:${unitEvent.event_id}`);
    evaluatedEvents.push({
      event_id: String(unitEvent.event_id),
      occupied_date: occupiedDate,
      new_resident_annual_income: formatCents(newResidentIncome),
      maximum_permitted_income: formatCents(permittedIncome),
      finding: compliant ? "PASS" : "FAIL",
    });
  }
  return {
    finding: failures.length ? "FAIL" : "PASS",
    reason_code: failures.length ? "NEXT_AVAILABLE_UNIT_RULE_VIOLATION" : undefined,
    rule_status: failures.length ? "TRIGGERED_NONCOMPLIANT" : "TRIGGERED_COMPLIANT_OR_OPEN",
    current_annual_income: formatCents(income),
    trigger_amount: formatCents(thresholdAmount),
    evaluated_events: evaluatedEvents,
    confirmed_failure_indicators: failures,
  };
}

export function evaluateRecertificationOccupancyControls(input = {}) {
  const missing = [
    "property_id",
    "building_id",
    "unit_id",
    "household_id",
    "household_member_ids",
    "event_date",
    "program_inventory",
    "program_certifications",
    "household_change_events",
  ].filter((field) => input[field] === null || input[field] === undefined);
  for (const field of [
    "property_identity_validated",
    "building_identity_validated",
    "unit_identity_validated",
    "household_identity_validated",
    "program_inventory_complete",
    "program_authority_inventory_complete",
  ]) {
    if (input[field] !== true) missing.push(field);
  }
  if (missing.length) {
    return {
      resolution_status: "NOT_DETERMINED",
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      finding: "UNABLE_TO_DETERMINE",
      reason_code: "RECERTIFICATION_OCCUPANCY_SCOPE_NOT_VALIDATED",
      missing_inputs: uniqueSorted(missing),
      human_approval_required: true,
      agent_approval_required: true,
    };
  }
  if (!Array.isArray(input.household_member_ids) || !input.household_member_ids.length) {
    return {
      resolution_status: "NOT_DETERMINED",
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      finding: "UNABLE_TO_DETERMINE",
      reason_code: "HOUSEHOLD_ROSTER_INVALID",
      human_approval_required: true,
      agent_approval_required: true,
    };
  }

  let eventDate;
  try {
    eventDate = parseIsoDate(input.event_date, "event_date");
  } catch (error) {
    return {
      resolution_status: "NOT_DETERMINED",
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      finding: "UNABLE_TO_DETERMINE",
      reason_code: "RECERTIFICATION_OCCUPANCY_EVENT_DATE_INVALID",
      reason: error.message,
      human_approval_required: true,
      agent_approval_required: true,
    };
  }

  if (!Array.isArray(input.program_inventory) || !Array.isArray(input.program_certifications)) {
    return {
      resolution_status: "NOT_DETERMINED",
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      finding: "UNABLE_TO_DETERMINE",
      reason_code: "PROGRAM_RECERTIFICATION_INVENTORY_INVALID",
      human_approval_required: true,
      agent_approval_required: true,
    };
  }
  const programs = uniqueSorted(input.program_inventory.map((value) => String(value).toUpperCase()));
  if (!programs.length || programs.some((program) => !PROGRAM_CODES.has(program))) {
    return {
      resolution_status: "NOT_DETERMINED",
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      finding: "UNABLE_TO_DETERMINE",
      reason_code: "PROGRAM_RECERTIFICATION_INVENTORY_UNRECOGNIZED",
      human_approval_required: true,
      agent_approval_required: true,
    };
  }

  const blockers = [];
  const confirmedFailures = [];
  const stateRequested =
    programs.some((program) => STATE_PROGRAMS.has(program)) ||
    input.state_finding_requested === true;
  if (stateRequested) {
    blockers.push(
      blocked(
        "STATE_RECERTIFICATION_PACK_NOT_VALIDATED",
        "State and local recertification, waiver, and occupancy findings remain blocked until an approved controlled pack is activated.",
        ["state_rulepack"],
      ),
    );
  }

  const federalPrograms = programs.filter((program) => FEDERAL_ANNUAL_PROGRAMS.has(program));
  const certificationByProgram = new Map();
  for (const record of input.program_certifications) {
    const program = String(record?.program_code ?? "").toUpperCase();
    if (certificationByProgram.has(program)) {
      blockers.push(blocked("DUPLICATE_PROGRAM_RECERTIFICATION_RECORD", "Each program must have exactly one certification-cycle record.", [program]));
    } else {
      certificationByProgram.set(program, record);
    }
  }
  const certificationDifference = [
    ...federalPrograms.filter((program) => !certificationByProgram.has(program)),
    ...[...certificationByProgram.keys()].filter((program) => !federalPrograms.includes(program)),
  ];
  if (certificationDifference.length) {
    blockers.push(blocked("PROGRAM_RECERTIFICATION_INVENTORY_MISMATCH", "Program certification records must exactly match the federal program inventory.", certificationDifference));
  }

  const recertificationResults = federalPrograms.map((program) =>
    evaluateRecertification(program, certificationByProgram.get(program), input, eventDate),
  );
  for (const result of recertificationResults) {
    if (result.finding === "NOT_DETERMINED") blockers.push(result);
    if (result.finding === "FAIL") confirmedFailures.push(`RECERTIFICATION:${result.program_code}`);
  }

  const householdResult = evaluateHouseholdChanges(input, federalPrograms, eventDate);
  if (householdResult.finding === "NOT_DETERMINED") blockers.push(...householdResult.blockers);
  confirmedFailures.push(...(householdResult.confirmed_failure_indicators ?? []));

  let availableUnitResult = { finding: "PASS", rule_status: "NOT_APPLICABLE" };
  if (programs.some((program) => ["LIHTC", "TAX_EXEMPT_BOND"].includes(program))) {
    availableUnitResult = evaluateAvailableUnitRule(input, eventDate);
    if (availableUnitResult.finding === "NOT_DETERMINED") blockers.push(availableUnitResult);
    if (availableUnitResult.finding === "FAIL") {
      confirmedFailures.push(...(availableUnitResult.confirmed_failure_indicators ?? ["NEXT_AVAILABLE_UNIT_RULE"]));
    }
  }

  const normalizedFailures = uniqueSorted(confirmedFailures);
  if (blockers.length) {
    return {
      resolution_status: "NOT_DETERMINED",
      determination_status: "NOT_DETERMINED",
      rule_engine_authority: "BLOCKED",
      finding: "UNABLE_TO_DETERMINE",
      reason_code: "RECERTIFICATION_OCCUPANCY_UNRESOLVED",
      blockers,
      recertification_results: recertificationResults,
      household_change_result: householdResult,
      available_unit_result: availableUnitResult,
      confirmed_failure_indicators: normalizedFailures,
      human_approval_required: true,
      agent_approval_required: true,
    };
  }

  const finding = normalizedFailures.length ? "FAIL" : "PASS";
  return {
    resolution_status: "COMPLETED",
    determination_status: finding,
    rule_engine_authority: "ALLOWED",
    finding,
    rule_id: RECERTIFICATION_OCCUPANCY_RULE_ID,
    engine_build: RECERTIFICATION_OCCUPANCY_ENGINE_BUILD,
    property_id: String(input.property_id),
    building_id: String(input.building_id),
    unit_id: String(input.unit_id),
    household_id: String(input.household_id),
    household_member_ids: uniqueSorted(input.household_member_ids),
    event_date: eventDate,
    authority_scope: stateRequested ? "STATE_AND_FEDERAL" : "FEDERAL_BASELINE_ONLY",
    recertification_results: recertificationResults.sort((left, right) =>
      String(left.program_code).localeCompare(String(right.program_code)),
    ),
    household_change_result: householdResult,
    available_unit_result: availableUnitResult,
    confirmed_failure_indicators: normalizedFailures,
    lihtc_waiver_substituted_for_other_program: false,
    state_rule_applied_without_validated_pack: false,
    agent_approval_required: true,
    agent_approval_status: "PENDING",
    human_approval_required: true,
    citations: [
      "26 USC 42(g)(2)(D)",
      "26 USC 42(g)(8)",
      "26 CFR 1.42-15",
      "24 CFR 5.657",
      "24 CFR 982.516",
      "24 CFR 92.252",
      "24 CFR 93.302",
      "7 CFR 3560.152",
    ],
  };
}
