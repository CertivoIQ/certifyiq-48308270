declare module "@/lib/compliance-procedure-registry.mjs" {
  import type { StatePackInput } from "@/lib/compliance-rule-engine.mjs";

  export const COMPLIANCE_PROCEDURE_REGISTRY_BUILD: string;
  export const COMPLIANCE_PROCEDURE_SCAN_MODE: Readonly<{
    blockerInventory: "BLOCKER_INVENTORY";
    notApplicable: "NOT_APPLICABLE";
  }>;

  export type ComplianceProcedureScanMode =
    | "BLOCKER_INVENTORY"
    | "NOT_APPLICABLE";

  export interface ComplianceProcedureDescriptor {
    id: string;
    name: string;
    title: string;
    category: string;
    jurisdiction: string;
    program: "LIHTC";
    engineBuild: string;
    effectiveFrom: string | null;
    citation: string;
  }

  export interface TrustedSourceBoundEventDate {
    value: string;
    provenance: "SERVER_RECORD";
    sourceRecordId: string;
    sourceDocumentRef: string;
    sourceSha256: string;
    humanVerified: true;
  }

  export interface ComplianceProcedureBlockedFinding {
    procedureId: string;
    procedureName: string;
    procedureCategory: string;
    procedureProgram: "LIHTC";
    ruleId: string;
    ruleVersion: string;
    rulePackId: string;
    rulePackVersion: string;
    jurisdiction: string;
    severity: "critical";
    citation: string;
    engineBuild: string;
    evidenceStatus: "NOT_DETERMINED";
    ruleEvaluationStatus: "BLOCKED";
    status: "UNABLE_TO_DETERMINE";
    explanation: string;
    blockingReasons: string[];
    evidenceRefs: never[];
    humanApprovalRequired: true;
    inventoryOnly: true;
  }

  export interface ComplianceProcedureScanInput {
    programs?: readonly string[];
    stateCode?: string;
    jurisdiction?: string;
    statePack?: StatePackInput | null;
    recertificationInput?: Record<string, unknown>;
    /**
     * Server-built only. Raw eventDate fields and extracted client facts are
     * intentionally ignored.
     */
    trustedEventDate?: TrustedSourceBoundEventDate;
  }

  export interface ComplianceProcedureScanResult {
    registryBuild: string;
    mode: ComplianceProcedureScanMode;
    inventoryOnly: true;
    evaluationReady: false;
    baseline: Record<string, unknown>;
    stateCode: string | null;
    selectedProcedureCount: number;
    evaluatedProcedureCount: 0;
    findings: ComplianceProcedureBlockedFinding[];
  }

  export function listComplianceProcedures(filters?: {
    stateCode?: string;
    category?: string;
  }): ComplianceProcedureDescriptor[];

  export function scanRecertificationComplianceProcedures(
    input?: ComplianceProcedureScanInput,
  ): ComplianceProcedureScanResult;
}
