export const RESMAN_PROVIDER: "ResMan";
export const RESMAN_ENDPOINTS: Readonly<Record<"accountId" | "properties" | "residents" | "currentResidents", string>>;
export const RESMAN_READINESS_STAGES: readonly string[];
export type ResManConfig = { baseUrl?: string; partnerId?: string; apiKey?: string };
export function validateResManConfig(config?: ResManConfig): { ok: boolean; errors: Array<{ field: string; message: string }> };
export function createResManBasicAuthorization(partnerId: string, apiKey: string): string;
export function buildResManRequest(config: ResManConfig, endpoint: string, payload?: Record<string, unknown>): { url: string; init: RequestInit };
export function normalizeResManProperty(record: Record<string, unknown>): {
  provider: "ResMan"; externalId: string; name: string | null; code: string | null;
  address: { line1: string | null; city: string | null; state: string | null; postalCode: string | null };
};
export function normalizeResManResident(record: Record<string, unknown>): {
  provider: "ResMan"; externalId: string; propertyExternalId: string | null; unitExternalId: string | null;
  firstName: string | null; lastName: string | null; status: string | null; moveInAt: string | null; moveOutAt: string | null;
};
export function extractResManRecords(response: unknown): Record<string, unknown>[];
export function reconcileResManSync(input: { sourceRecords: unknown[]; normalizedRecords: Array<{ externalId: string }>; rejectedRecords?: number }): {
  provider: "ResMan"; sourceCount: number; normalizedCount: number; rejectedCount: number; countsMatch: boolean; externalIdsUnique: boolean; passed: boolean;
};
export function publicResManReadiness(input?: { credentialsConfigured?: boolean; healthCheckPassed?: boolean; reconciliationPassed?: boolean }): "credentials_pending" | "health_check_pending" | "reconciliation_pending" | "live";
