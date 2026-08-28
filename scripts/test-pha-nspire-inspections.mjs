import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260828150000_pha_nspire_inspections.sql");
const workspace = read("src/components/pha-inspections-workspace.tsx");
const route = read("src/routes/_authenticated/pha-inspections.tsx");

test("inspection model separates transition profiles inspections and deficiencies", () => {
  assert.match(migration, /pha_inspection_transition_profiles/);
  assert.match(migration, /pha_inspections/);
  assert.match(migration, /pha_inspection_deficiencies/);
  assert.match(migration, /unit','inside','outside/);
  assert.match(migration, /life_threatening','severe','moderate','low/);
});

test("voucher programs fail closed on transition date later than February 1 2027", () => {
  assert.match(migration, /planned_nspire_date <= date '2027-02-01'/);
  assert.match(migration, /cannot be later than February 1, 2027/);
  assert.match(migration, /Voucher programs remaining on previous HQS require a planned NSPIRE transition date/);
});

test("Public Housing is always routed to NSPIRE", () => {
  assert.match(migration, /program_code = 'public_housing' and current_standard = 'nspire'/);
  assert.match(migration, /if new\.program_code = 'public_housing' then[\s\S]*new\.current_standard := 'nspire'/);
  assert.match(migration, /if new\.program_code = 'public_housing' then new\.standard_used := 'nspire'/);
});

test("transition-era reinspections retain the originating inspection standard", () => {
  assert.match(migration, /Reinspection requires the originating inspection/);
  assert.match(migration, /new\.standard_used := parent_row\.standard_used/);
  assert.match(migration, /reinspection_of/);
});

test("inspection scheduling derives standard from current controlled transition authority", () => {
  assert.match(migration, /Inspection transition profile is required before scheduling an inspection/);
  assert.match(migration, /Current controlled inspection authority is required/);
  assert.match(migration, /target_date >= coalesce\(profile_row\.planned_nspire_date, date '2027-02-01'\)/);
  assert.match(migration, /standard_at_scheduling/);
});

test("inspection staff receive inspection access without family or EIV access", () => {
  assert.match(migration, /agency_role = 'inspection_staff'/);
  assert.match(migration, /PHA inspection staff write inspections/);
  assert.match(migration, /PHA inspection staff write deficiencies/);
});

test("PHA inspection workspace exposes transition readiness and scheduling", () => {
  assert.match(route, /PhaInspectionsWorkspace/);
  assert.match(workspace, /NSPIRE transition controls/);
  assert.match(workspace, /HUD notification/);
  assert.match(workspace, /Owners and families notified of NSPIRE transition/);
  assert.match(workspace, /Inspectors trained for selected standard/);
  assert.match(workspace, /Schedule inspection/);
  assert.match(workspace, /Inspection register/);
});

test("UI does not choose final standard as an authoritative user field", () => {
  assert.match(workspace, /standard_used: "hqs_previous"/);
  assert.match(migration, /new\.standard_used := 'nspire'/);
  assert.match(migration, /new\.standard_used := 'hqs_previous'/);
  assert.match(workspace, /The inspection standard is assigned server-side/);
});
