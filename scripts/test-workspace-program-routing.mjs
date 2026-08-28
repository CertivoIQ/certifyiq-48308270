import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260828012000_workspace_profiles_and_program_applicability.sql");
const hotmaCorrection = read("supabase/migrations/20260828022000_split_hotma_section_overlays.sql");
const configurator = read("src/components/workspace-profile-configurator.tsx");
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
