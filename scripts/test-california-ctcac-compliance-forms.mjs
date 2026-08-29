import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveCaliforniaCtcacForms } from "../src/lib/california-ctcac-form-applicability.mjs";

const config = JSON.parse(readFileSync(
  new URL("../config/california-ctcac-compliance-forms.json", import.meta.url),
  "utf8",
));
const evidence = JSON.parse(readFileSync(
  new URL("../artifacts/california-ctcac-compliance-forms.json", import.meta.url),
  "utf8",
));

test("registers the complete official CTCAC index, memo, and 24 forms", () => {
  assert.equal(config.sources.length, 26);
  assert.equal(new Set(config.sources.map((source) => source.url)).size, 26);
  const counts = Object.fromEntries(
    Object.entries(Object.groupBy(config.sources, (source) => source.scope))
      .map(([scope, sources]) => [scope, sources.length]),
  );
  assert.deepEqual(counts, {
    SOURCE_INDEX: 1,
    CONTROLLING_GUIDANCE: 1,
    REQUIRED_HOUSEHOLD: 6,
    PROJECT_REPORTING: 3,
    PROJECT_LIFECYCLE: 1,
    CONDITIONAL_HOUSEHOLD: 10,
    HOTMA_HOUSEHOLD: 4,
  });
  assert.ok(config.sources.every((source) => source.allowedHosts.every((host) => host.endsWith("treasurer.ca.gov"))));
  assert.equal(config.complianceActivationAllowed, false);
  assert.equal(config.independentValidationRequired, true);
});

test("records exact-byte capture without representing independent validation", () => {
  assert.equal(evidence.sourceCount, 26);
  assert.equal(evidence.capturedCount, 26);
  assert.equal(evidence.blockedCount, 0);
  assert.equal(evidence.complianceActivationAllowed, false);
  assert.equal(evidence.independentValidationRequired, true);
  for (const source of evidence.sources) {
    assert.equal(source.captureStatus, "captured_unvalidated");
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.ok(source.byteSize > 0);
    assert.ok(source.finalUrl.startsWith("https://"));
  }
});

test("legacy and full HOTMA profiles choose mutually exclusive core forms", () => {
  const legacy = resolveCaliforniaCtcacForms({
    certificationEffectiveDate: "2026-12-31",
    hotmaImplementation: "legacy",
    triggers: [],
  });
  assert.ok(legacy.requiredSourceTypes.includes("CTCAC_TENANT_INCOME_CERTIFICATION_LEGACY"));
  assert.ok(!legacy.requiredSourceTypes.includes("CTCAC_HOTMA_TENANT_INCOME_CERTIFICATION"));

  const full = resolveCaliforniaCtcacForms({
    certificationEffectiveDate: "2026-12-31",
    hotmaImplementation: "full",
    triggers: [],
  });
  assert.ok(full.requiredSourceTypes.includes("CTCAC_HOTMA_TENANT_INCOME_CERTIFICATION"));
  assert.ok(!full.requiredSourceTypes.includes("CTCAC_TENANT_INCOME_CERTIFICATION_LEGACY"));
});

test("January 2027 forces the mandatory HOTMA profile", () => {
  const result = resolveCaliforniaCtcacForms({
    certificationEffectiveDate: "2027-01-01",
    hotmaImplementation: "legacy",
    triggers: ["STUDENT_FINANCIAL_AID_REPORTED"],
  });
  assert.equal(result.resolvedHotmaImplementation, "mandatory");
  assert.equal(result.mandatoryHotmaApplied, true);
  assert.ok(result.requiredSourceTypes.includes("CTCAC_HOTMA_52787_ASSET_CERTIFICATION"));
  assert.ok(result.requiredSourceTypes.includes("CTCAC_HOTMA_STUDENT_FINANCIAL_AID_VERIFICATION"));
});

test("conditional evidence is trigger-driven and partial HOTMA fails to Manual Review", () => {
  const result = resolveCaliforniaCtcacForms({
    certificationEffectiveDate: "2026-10-01",
    hotmaImplementation: "partial",
    hotmaComponents: ["annual_income"],
    triggers: ["EMPLOYMENT_INCOME_REPORTED", "LIVE_IN_AIDE_REPORTED"],
  });
  assert.equal(result.manualReviewRequired, true);
  assert.ok(result.requiredSourceTypes.includes("CTCAC_VERIFICATION_OF_EMPLOYMENT"));
  assert.ok(result.requiredSourceTypes.includes("CTCAC_LIVE_IN_AIDE_VERIFICATION"));
  assert.throws(() => resolveCaliforniaCtcacForms({
    certificationEffectiveDate: "2026-10-01",
    hotmaImplementation: "partial",
  }), /partial_hotma_components_required/);
});

test("project reporting forms never enter household required forms", () => {
  const result = resolveCaliforniaCtcacForms({
    certificationEffectiveDate: "2027-02-01",
    hotmaImplementation: "mandatory",
    triggers: [],
  });
  for (const source of result.projectReportingSourceTypes) {
    assert.ok(!result.requiredSourceTypes.includes(source));
  }
});
