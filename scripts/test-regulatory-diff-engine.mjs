import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20260910183500_regulatory_diff_engine.sql",import.meta.url),"utf8");
const component=await readFile(new URL("../src/components/regulatory-diff-engine.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../src/routes/_authenticated/compliance-intelligence.tsx",import.meta.url),"utf8");

test("compares only structured validated source versions",()=>{
  assert.match(migration,/Both regulatory source versions must be validated/);
  assert.match(migration,/source_family/);
  assert.match(migration,/exact-structured-regulatory-diff-v1/);
  assert.match(migration,/requirements_added/);
  assert.match(migration,/requirements_removed/);
});
test("maps changes to governed impact without activation",()=>{
  assert.match(migration,/impacted_rule_mappings/);
  for(const kind of ["property","unit","household","certification","policy","form","calculation","workflow"]) assert.match(migration,new RegExp("'"+kind+"'"));
  assert.match(migration,/automatic_activation boolean not null default false check \(not automatic_activation\)/);
  assert.match(migration,/awaiting_authorized_review/);
  assert.match(component,/Automatic activation is disabled/);
});
test("preserves immutable tenant reports and exposes the workspace",()=>{
  assert.match(migration,/Regulatory diff reports are immutable/);
  assert.match(migration,/user_id=v_user_id/);
  assert.match(migration,/revoke all on function public\.compare_regulatory_source_versions/);
  assert.match(route,/<RegulatoryDiffEngine \/>/);
});
