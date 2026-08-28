import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { routePha50058Transaction } from "../src/lib/pha-50058-transaction-router.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260828012000_workspace_profiles_and_program_applicability.sql");
const hotmaCorrection = read("supabase/migrations/20260828022000_split_hotma_section_overlays.sql");
const phaRoutingMigration = read("supabase/migrations/20260828030000_pha_hotma_cohort_profile.sql");
const transactionMigration = read("supabase/migrations/20260828031000_pha_50058_transaction_queue.sql");
const configurator = read("src/components/workspace-profile-configurator.tsx");
const phaDashboard = read("src/components/pha-dashboard.tsx");
const phaModulePage = read("src/components/pha-module-page.tsx");
const dashboardRoute = read("src/routes/_authenticated/dashboard.tsx");
const appShell = read("src/components/app-shell.tsx");

test("workspace profile stores organization type and multiple programs", () => {
  assert.match(migration, /customer_workspace_profiles/);
  assert.match(migration, /selected_programs text\[\]/);
  assert.match(migration, /pha_programs text\[\]/);
  assert.match(configurator, /Select all that apply/);
});

test("HOTMA is derived instead of offered as a selectable program", () => {
  assert.match(hotmaCorrection, /derive_workspace_overlays/);
  assert.match(hotmaCorrection, /hotma_102/);
  assert.match(hotmaCorrection, /hotma_103/);
  assert.match(hotmaCorrection, /hotma_104/);
  assert.doesNotMatch(configurator, /\["hotma"\s*,/i);
  assert.match(configurator, /HOTMA is not a selectable program/);
});

test("multifamily HOTMA section 104 is limited to PBRA and Section 202\/8", () => {
  assert.match(hotmaCorrection, /programs && array\['section8_pbra','section202_8'\]::text\[]/);
  assert.match(hotmaCorrection, /'section202_811_prac','section811_pra','section236_irp','sprac'/);
  const section104Case = hotmaCorrection.match(/case when programs && array\['section8_pbra','section202_8'\][\s\S]*?then 'hotma_104' end/);
  assert.ok(section104Case, "HOTMA 104 overlay must use the narrow MFH program set");
  assert.doesNotMatch(section104Case[0], /section202_811_prac|section811_pra|section236_irp|sprac/);
});

test("PHA workspace requires cohort and HUD-50058 reporting path for HOTMA routing", () => {
  assert.match(phaRoutingMigration, /pha_hotma_cohort/);
  assert.match(phaRoutingMigration, /NON_MTW_NON_FRS/);
  assert.match(phaRoutingMigration, /INITIAL_MTW/);
  assert.match(phaRoutingMigration, /MTW_EXPANSION/);
  assert.match(phaRoutingMigration, /FRS_EXCLUSIVE/);
  assert.match(phaRoutingMigration, /hud_50058_reporting_path/);
  assert.match(configurator, /PHA cohort and HUD-50058 reporting path are required/);
});

test("PHA command center routes implementation timing through the deterministic HOTMA engine", () => {
  assert.match(phaDashboard, /classifyPhaHotmaImplementation/);
  assert.match(phaDashboard, /PHA-HOTMA-FULL-SECTIONS-102-104/);
  assert.match(phaDashboard, /PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE/);
  assert.match(phaDashboard, /transaction_effective_date: "2027-01-01"/);
  assert.doesNotMatch(phaDashboard, /January 1, 2027 is treated as the full-compliance target/);
});

test("PHA HUD-50058 transaction queue is tenant isolated and routed deterministically", () => {
  assert.match(transactionMigration, /pha_50058_transactions/);
  assert.match(transactionMigration, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(phaModulePage, /routePha50058Transaction/);
  assert.match(phaModulePage, /awaiting HUD guidance/i);
});

const validatedTransaction = {
  program: "hcv",
  transaction_type: "annual_reexamination",
  pha_hotma_cohort: "NON_MTW_NON_FRS",
  hud_50058_reporting_path: "HUD_50058_2024",
  program_applicability_validated: true,
  controlled_source_release_approved: true,
  current_rule_version_validated: true,
  full_hotma_policy_set_validated: true,
  reporting_path_validated: true,
  software_compatibility_validated: true,
};

test("non-MTW transaction before full implementation is classified pre-implementation", () => {
  const result = routePha50058Transaction({ ...validatedTransaction, effective_date: "2026-12-01" });
  assert.equal(result.status, "PRE_IMPLEMENTATION");
});

test("non-MTW transaction on the full-compliance date is ready when controls are validated", () => {
  const result = routePha50058Transaction({ ...validatedTransaction, effective_date: "2027-01-01" });
  assert.equal(result.status, "READY");
});

test("MTW transaction does not inherit the non-MTW January 2027 enforcement date", () => {
  const result = routePha50058Transaction({ ...validatedTransaction, pha_hotma_cohort: "INITIAL_MTW", effective_date: "2027-01-01" });
  assert.equal(result.status, "AWAITING_HUD_GUIDANCE");
  assert.equal(result.reason_code, "PHA_HOTMA_DEADLINE_PENDING_HUD_GUIDANCE");
});

test("transaction routing blocks when required operational controls are unresolved", () => {
  const result = routePha50058Transaction({ ...validatedTransaction, full_hotma_policy_set_validated: false, effective_date: "2027-01-01" });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing_inputs?.includes("full_hotma_policy_set_validated"));
});

test("program applicability supports property, building, and unit scope with tenant isolation", () => {
  assert.match(migration, /property_program_applicability/);
  assert.match(migration, /coverage_level in \('property', 'building', 'unit'\)/);
  assert.match(migration, /building_id text/);
  assert.match(migration, /unit_id text/);
  assert.match(migration, /user_id uuid not null default auth\.uid\(\)/);
  assert.match(migration, /Users manage own property program applicability/);
  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /using \(true\) with check \(true\)/);
});

test("PHA accounts route to an agency-specific command center and modules", () => {
  assert.match(dashboardRoute, /organization_type === "pha"/);
  assert.match(dashboardRoute, /<PhaDashboard/);
  for (const route of ["pha-families", "pha-50058", "pha-inspections", "pha-hotma"]) {
    assert.ok(existsSync(new URL(`../src/routes/_authenticated/${route}.tsx`, import.meta.url)), `${route} route must exist`);
    assert.match(appShell, new RegExp(route));
  }
});

test("multifamily navigation exposes organization and program configuration", () => {
  assert.match(appShell, /workspace-setup/);
  assert.match(appShell, /Multifamily workspace/);
  assert.match(appShell, /PHA workspace/);
});
