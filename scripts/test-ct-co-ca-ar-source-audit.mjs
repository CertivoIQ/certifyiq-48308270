import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const batch = JSON.parse(await readFile(new URL("../src/lib/thirteenth-state-source-batch-candidates.json", import.meta.url), "utf8"));
test("audits CT CO CA and AR", () => assert.deepEqual(batch.states.map(x => x.state_code), ["CT","CO","CA","AR"]));
test("official sources remain hash-free candidates", () => { for (const j of batch.states) for (const s of j.sources) { assert.ok(!("sha256" in s)); assert.match(s.status,/^(?:PENDING|BLOCKED)_/); } });
test("preserves authority and version blockers", () => { const x=Object.fromEntries(batch.states.map(j=>[j.state_code,j])); assert.match(x.CT.conflicts.join(" "),/2027-2028/); assert.match(x.CO.conflicts.join(" "),/June 2026/); assert.match(x.CA.conflicts.join(" "),/CTCAC/); assert.match(x.AR.conflicts.join(" "),/HOTMA/); });
test("remains fail-closed and VP-gated", () => { assert.match(batch.status,/^BLOCKED_/); assert.equal(batch.enterprise_activation_requires,"VP_COMPLIANCE_PROPERTY_FIGURE_VERIFICATION"); assert.ok(batch.activation_requirements.includes("conflict resolution")); });
