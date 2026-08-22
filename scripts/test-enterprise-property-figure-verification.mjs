import assert from "node:assert/strict";
import test from "node:test";
import { createEnterprisePropertyFigureVerificationGateway } from "../src/lib/enterprise-property-figure-verification.mjs";

const baseline = { validation_status:"VALIDATED", source_sha256:"a".repeat(64), effective_from:"2026-05-01", figures:{ income_50:50000, rent_1br:1200 } };
const gateway = (authorized=true) => createEnterprisePropertyFigureVerificationGateway({
 authorizeVpCompliance: async () => ({ authorized, role:"VP_COMPLIANCE", enterprise_id:"ent-1", user_id:"vp-1", approved_at:"2026-08-22T19:00:00Z", allowed_property_ids:["prop-1"] }),
 validatePropertyAuthority: async (o) => ({ validation_status:"VALIDATED", property_id:o.property_id, source_sha256:o.source_sha256, authority_type:"LURA" })
});

test("requires enterprise VP of Compliance approval", async()=>{ const r=await gateway(false).verify({official_baseline:baseline,enterprise_id:"ent-1",property_id:"prop-1"}); assert.equal(r.reason_code,"ENTERPRISE_VP_COMPLIANCE_APPROVAL_REQUIRED"); });
test("blocks unresolved differences from CertivoIQ figures", async()=>{ const r=await gateway().verify({official_baseline:baseline,enterprise_id:"ent-1",property_id:"prop-1",observed_figures:{income_50:49000,rent_1br:1200},approval_decision:"APPROVE"}); assert.equal(r.reason_code,"PROPERTY_FIGURE_MISMATCH_UNRESOLVED"); });
test("rejects unsupported or less restrictive property changes", async()=>{ const r=await gateway().verify({official_baseline:baseline,enterprise_id:"ent-1",property_id:"prop-1",observed_figures:{income_50:51000,rent_1br:1200},property_overlays:[{figure_code:"income_50",value:51000,source_sha256:"b".repeat(64)}],approval_decision:"APPROVE"}); assert.equal(r.reason_code,"PROPERTY_OVERLAY_NOT_MORE_RESTRICTIVE"); });
test("approves source-bound, more restrictive property figures", async()=>{ const g=gateway(); const r=await g.verify({official_baseline:baseline,enterprise_id:"ent-1",property_id:"prop-1",observed_figures:{income_50:49000,rent_1br:1200},property_overlays:[{figure_code:"income_50",value:49000,source_sha256:"b".repeat(64)}],approval_decision:"APPROVE"}); assert.equal(r.status,"APPROVED"); assert.equal(r.effective_figures.income_50,49000); assert.equal(g.validate({receipt:r,official_source_sha256:baseline.source_sha256,enterprise_id:"ent-1",property_id:"prop-1"}).status,"APPROVED"); });
test("requires reapproval when the official source changes", async()=>{ const g=gateway(); const r=await g.verify({official_baseline:baseline,enterprise_id:"ent-1",property_id:"prop-1",observed_figures:baseline.figures,approval_decision:"APPROVE"}); assert.equal(g.validate({receipt:r,official_source_sha256:"c".repeat(64),enterprise_id:"ent-1",property_id:"prop-1"}).reason_code,"CURRENT_PROPERTY_VERIFICATION_REQUIRED"); });
