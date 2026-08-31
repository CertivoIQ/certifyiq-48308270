declare module '@/lib/build-identity.mjs' {
  export const HEALTH_SERVICE_NAME: 'certivoiq-web';

  export interface HealthEnvironment {
    CERTIVOIQ_SOURCE_REVISION?: string | undefined;
    CERTIVOIQ_DEPLOYMENT_ID?: string | undefined;
  }

  export type HealthPayload =
    | { ok: false; status: 'misconfigured'; service: 'certivoiq-web' }
    | {
        ok: true;
        status: 'ok';
        service: 'certivoiq-web';
        sourceRevision: string;
        deploymentId: string;
      };

  export interface HealthResult {
    status: 200 | 503;
    body: HealthPayload;
  }

  export function normalizeSourceRevision(value: unknown): string | null;
  export function normalizeDeploymentId(value: unknown): string | null;
  export function buildHealthPayload(env: HealthEnvironment | undefined): HealthResult;
  export function healthResponseHeaders(): Record<string, string>;
}
