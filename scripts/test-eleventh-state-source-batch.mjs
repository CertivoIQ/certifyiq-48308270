import assert from"node:assert/strict";import{readFile}from"node:fs/promises";import test from"node:test";const d=JSON.parse(await readFile(new URL("../src/lib/eleventh-state-source-batch-candidates.json",import.meta.url)));
test("contains ID NM HI GU once",()=>{assert.deepEqual(d.states.map(s=>s.state_code),["ID","NM","HI","GU"]);assert.equal(new Set(d.states.map(s=>s.state_code)).size,4)});
test("keeps all sources non-active",()=>{assert.match(d.status,/^BLOCKED_/);for(const s of d.states)for(const x of s.sources)assert.match(x.status,/^(PENDING|BLOCKED)_/)});
test("uses official domains",()=>{for(const s of d.states)for(const x of s.sources){const h=new URL(x.url).hostname.replace(/^www\./,"");assert.ok(h===s.official_domain||h.endsWith("."+s.official_domain))}});
test("records conflicts",()=>{for(const s of d.states)assert.ok(s.conflicts.length)});
test("requires VP verification and property boundary",()=>{assert.equal(d.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");assert.ok(d.shared_pack_excludes.includes("LURA"))});
test("records New Mexico allocator and Guam territory",()=>{const nm=d.states.find(s=>s.state_code==="NM"),gu=d.states.find(s=>s.state_code==="GU");assert.match(nm.agency,/Mortgage Finance Authority/);assert.equal(nm.official_domain,"housingnm.org");assert.equal(gu.jurisdiction_type,"TERRITORY")});
