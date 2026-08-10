export type HistoricalChange = { field: string; previous: unknown; current: unknown; severity: "info" | "warning" | "critical" };
export type AuditFinding = { code: string; severity: "critical" | "major" | "minor"; title: string; evidenceIds: string[] };

/** Deterministic readiness score used by mock-audit and portfolio views. */
export function readinessScore(findings: AuditFinding[]): number {
  const deductions = findings.reduce((sum, f) => sum + (f.severity === "critical" ? 15 : f.severity === "major" ? 6 : 2), 0);
  return Math.max(0, Math.min(100, 100 - deductions));
}

/** Compare normalized certification fields without treating formatting changes as findings. */
export function compareCertificationHistory(previous: Record<string, unknown>, current: Record<string, unknown>): HistoricalChange[] {
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: HistoricalChange[] = [];
  for (const field of keys) {
    const a = previous[field]; const b = current[field];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const severity = a == null || b == null ? "critical" : "warning";
    changes.push({ field, previous: a ?? null, current: b ?? null, severity });
  }
  return changes;
}

/** Stable duplicate key for a file; callers should provide a cryptographic SHA-256. */
export function certificationDuplicateKey(organizationId: string, sha256: string): string {
  return `${organizationId}:${sha256.toLowerCase()}`;
}

/** Human approval is mandatory before any authority submission can transition to submitted. */
export function canSubmitAuthorityCertification(input: { status: string; approvalRequired: boolean; approvedBy?: string | null; approvedAt?: string | null }): boolean {
  if (input.status !== "approved" || !input.approvalRequired) return false;
  return Boolean(input.approvedBy && input.approvedAt);
}

export const ANNUAL_BILLING_NOTE = "Annual billing is 20% off for the initial annual signup only; renewals use the full annual price.";
