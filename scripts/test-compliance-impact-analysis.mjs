import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20260910182000_compliance_impact_analysis.sql",import.meta.url),"utf8");
const component=await readFile(new URL("../src/components/compliance-impact-analysis.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../src/routes/_authenticated/compliance-intelligence.tsx",import.meta.url),"utf8");

test("maps validated changes through effective graph scope",()=>{
 assert.match(migration,/version-effective-graph-traversal-v1/);
 assert.match(migration,/validation_status/);
 for(const kind of ["property","unit","household","certification","policy","form","calculation","workflow"]) assert.match(migration,new RegExp("'"+kind+"'"));
 assert.match(migration,/effective_from<=_as_of/);
});
test("never activates changes and requires authorized review",()=>{
 assert.match(migration,/automatic_activation','false|automatic_activation',false/);
 assert.match(migration,/requires_authorized_review/);
 assert.match(migration,/analysis_status='analysis_only'/);
 assert.match(component,/automatic activation is disabled/i);
});
test("enforces tenant scope, immutability, rate limiting, and anonymous denial",()=>{
 assert.match(migration,/user_id=v_user_id/);
 assert.match(migration,/Impact analysis rate limit/);
 assert.match(migration,/Compliance impact analyses are immutable/);
 assert.match(migration,/revoke all on function public\.calculate_compliance_impact/);
 assert.match(route,/<ComplianceImpactAnalysis \/>/);
});
