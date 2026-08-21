import {
  RESMAN_ENDPOINTS,
  buildResManRequest,
  extractResManRecords,
  normalizeResManProperty,
  normalizeResManResident,
  reconcileResManSync,
  validateResManConfig,
} from "./resman-connector.mjs";

type ResManEnvironment = {
  RESMAN_API_BASE_URL?: string;
  RESMAN_INTEGRATION_PARTNER_ID?: string;
  RESMAN_API_KEY?: string;
  RESMAN_ACCOUNT_ID?: string;
};

export function getResManServerConfig(environment: ResManEnvironment = process.env) {
  return {
    baseUrl: environment.RESMAN_API_BASE_URL,
    partnerId: environment.RESMAN_INTEGRATION_PARTNER_ID,
    apiKey: environment.RESMAN_API_KEY,
    accountId: environment.RESMAN_ACCOUNT_ID,
  };
}

export function getResManConfigurationStatus(environment: ResManEnvironment = process.env) {
  const config = getResManServerConfig(environment);
  const validation = validateResManConfig(config);
  return {
    configured: validation.ok,
    missing: validation.errors.map((error) => error.field),
    accountIdConfigured: Boolean(config.accountId),
  };
}

async function requestResMan(endpoint: string, payload: Record<string, unknown>, environment: ResManEnvironment, fetchImpl: typeof fetch) {
  const config = getResManServerConfig(environment);
  const request = buildResManRequest(config, endpoint, payload);
  const response = await fetchImpl(request.url, { ...request.init, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`ResMan request failed with HTTP ${response.status}. Provider response was not persisted.`);
  }
  return response.json();
}

export async function testResManConnection(environment: ResManEnvironment = process.env, fetchImpl: typeof fetch = fetch) {
  const config = getResManServerConfig(environment);
  const validation = validateResManConfig(config);
  if (!validation.ok) return { ok: false, message: "ResMan credentials are not configured.", missing: validation.errors.map((error) => error.field) };
  await requestResMan(RESMAN_ENDPOINTS.accountId, {}, environment, fetchImpl);
  return { ok: true, message: "ResMan authentication health check passed.", missing: [] };
}

export async function importResManProperties(environment: ResManEnvironment = process.env, fetchImpl: typeof fetch = fetch) {
  const config = getResManServerConfig(environment);
  const payload = config.accountId ? { AccountID: config.accountId } : {};
  const rawResponse = await requestResMan(RESMAN_ENDPOINTS.properties, payload, environment, fetchImpl);
  const sourceRecords = extractResManRecords(rawResponse);
  const records = [];
  let rejectedRecords = 0;
  for (const sourceRecord of sourceRecords) {
    try { records.push(normalizeResManProperty(sourceRecord)); } catch { rejectedRecords += 1; }
  }
  return { records, reconciliation: reconcileResManSync({ sourceRecords, normalizedRecords: records, rejectedRecords }) };
}

export async function importResManResidents(environment: ResManEnvironment = process.env, fetchImpl: typeof fetch = fetch) {
  const config = getResManServerConfig(environment);
  const payload = config.accountId ? { AccountID: config.accountId } : {};
  const rawResponse = await requestResMan(RESMAN_ENDPOINTS.residents, payload, environment, fetchImpl);
  const sourceRecords = extractResManRecords(rawResponse);
  const records = [];
  let rejectedRecords = 0;
  for (const sourceRecord of sourceRecords) {
    try { records.push(normalizeResManResident(sourceRecord)); } catch { rejectedRecords += 1; }
  }
  return { records, reconciliation: reconcileResManSync({ sourceRecords, normalizedRecords: records, rejectedRecords }) };
}
