import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828190000_pha_nspire_deficiency_registry.sql");

test("NSPIRE deficiencies require a current controlled standard",()=>{
 assert.match(migration,/pha_nspire_deficiency_standards/);
 assert.match(migration,/source_status='current'/);
 assert.match(migration,/Current controlled NSPIRE deficiency standard is required/);
});

test("correction deadline and HCV pass fail derive from the registry",()=>{
 assert.match(migration,/hcv_correction_hours/);
 assert.match(migration,/hcv_pass_fail/);
 assert.match(migration,/correction_timeframe_hours/);
 assert.match(migration,/make_interval\(hours=>hours_to_correct\)/);
 assert.match(migration,/program_code in \('hcv','pbv','mod_rehab'\)/);
});

test("deficiency source authority is snapshotted",()=>{
 assert.match(migration,/source_snapshot/);
 assert.match(migration,/source_url/);
 assert.match(migration,/source_version/);
 assert.match(migration,/standard_id/);
});
