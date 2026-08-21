import assert from "node:assert/strict";
import test from "node:test";
import {
  RESMAN_ENDPOINTS,
  buildResManRequest,
  normalizeResManProperty,
  normalizeResManResident,
  publicResManReadiness,
  reconcileResManSync,
  validateResManConfig,
} from "../src/lib/resman-connector.mjs";

const config = { baseUrl: "https://api.example.test/v1", partnerId: "partner-id", apiKey: "secret-key" };

test("requires HTTPS ResMan credentials and never accepts an unknown endpoint", () => {
  assert.equal(validateResManConfig({}).ok, false);
  assert.equal(validateResManConfig({ ...config, baseUrl: "http://api.example.test" }).ok, false);
  assert.equal(validateResManConfig(config).ok, true);
  assert.throws(() => buildResManRequest(config, "Accounting/DeleteEverything"));
});

test("builds a Basic-auth request only for approved ResMan endpoints", () => {
  const request = buildResManRequest(config, RESMAN_ENDPOINTS.properties, { AccountID: "account-1" });
  assert.equal(request.url, "https://api.example.test/v1/Account/GetProperties");
  assert.equal(request.init.method, "POST");
  assert.match(request.init.headers.Authorization, /^Basic /);
  assert.doesNotMatch(request.url, /secret-key|partner-id/);
  assert.equal(JSON.parse(request.init.body).AccountID, "account-1");
});

test("normalizes ResMan property and resident records", () => {
  const property = normalizeResManProperty({ PropertyID: 42, PropertyName: "Meridian Gardens", PropertyCode: "MG01", City: "Nashville", State: "TN" });
  assert.deepEqual({ id: property.externalId, name: property.name, code: property.code }, { id: "42", name: "Meridian Gardens", code: "MG01" });
  const resident = normalizeResManResident({ ResidentID: "R-7", PropertyID: 42, UnitNumber: "204", FirstName: "Jordan", LastName: "Taylor", MoveInDate: "2026-08-01" });
  assert.equal(resident.propertyExternalId, "42");
  assert.equal(resident.unitExternalId, "204");
  assert.equal(resident.moveInAt, "2026-08-01T00:00:00.000Z");
  assert.throws(() => normalizeResManProperty({ PropertyName: "Missing ID" }));
});

test("requires exact count and unique IDs before reconciliation passes", () => {
  const passed = reconcileResManSync({ sourceRecords: [{}, {}], normalizedRecords: [{ externalId: "1" }, { externalId: "2" }] });
  assert.equal(passed.passed, true);
  assert.equal(reconcileResManSync({ sourceRecords: [{}, {}], normalizedRecords: [{ externalId: "1" }, { externalId: "1" }] }).passed, false);
  assert.equal(reconcileResManSync({ sourceRecords: [{}, {}], normalizedRecords: [{ externalId: "1" }], rejectedRecords: 1 }).passed, false);
});

test("readiness cannot become live without credentials, health check, and reconciliation", () => {
  assert.equal(publicResManReadiness(), "credentials_pending");
  assert.equal(publicResManReadiness({ credentialsConfigured: true }), "health_check_pending");
  assert.equal(publicResManReadiness({ credentialsConfigured: true, healthCheckPassed: true }), "reconciliation_pending");
  assert.equal(publicResManReadiness({ credentialsConfigured: true, healthCheckPassed: true, reconciliationPassed: true }), "live");
});
