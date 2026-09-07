/**
 * Stable public liveness and non-sensitive deployment identity contract.
 */

export const HEALTH_SERVICE_NAME = "certivoiq-web";
export const HEALTH_CONTRACT_VERSION = 2;

const definedBuildSha =
  typeof __CERTIVOIQ_BUILD_SHA__ === "string" ? __CERTIVOIQ_BUILD_SHA__ : "development";

export const RELEASE_SHA = /^[0-9a-f]{40}$/i.test(definedBuildSha)
  ? definedBuildSha.toLowerCase()
  : "development";

export function buildHealthPayload() {
  return {
    status: 200,
    body: {
      ok: true,
      status: "ok",
      service: HEALTH_SERVICE_NAME,
      contractVersion: HEALTH_CONTRACT_VERSION,
      releaseSha: RELEASE_SHA,
    },
  };
}

export function healthResponseHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-certivoiq-release-sha": RELEASE_SHA,
  };
}
