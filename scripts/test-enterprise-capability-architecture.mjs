import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20260910193000_enterprise_capability_architecture.sql",import.meta.url),"utf8");
const component=await readFile(new URL("../src/components/enterprise-capability-architecture.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../src/routes/_authenticated/compliance-intelligence.tsx",import.meta.url),"utf8");

test("models premium enterprise capabilities without nickel-and-dime pricing",()=>{
  for(const key of ["audit_simulation","auditor_workspace","compliance_intelligence","regulatory_change_intelligence","advanced_integrations_api","enterprise_benchmarking"]) assert.match(migration,new RegExp(key));
  assert.match(migration,/'pricing_logic','none'/);
  assert.doesNotMatch(migration,/price_cents|unit_price|stripe_price/i);
  assert.match(component,/No per-feature pricing/i);
});
test("requires governed plan or license authorization",()=>{
  assert.match(migration,/governance_status='approved'/);
  assert.match(migration,/approval_reference/);
  assert.match(migration,/automatic_package_activation',false/);
  assert.match(migration,/existing_all_features_license/);
  assert.match(migration,/approved_license_override/);
});
test("preserves tenant and API boundaries",()=>{
  assert.match(migration,/m\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration,/revoke all on function public\.enterprise_capability_matrix/);
  assert.match(route,/<EnterpriseCapabilityArchitecture \/>/);
});
