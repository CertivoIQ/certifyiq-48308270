declare module '@/lib/build-identity.mjs' {
  export const HEALTH_SERVICE_NAME: 'certivoiq-web';
  export const HEALTH_CONTRACT_VERSION: 1;

  export interface HealthPayload {
    ok: true;
    status: 'ok';
    service: 'certivoiq-web';
    contractVersion: 1;
  }

  export interface HealthResult {
    status: 200;
    body: HealthPayload;
  }

  export function buildHealthPayload(): HealthResult;
  export function healthResponseHeaders(): Record<string, string>;
}
