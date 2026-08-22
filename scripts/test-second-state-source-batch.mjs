import assert from "node:assert/strict"; import {readFile} from "node:fs/promises"; import test from "node:test";
const d=JSON.parse(await readFile(new URL("../src/lib/second-state-source-batch-candidates.json",import.meta.url)));
test("contains VI VT UT and TX once",()=>{assert.deepEqual(d.states.map(s=>s.state_code),["VI","VT","UT","TX"]);assert.equal(new Set(d.states.map(s=>s.state_code)).size,4)});
test("keeps the batch blocked",()=>{assert.match(d.status,/^BLOCKED_/);for(const s of d.states)for(const x of s.sources)assert.match(x.status,/^(PENDING|BLOCKED)_/)});
test("uses only registered official domains",()=>{for(const s of d.states)for(const x of s.sources){const h=new URL(x.url).hostname.replace(/^www\./,"");assert.ok(h===s.official_domain||h.endsWith("."+s.official_domain))}});
test("records currency and discovery conflicts",()=>{assert.ok(d.states.find(s=>s.state_code==="VI").conflicts.length);assert.ok(d.states.find(s=>s.state_code==="VT").conflicts.length);assert.ok(d.states.find(s=>s.state_code==="UT").conflicts.length)});
test("requires property verification and preserves enterprise documents",()=>{assert.equal(d.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");assert.ok(d.shared_pack_excludes.includes("LURA"))});
