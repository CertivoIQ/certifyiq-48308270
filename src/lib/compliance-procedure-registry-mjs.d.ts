declare module "@/lib/compliance-procedure-registry.mjs" {
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
    sourceTrace: readonly string[];
  }

  /**
   * Metadata gate only. It does not bind this supplied pack to any installed
   * procedure. Exact procedure/build/source-digest binding requires a future
   * immutable server-side manifest.
   */
  export interface ComplianceProcedureStatePackInput {
    id?: string;
    state_code?: string;
    jurisdiction?: string;
    code?: string;
    status?: string;
    approvedBy?: string | boolean;
    approved_by?: string | boolean;
    version?: string;
    validatedRuleCount?: number | string;
    validated_rule_count?: number | string;
    effectiveFrom?: string;
    effective_from?: string;
    effectiveTo?: string | null;
    effective_to?: string | null;
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
    procedureInventoryBuild: string;
    procedureEffectiveFrom: string | null;
    procedureSourceTrace: string[];
    ruleId: string;
    ruleVersion: string;
    rulePackId: "compliance-procedure-blocker-inventory";
    rulePackVersion: string;
    statePackBindingStatus: "UNBOUND";
    effectiveDateBindingStatus: "UNBOUND";
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
    statePack?: ComplianceProcedureStatePackInput | null;
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
