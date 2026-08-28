import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828230000_pha_pbv_public_housing_operations.sql");
const workspace=read("src/components/pha-program-operations.tsx");
const shell=read("src/components/app-shell.tsx");

test("PBV operations keep HAP rent and right-to-move controls separate from HCV portability",()=>{
  assert.match(migration,/pha_pbv_hap_contracts/);
  assert.match(migration,/pha_pbv_rent_actions/);
  assert.match(migration,/pha_pbv_move_requests/);
  assert.match(migration,/PBV move request requires a PBV family action/);
  assert.match(migration,/one_year_requirement_satisfied/);
  assert.match(migration,/vawa_emergency_transfer/);
  assert.match(migration,/PBV approved rent exceeds controlled rent limit/);
  assert.match(workspace,/24 CFR 983\.261/);
  assert.match(shell,/\/pha-pbv-operations/);
});

test("Public Housing operations control annual rent choice and the 24-month over-income process",()=>{
  assert.match(migration,/pha_public_housing_rent_elections/);
  assert.match(migration,/income_based/);
  assert.match(migration,/flat_rent/);
  assert.match(migration,/pha_public_housing_over_income_cases/);
  assert.match(migration,/consecutive_months >= 24/);
  assert.match(migration,/alternative_non_public_housing_rent/);
  assert.match(workspace,/24 CFR 960\.253/);
  assert.match(workspace,/24 CFR 960\.507/);
  assert.match(shell,/\/pha-public-housing-operations/);
});

test("program-specific navigation follows PHA agency role scope",()=>{
  assert.match(shell,/pbv_operations/);
  assert.match(shell,/ph_operations/);
  assert.match(shell,/hcv_pbv_specialist/);
  assert.match(shell,/public_housing_specialist/);
});
