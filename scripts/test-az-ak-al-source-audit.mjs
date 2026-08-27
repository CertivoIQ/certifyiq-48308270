import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const batch = JSON.parse(await readFile(new URL("../src/lib/final-state-source-batch-candidates.json", import.meta.url), "utf8"));
test("audits AZ AK and AL", () => { assert.equal(batch.is_final_supplied_hfa_batch,true); assert.deepEqual(batch.states.map(x=>x.state_code),["AZ","AK","AL"]); });
test("official sources remain hash-free candidates", () => { for (const j of batch.states) for (const s of j.sources) { assert.ok(!("sha256" in s)); assert.match(s.status,/^(?:PENDING|BLOCKED)_/); } });
test("preserves version and layered-program blockers", () => { const x=Object.fromEntries(batch.states.map(j=>[j.state_code,j])); assert.match(x.AZ.conflicts.join(" "),/May 1, 2026/); assert.match(x.AK.conflicts.join(" "),/June 24, 2026/); assert.match(x.AL.conflicts.join(" "),/2027 QAP/); });
test("remains fail-closed and VP-gated", () => { assert.match(batch.status,/^BLOCKED_/); assert.equal(batch.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION"); assert.ok(batch.activation_requirements.includes("conflict resolution")); });
