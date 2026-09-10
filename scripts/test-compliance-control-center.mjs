import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20260910191000_compliance_control_center.sql",import.meta.url),"utf8");
const component=await readFile(new URL("../src/components/compliance-control-center.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../src/routes/_authenticated/compliance-intelligence.tsx",import.meta.url),"utf8");

test("provides the executive command center summary",()=>{
  for(const metric of ["portfolio_size","units","certifications_in_progress","audit_readiness","critical_findings","overdue_items","regulatory_changes_requiring_attention","remediation_approaching_sla","properties_below_readiness"]) assert.match(migration,new RegExp(metric));
});
test("grounds today's attention queue in structured tenant records",()=>{
  assert.match(migration,/structured-control-center-v1/);
  assert.match(migration,/needs_attention_today/);
  assert.match(migration,/p\.user_id=v_user_id/);
  assert.match(migration,/f\.user_id=v_user_id/);
  assert.match(migration,/d\.user_id=v_user_id/);
  assert.match(migration,/revoke all on function public\.compliance_control_center/);
  assert.match(component,/What needs my attention today/);
});
test("places the control center first in the workspace",()=>{
  assert.match(route,/<ComplianceControlCenter \/><ComplianceIntelligenceSuite/);
});
