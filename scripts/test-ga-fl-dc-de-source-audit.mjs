import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const batch = JSON.parse(await readFile(new URL("../src/lib/twelfth-state-source-batch-candidates.json", import.meta.url), "utf8"));
test("audits GA FL DC and DE", () => assert.deepEqual(batch.states.map(x=>x.state_code),["GA","FL","DC","DE"]));
test("official sources remain hash-free candidates", () => { for (const j of batch.states) for (const s of j.sources) { assert.ok(!("sha256" in s)); assert.match(s.status,/^(?:PENDING|BLOCKED)_/); } });
test("preserves authority blockers", () => { const x=Object.fromEntries(batch.states.map(j=>[j.state_code,j])); assert.match(x.GA.conflicts.join(" "),/March 2024/); assert.match(x.FL.conflicts.join(" "),/Competitive RFAs/); assert.match(x.DC.conflicts.join(" "),/DCHFA/); assert.match(x.DE.conflicts.join(" "),/separately distributed/); });
test("remains fail-closed and VP-gated", () => { assert.match(batch.status,/^BLOCKED_/); assert.equal(batch.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION"); assert.ok(batch.activation_requirements.includes("conflict resolution")); });
