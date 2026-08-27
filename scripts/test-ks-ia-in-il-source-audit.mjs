import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const batch=JSON.parse(await readFile(new URL("../src/lib/ks-ia-in-il-state-pack-candidates.json",import.meta.url),"utf8"));
test("Test 99 covers KS IA IN and IL",()=>{assert.equal(batch.test_id,99);assert.deepEqual(batch.jurisdictions.map(x=>x.state_code),["KS","IA","IN","IL"]);});
test("official sources stay on declared domains without invented hashes",()=>{for(const j of batch.jurisdictions)for(const s of j.sources){assert.equal(new URL(s.observed_url).hostname.replace(/^www\./,""),j.official_domain);assert.ok(!("sha256" in s));assert.match(s.status,/^OFFICIAL_/);}});
test("preserves version and scope blockers",()=>{const x=Object.fromEntries(batch.jurisdictions.map(j=>[j.state_code,j]));assert.match(x.KS.blocking_conflicts.join(" "),/Draft and final/);assert.match(x.IA.blocking_conflicts.join(" "),/under HOME/);assert.match(x.IN.blocking_conflicts.join(" "),/2021 compliance manual/);assert.match(x.IL.blocking_conflicts.join(" "),/2027-2028/);});
test("keeps all jurisdictions fail-closed and VP-gated",()=>{assert.match(batch.release_status,/^BLOCKED_/);assert.equal(batch.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION");});
