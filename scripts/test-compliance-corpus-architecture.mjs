import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20260910194500_compliance_corpus_architecture.sql",import.meta.url),"utf8");
const component=await readFile(new URL("../src/components/compliance-corpus-governance.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../src/routes/_authenticated/compliance-intelligence.tsx",import.meta.url),"utf8");

test("models the complete regulation relationship corpus",()=>{
 for(const kind of ["property","program","evidence","calculation","finding","correction","reviewer_decision","audit_outcome"]) assert.match(migration,new RegExp("'"+kind+"'"));
 assert.match(migration,/source_version text not null/);
 assert.match(migration,/provenance \?& array\['source_table','source_id','captured_at'\]/);
});
test("protects raw customer data and model-training boundaries",()=>{
 assert.match(migration,/customer_data_use='service_delivery_only'/);
 assert.match(migration,/check \(not model_training_eligible\)/);
 assert.match(migration,/raw_cross_tenant_access',false/);
 assert.match(migration,/model_training_permission.*prohibited/s);
 assert.match(component,/never model-training eligible/i);
});
test("supports only private thresholded anonymized aggregation",()=>{
 assert.match(migration,/private\.compliance_corpus_aggregate_cells/);
 assert.match(migration,/contributing_tenant_count>=5/);
 assert.match(migration,/revoke all on private\.compliance_corpus_aggregate_cells from public,anon,authenticated/);
 assert.match(migration,/Compliance Corpus history is immutable/);
 assert.match(route,/<ComplianceCorpusGovernance \/>/);
});
