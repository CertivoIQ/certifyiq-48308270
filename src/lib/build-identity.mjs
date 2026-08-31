/**
 * Stable, anonymous liveness contract for the public health endpoint.
 * Deployment identity is verified out of band from the platform response headers.
 */

export const HEALTH_SERVICE_NAME = "certivoiq-web";
export const HEALTH_CONTRACT_VERSION = 1;

export function buildHealthPayload() {
  return {
    status: 200,
    body: {
      ok: true,
      status: "ok",
      service: HEALTH_SERVICE_NAME,
      contractVersion: HEALTH_CONTRACT_VERSION,
    },
  };
}

export function healthResponseHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
}
