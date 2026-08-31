/**
 * Pure build-identity helpers for the anonymous health endpoint.
 * Only immutable, non-secret build identifiers are ever exposed.
 */

export const HEALTH_SERVICE_NAME = "certivoiq-web";

const SOURCE_REVISION_PATTERN = /^[0-9a-fA-F]{40}$/;
const DEPLOYMENT_ID_PATTERN = /^[0-9A-Za-z._:-]{8,128}$/;

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSourceRevision(value) {
  const candidate = trimmed(value);
  return SOURCE_REVISION_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function normalizeDeploymentId(value) {
  const candidate = trimmed(value);
  return DEPLOYMENT_ID_PATTERN.test(candidate) ? candidate : null;
}

/** Builds the health payload. Never echoes invalid or unrecognized input. */
export function buildHealthPayload(env) {
  const source = env ?? {};
  const sourceRevision = normalizeSourceRevision(source.CERTIVOIQ_SOURCE_REVISION);
  const deploymentId = normalizeDeploymentId(source.CERTIVOIQ_DEPLOYMENT_ID);

  if (!sourceRevision || !deploymentId) {
    return {
      status: 503,
      body: { ok: false, status: "misconfigured", service: HEALTH_SERVICE_NAME },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      status: "ok",
      service: HEALTH_SERVICE_NAME,
      sourceRevision,
      deploymentId,
    },
  };
}

export function healthResponseHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
}
