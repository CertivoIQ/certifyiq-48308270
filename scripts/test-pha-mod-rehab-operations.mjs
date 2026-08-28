import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828240000_pha_mod_rehab_operations.sql");
const workspace=read("src/components/pha-mod-rehab-operations.tsx");
const shell=read("src/components/app-shell.tsx");

test("Mod Rehab contract rent stays separate from PBV and HCV rent logic",()=>{
  assert.match(migration,/pha_mod_rehab_contracts/);
  assert.match(migration,/current_base_rent/);
  assert.match(migration,/monthly_rehab_debt_service/);
  assert.match(migration,/current_contract_rent:=round\(new\.current_base_rent \+ new\.monthly_rehab_debt_service,2\)/);
  assert.match(migration,/Current controlled Mod Rehab authority is required/);
});

test("Mod Rehab HAP actions are source and program gated",()=>{
  assert.match(migration,/pha_mod_rehab_hap_actions/);
  assert.match(migration,/Mod Rehab HAP action requires a Mod Rehab family action/);
  assert.match(migration,/audited_financial_support/);
  assert.match(migration,/hud_field_office_approval/);
  assert.match(migration,/inspection_compliant/);
  assert.match(migration,/source_snapshot/);
});

test("Mod Rehab has a dedicated role-scoped workspace",()=>{
  assert.match(workspace,/Part 882/);
  assert.match(workspace,/HUD-50058 Section 13/);
  assert.match(shell,/\/pha-mod-rehab-operations/);
  assert.match(shell,/mod_rehab_operations/);
  assert.match(shell,/hcv_pbv_specialist/);
});
