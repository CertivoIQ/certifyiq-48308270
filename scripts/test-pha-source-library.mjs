import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828250000_pha_source_library_forms.sql");
const nspireActivation=read("supabase/migrations/20260828270000_pha_nspire_standards_activation.sql");
const nspireBundleIntegrity=read("supabase/migrations/20260828292000_pha_nspire_bundle_integrity.sql");
const workspace=read("src/components/pha-source-library-workspace.tsx");
const route=read("src/routes/_authenticated/pha-source-library.tsx");
const nspireWorkspace=read("src/components/pha-nspire-standards-workspace.tsx");
const nspireRoute=read("src/routes/_authenticated/pha-nspire-standards.tsx");
const shell=read("src/components/app-shell.tsx");

test("source library separates federal and agency governance",()=>{
 assert.match(migration,/source_scope in \('federal','agency'\)/);
 assert.match(migration,/Staff manage federal source library/);
 assert.match(migration,/PHA admins manage agency source library/);
 assert.match(migration,/current source requires reference and validation record/i);
});

test("controlled templates fail closed on source and policy state",()=>{
 assert.match(migration,/pha_controlled_templates/);
 assert.match(migration,/current source-library record/);
 assert.match(migration,/active and validated/);
 assert.match(migration,/Validated template requires validator and timestamp/);
});

test("PHA source library workspace is routed and navigated",()=>{
 assert.match(route,/PhaSourceLibraryWorkspace/);
 assert.match(workspace,/Source Library & Forms/);
 assert.match(workspace,/pha_source_library/);
 assert.match(workspace,/pha_controlled_templates/);
 assert.match(shell,/\/pha-source-library/);
});

test("NSPIRE release cannot activate without verified HUD source and populated rows",()=>{
 assert.match(nspireActivation,/pha_nspire_standard_releases/);
 assert.match(nspireActivation,/official HUD source/i);
 assert.match(nspireActivation,/empty deficiency registry/i);
 assert.match(nspireActivation,/activate_pha_nspire_standard_release/);
 assert.match(nspireActivation,/source_checksum/);
 assert.match(nspireActivation,/HUD-NSPIRE-FINAL-STANDARDS/);
});

test("NSPIRE standards control exposes release and registry state",()=>{
 assert.match(nspireRoute,/PhaNspireStandardsWorkspace/);
 assert.match(nspireWorkspace,/NSPIRE Standards Control/);
 assert.match(nspireWorkspace,/No deficiency rows loaded\. Activation is correctly blocked/);
 assert.match(nspireWorkspace,/hcv_correction_hours/);
 assert.match(nspireWorkspace,/hcv_pass_fail/);
});

test("NSPIRE activation requires the current official HUD bundle and manifest reconciliation",()=>{
 assert.match(nspireBundleIntegrity,/NSPIRE-Standards-ALL-STANDARDS\.zip/);
 assert.match(nspireBundleIntegrity,/expected_standard_count=63/);
 assert.match(nspireBundleIntegrity,/count\(distinct standard_name\)/);
 assert.match(nspireBundleIntegrity,/standard count does not match the controlled HUD manifest/);
 assert.match(nspireBundleIntegrity,/Verified HUD NSPIRE bundle artifact and checksum are required/);
 assert.match(nspireBundleIntegrity,/pha_nspire_source_artifacts/);
 assert.match(nspireWorkspace,/Official bundle control/);
 assert.match(nspireWorkspace,/Imported count must match HUD manifest/);
});
