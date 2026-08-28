import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828190000_pha_nspire_deficiency_registry.sql");
const activation=read("supabase/migrations/20260828310000_load_verified_nspire_registry.sql");

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


test("verified HUD registry preserves HCV pass rows without an invented deadline",()=>{
 assert.match(activation,/hcv_pass_fail='pass' and hcv_correction_hours is null/);
 assert.match(activation,/hcv_pass_fail='fail'.*hcv_correction_hours is not null/s);
 assert.match(activation,/expected_deficiency_count=407/);
 assert.match(activation,/loaded_standard_count<>63 or loaded_deficiency_count<>407/);
});

test("activation requires checksum integrity and two distinct staff attestations",()=>{
 assert.match(activation,/9758d7703e574eb3f0ab923b58dc9040cf5f6e7a671db2785ebd4ec7ebee6254/);
 assert.match(activation,/unique\(release_id, verifier_id\)/);
 assert.match(activation,/count\(distinct verifier_id\)/);
 assert.match(activation,/attestation_count>=2/);
 assert.match(activation,/activate_pha_nspire_standard_release/);
});

test("controlled registry is loaded pending and remains fail closed until attested",()=>{
 assert.match(activation,/source_status='pending_source'/);
 assert.match(activation,/active=false/);
 assert.match(activation,/import_status='parsed'/);
 assert.match(activation,/verified_by=null/);
 assert.match(activation,/verified_at=null/);
});


test("legacy rows are replaced only when provisional inactive and unreferenced",()=>{
 assert.match(activation,/Existing NSPIRE rows are active, non-provisional, or referenced by inspection evidence/);
 assert.match(activation,/s\.active=false/);
 assert.match(activation,/s\.source_status='pending_source'/);
 assert.match(activation,/not exists\([\s\S]*pha_inspection_deficiencies/);
});
