import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20260910185000_portfolio_compliance_intelligence.sql",import.meta.url),"utf8");
const component=await readFile(new URL("../src/components/portfolio-compliance-intelligence.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../src/routes/_authenticated/compliance-intelligence.tsx",import.meta.url),"utf8");

test("provides the requested explainable portfolio metrics",()=>{
  for(const metric of ["findings_per_100_certifications","finding_categories","repeat_deficiency_patterns","average_remediation_hours","audit_readiness","property_trends","program_trends","reviewer_trends","recurring_evidence_deficiencies"]) assert.match(migration,new RegExp(metric));
  assert.match(migration,/structured-tenant-analytics-v1/);
});
test("keeps analytics tenant scoped and disables cross-customer benchmarking",()=>{
  assert.match(migration,/i\.user_id=v_user_id/);
  assert.match(migration,/f\.user_id=v_user_id/);
  assert.match(migration,/r\.user_id=v_user_id/);
  assert.match(migration,/'status','not_enabled'/);
  assert.match(migration,/revoke all on function public\.portfolio_compliance_intelligence/);
  assert.match(component,/Benchmarking not enabled/);
});
test("surfaces the portfolio workspace",()=>assert.match(route,/<PortfolioComplianceIntelligence \/>/));
