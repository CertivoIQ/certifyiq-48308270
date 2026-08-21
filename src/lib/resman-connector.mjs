export const RESMAN_PROVIDER = "ResMan";

export const RESMAN_ENDPOINTS = Object.freeze({
  accountId: "Account/GetAccountID",
  properties: "Account/GetProperties",
  residents: "Leasing/GetApplicantsAndCurrentResidents",
  currentResidents: "Leasing/GetCurrentResidents",
});

export const RESMAN_READINESS_STAGES = Object.freeze([
  "partner_application",
  "development_instance",
  "credentials_configured",
  "health_check",
  "reconciliation",
  "live",
]);

function requiredString(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function pick(record, keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && String(record[key]).trim() !== "") {
      return record[key];
    }
  }
  return null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function validateResManConfig(config = {}) {
  const errors = [];
  for (const [key, label] of [
    ["baseUrl", "API base URL"],
    ["partnerId", "Integration Partner ID"],
    ["apiKey", "API key"],
  ]) {
    if (!String(config[key] ?? "").trim()) errors.push({ field: key, message: `${label} is required.` });
  }
  if (config.baseUrl) {
    try {
      const url = new URL(config.baseUrl);
      if (url.protocol !== "https:" && url.hostname !== "localhost") {
        errors.push({ field: "baseUrl", message: "ResMan API base URL must use HTTPS." });
      }
    } catch {
      errors.push({ field: "baseUrl", message: "ResMan API base URL is invalid." });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function createResManBasicAuthorization(partnerId, apiKey) {
  const username = requiredString(partnerId, "Integration Partner ID");
  const password = requiredString(apiKey, "API key");
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

export function buildResManRequest(config, endpoint, payload = {}) {
  const validation = validateResManConfig(config);
  if (!validation.ok) throw new Error(validation.errors.map((error) => error.message).join(" "));
  if (!Object.values(RESMAN_ENDPOINTS).includes(endpoint)) {
    throw new Error("ResMan endpoint is outside the approved CertivoIQ connector scope.");
  }
  const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  return {
    url: new URL(endpoint, baseUrl).toString(),
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: createResManBasicAuthorization(config.partnerId, config.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  };
}

export function normalizeResManProperty(record) {
  const externalId = pick(record, ["PropertyID", "PropertyId", "propertyId", "ID", "Id"]);
  if (externalId === null) throw new Error("ResMan property record is missing its external ID.");
  return {
    provider: RESMAN_PROVIDER,
    externalId: String(externalId),
    name: String(pick(record, ["PropertyName", "Name", "name"]) ?? "").trim() || null,
    code: String(pick(record, ["PropertyCode", "Code", "code"]) ?? "").trim() || null,
    address: {
      line1: String(pick(record, ["Address1", "Address", "address1"]) ?? "").trim() || null,
      city: String(pick(record, ["City", "city"]) ?? "").trim() || null,
      state: String(pick(record, ["State", "state"]) ?? "").trim() || null,
      postalCode: String(pick(record, ["Zip", "PostalCode", "postalCode"]) ?? "").trim() || null,
    },
  };
}

export function normalizeResManResident(record) {
  const externalId = pick(record, ["ResidentID", "ResidentId", "residentId", "ID", "Id"]);
  if (externalId === null) throw new Error("ResMan resident record is missing its external ID.");
  const propertyId = pick(record, ["PropertyID", "PropertyId", "propertyId"]);
  return {
    provider: RESMAN_PROVIDER,
    externalId: String(externalId),
    propertyExternalId: propertyId === null ? null : String(propertyId),
    unitExternalId: String(pick(record, ["UnitID", "UnitId", "unitId", "UnitNumber"]) ?? "").trim() || null,
    firstName: String(pick(record, ["FirstName", "firstName"]) ?? "").trim() || null,
    lastName: String(pick(record, ["LastName", "lastName"]) ?? "").trim() || null,
    status: String(pick(record, ["Status", "ResidentStatus", "status"]) ?? "").trim() || null,
    moveInAt: parseDate(pick(record, ["MoveInDate", "moveInDate"])),
    moveOutAt: parseDate(pick(record, ["MoveOutDate", "moveOutDate"])),
  };
}

export function extractResManRecords(response) {
  if (Array.isArray(response)) return response;
  for (const key of ["data", "Data", "results", "Results", "records", "Records"]) {
    if (Array.isArray(response?.[key])) return response[key];
  }
  return [];
}

export function reconcileResManSync({ sourceRecords, normalizedRecords, rejectedRecords = 0 }) {
  const keys = normalizedRecords.map((record) => record.externalId);
  return {
    provider: RESMAN_PROVIDER,
    sourceCount: sourceRecords.length,
    normalizedCount: normalizedRecords.length,
    rejectedCount: rejectedRecords,
    countsMatch: sourceRecords.length === normalizedRecords.length + rejectedRecords,
    externalIdsUnique: new Set(keys).size === keys.length,
    passed:
      sourceRecords.length === normalizedRecords.length + rejectedRecords &&
      new Set(keys).size === keys.length &&
      rejectedRecords === 0,
  };
}

export function publicResManReadiness({ credentialsConfigured = false, healthCheckPassed = false, reconciliationPassed = false } = {}) {
  if (reconciliationPassed && healthCheckPassed && credentialsConfigured) return "live";
  if (healthCheckPassed && credentialsConfigured) return "reconciliation_pending";
  if (credentialsConfigured) return "health_check_pending";
  return "credentials_pending";
}
