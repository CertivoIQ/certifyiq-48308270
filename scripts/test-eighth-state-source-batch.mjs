import assert from"node:assert/strict";import{readFile}from"node:fs/promises";import test from"node:test";const d=JSON.parse(await readFile(new URL("../src/lib/eighth-state-source-batch-candidates.json",import.meta.url)));
test("contains MS MN MI MA once",()=>{assert.deepEqual(d.states.map(s=>s.state_code),["MS","MN","MI","MA"]);assert.equal(new Set(d.states.map(s=>s.state_code)).size,4)});
test("keeps all sources non-active",()=>{assert.match(d.status,/^BLOCKED_/);for(const s of d.states)for(const x of s.sources)assert.match(x.status,/^(PENDING|BLOCKED)_/)});
test("uses official domains",()=>{for(const s of d.states)for(const x of s.sources){const h=new URL(x.url).hostname.replace(/^www\./,"");assert.ok(h===s.official_domain||h.endsWith("."+s.official_domain))}});
test("records conflicts",()=>{for(const s of d.states)assert.ok(s.conflicts.length)});
test("requires VP verification and property boundary",()=>{assert.equal(d.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");assert.ok(d.shared_pack_excludes.includes("LURA"))});
test("records Massachusetts allocator authority",()=>{const ma=d.states.find(s=>s.state_code==="MA");assert.equal(ma.agency,"Executive Office of Housing and Livable Communities");assert.ok(ma.conflicts.some(x=>x.includes("not MassHousing")))});
