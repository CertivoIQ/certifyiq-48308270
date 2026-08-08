/**
 * Property-management-system integration contract.
 *
 * No provider logo or "integrates with" claim may be displayed until
 * contractual/API access exists AND a production health check plus a
 * reconciliation report have passed. `AVAILABLE_CONNECTORS` is intentionally
 * empty: the first integration is the PMS used by the first pilot customer,
 * not the easiest logo to market.
 */

export interface PmsConnector {
  provider: string;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  importProperties(cursor?: string): Promise<{ records: unknown[]; nextCursor?: string }>;
  importHouseholds(cursor?: string): Promise<{ records: unknown[]; nextCursor?: string }>;
  importCertificationDocuments(cursor?: string): Promise<{ records: unknown[]; nextCursor?: string }>;
  pushReviewResult(reviewId: string): Promise<{ externalId: string }>;
}

export type ConnectorReadiness =
  | "no_agreement"
  | "credentials_pending"
  | "health_check_pending"
  | "reconciliation_pending"
  | "live";

export type ConnectorRegistryEntry = {
  provider: string;
  readiness: ConnectorReadiness;
  /** Only `live` entries may be shown publicly, with or without a logo. */
  displayPublicly: boolean;
  notes: string;
};

/** Empty until a pilot customer's PMS credentials and reconciliation exist. */
export const AVAILABLE_CONNECTORS: ConnectorRegistryEntry[] = [];

export function publicIntegrationList(
  registry: ConnectorRegistryEntry[] = AVAILABLE_CONNECTORS,
): ConnectorRegistryEntry[] {
  return registry.filter((entry) => entry.readiness === "live" && entry.displayPublicly);
}

export function assertConnectorDisplayable(entry: ConnectorRegistryEntry) {
  if (entry.readiness !== "live" || !entry.displayPublicly) {
    throw new Error(
      `${entry.provider} cannot be displayed as an integration until credentials exist and reconciliation has passed.`,
    );
  }
}

/**
 * A CSV import is migration tooling, not an integration. Kept explicit so
 * marketing copy cannot promote it as one.
 */
export const CSV_IMPORT_IS_NOT_AN_INTEGRATION = true;

export type SyncState = {
  provider: string;
  lastSuccessfulSyncAt: string | null;
  cursor: string | null;
  recordsImported: number;
  recordsReconciled: number;
  recordsFailed: number;
  lastError: string | null;
};
