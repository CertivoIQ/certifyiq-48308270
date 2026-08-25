declare module "@/lib/compliance-rule-engine.mjs" {
  export const ENGINE_BUILD: string;
  export const LAYERED_ENGINE_BUILD: string;
  export const LAYERED_RULE_ID: "FED-LAYERED-PROGRAM-RESTRICTIONS-001";
  export const TENANT_ELIGIBILITY_ENGINE_BUILD: string;
  export const TENANT_ELIGIBILITY_RULE_ID:
    "FED-TENANT-FILE-ELIGIBILITY-RECONCILIATION-001";
  export const RECERTIFICATION_OCCUPANCY_ENGINE_BUILD: string;
  export const RECERTIFICATION_OCCUPANCY_RULE_ID:
    "FED-RECERTIFICATION-OCCUPANCY-CONTROLS-001";
  export const ENTERPRISE_PROJECT_AUTHORITY_ENGINE_BUILD: string;
  export const STATE_RULE_PACK_RELEASE_ENGINE_BUILD: string;
  export const MINIMUM_CONFIDENCE: number;
  export const REVIEW_DECISIONS: readonly ReviewDecision[];

  export type FindingStatus = "PASS" | "FAIL" | "UNABLE_TO_DETERMINE";
  export type EvidenceStatus = "RESOLVED" | "CONFLICTING" | "NOT_DETERMINED";
  export type RuleEvaluationStatus = "EVALUATED" | "BLOCKED";
  export type ReviewDecision =
    "approved" | "remediation_requested" | "unable_to_determine";

  export const FINDING_STATUS: {
    pass: "PASS";
    fail: "FAIL";
    unableToDetermine: "UNABLE_TO_DETERMINE";
  };
  export const EVIDENCE_STATUS: {
    resolved: "RESOLVED";
    conflicting: "CONFLICTING";
    notDetermined: "NOT_DETERMINED";
  };
  export const RULE_EVALUATION_STATUS: {
    evaluated: "EVALUATED";
    blocked: "BLOCKED";
  };

  export interface ExtractedFact {
    field: string;
    value: unknown;
    sourceDocumentRef: string;
    page: number | null;
    snippet: string | null;
    confidence: number;
    humanVerified: boolean;
    requiredForDecision?: boolean;
    provider?: string;
  }

  export interface EvidenceRef {
    field: string;
    documentRef: string | null;
    page: number | null;
    snippet: string | null;
    confidence: number;
    humanVerified: boolean;
  }

  export interface EngineFinding {
    ruleId: string;
    ruleVersion: string;
    rulePackId: string;
    rulePackVersion: string;
    jurisdiction: string;
    severity: "critical" | "major" | "minor" | "info";
    citation: string;
    engineBuild: string;
    evidenceStatus: EvidenceStatus;
    ruleEvaluationStatus: RuleEvaluationStatus;
    status: FindingStatus;
    explanation: string;
    blockingReasons: string[];
    evidenceRefs: EvidenceRef[];
  }

  export interface RulePack {
    id: string;
    version: string;
    jurisdiction: string;
    status: string;
    effectiveFrom: string;
    rules: readonly {
      id: string;
      version: string;
      jurisdiction: "federal" | "state";
      severity: "critical" | "major" | "minor" | "info";
      requires: readonly string[];
      citation: string;
      description: string;
    }[];
  }

  export interface StatePackInput {
    code?: string;
    status?: string;
    version?: string | null;
    approvedBy?: string | null;
    effectiveFrom?: string | null;
    validatedRuleCount?: number;
  }

  export interface EvaluationResult {
    engineBuild: string;
    rulePackId: string;
    rulePackVersion: string;
    statePackApplied: boolean;
    findings: EngineFinding[];
    counts: { pass: number; fail: number; unableToDetermine: number };
  }

  export interface LayeredProgramResult {
    resolution_status: "COMPLETED" | "NOT_DETERMINED";
    determination_status: "PASS" | "FAIL" | "NOT_DETERMINED";
    rule_engine_authority: "ALLOWED" | "BLOCKED";
    finding: FindingStatus;
    reason_code?: string;
    missing_inputs?: string[];
    human_approval_required: true;
    human_approval_status?: "PENDING";
    [key: string]: unknown;
  }

  export interface TenantFileEligibilityResult {
    resolution_status: "COMPLETED" | "NOT_DETERMINED";
    determination_status: "PASS" | "FAIL" | "NOT_DETERMINED";
    rule_engine_authority: "ALLOWED" | "BLOCKED";
    finding: FindingStatus;
    reason_code?: string;
    missing_inputs?: string[];
    agent_approval_required: true;
    agent_approval_status?: "PENDING";
    human_approval_required: true;
    [key: string]: unknown;
  }

  export interface RecertificationOccupancyResult {
    resolution_status: "COMPLETED" | "NOT_DETERMINED";
    determination_status: "PASS" | "FAIL" | "NOT_DETERMINED";
    rule_engine_authority: "ALLOWED" | "BLOCKED";
    finding: FindingStatus;
    reason_code?: string;
    blockers?: Array<Record<string, unknown>>;
    confirmed_failure_indicators?: string[];
    agent_approval_required: true;
    agent_approval_status?: "PENDING";
    human_approval_required: true;
    [key: string]: unknown;
  }

  export type CertificationProgram =
    | "LIHTC"
    | "HOME"
    | "HTF"
    | "HCV_TENANT_BASED"
    | "HUD_PBV"
    | "HUD_MFH_PROJECT_BASED"
    | "PUBLIC_HOUSING"
    | "RURAL_DEVELOPMENT"
    | "TAX_EXEMPT_BOND";

  export const CERTIFICATION_PROGRAM: Readonly<Record<string, CertificationProgram>>;
  export const FEDERAL_LIHTC_PACK: RulePack;
  export const HOTMA_ASSET_CAP_OVERLAY_PACK: RulePack;
  export const STATE_QAP_OVERLAY_PACK: RulePack;

  export function normalizeCertificationPrograms(
    programs?: CertificationProgram | readonly CertificationProgram[],
  ): CertificationProgram[];

  export function buildCertificationRulePack(input?: {
    programs?: CertificationProgram | readonly CertificationProgram[];
    hotmaApplicable?: boolean;
    jurisdiction?: string;
  }): RulePack;

  export function isStatePackUsable(pack?: StatePackInput | null): boolean;

  export function reconcileEvidenceField(
    field: string,
    fieldFacts?: readonly ExtractedFact[],
  ):
    | {
        field: string;
        status: "RESOLVED";
        fact: ExtractedFact;
        facts: ExtractedFact[];
        conflictingValues: [];
      }
    | {
        field: string;
        status: "CONFLICTING";
        fact: null;
        facts: ExtractedFact[];
        conflictingValues: Array<{ value: unknown; sources: string[] }>;
      }
    | {
        field: string;
        status: "NOT_DETERMINED";
        fact: null;
        facts: [];
        conflictingValues: [];
      };

  export function evaluateCertification(input: {
    facts: readonly ExtractedFact[];
    pack?: RulePack;
    programs?: readonly CertificationProgram[];
    hotmaApplicable?: boolean;
    statePack?: StatePackInput | null;
    jurisdiction?: string;
    minimumConfidence?: number;
  }): EvaluationResult;

  export function evaluateLayeredProgramRestrictions(
    input: Record<string, unknown>,
  ): LayeredProgramResult;

  export function evaluateTenantFileEligibility(
    input: Record<string, unknown>,
  ): TenantFileEligibilityResult;

  export function evaluateRecertificationOccupancyControls(
    input: Record<string, unknown>,
  ): RecertificationOccupancyResult;

  export function normalizeIncomeLimitDollar(
    value: string | number,
  ): string;

  export const FY2026_LIMIT_INGESTION_ENGINE_BUILD: string;
  export const FY2026_LIMIT_ACTIVATION_STATUS: {
    active: "ACTIVE";
    blocked: "BLOCKED";
  };
  export const CONTROLLED_FY2026_GEOGRAPHY_CROSSWALK: readonly Record<string, unknown>[];
  export const CONTROLLED_FY2026_INCOME_LIMIT_SOURCES: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;

  export interface Fy2026IncomeLimitActivationResult {
    activation_status: "ACTIVE" | "BLOCKED";
    rule_engine_authority: "ALLOWED" | "BLOCKED";
    finding: FindingStatus;
    reason_code?: string;
    missing_inputs?: string[];
    dataset_id?: string;
    human_approval_required: true;
    [key: string]: unknown;
  }

  export function normalizeFy2026IncomeLimitDollar(
    value: string | number,
  ): string;

  export function validateFy2026IncomeLimitRecords(
    records: readonly Record<string, unknown>[],
    options?: {
      expectedRecordCount?: number;
      expectedLegacyCrosswalkCount?: number;
    },
  ): Record<string, unknown>;

  export function evaluateFy2026IncomeLimitSourceActivation(
    input?: Record<string, unknown>,
  ): Fy2026IncomeLimitActivationResult;

  export function validateFy2026IncomeLimitProgramHandoff(
    programCode: string,
    datasetId: string,
    activationReceipt?: Record<string, unknown> | null,
  ): Record<string, unknown>;

  export const FY2026_XLSX_PARSER_BUILD: string;

  export function parseControlledFy2026Workbook(
    input?: Record<string, unknown>,
  ): Record<string, unknown>;

  export function selectFy2026IncomeLimit(
    input?: Record<string, unknown>,
  ): Record<string, unknown>;

  export function validateFy2026IncomeLimitSelection(
    programCode: string,
    datasetId: string,
    activationReceipt?: Record<string, unknown> | null,
    limitSelection?: Record<string, unknown> | null,
  ): Record<string, unknown>;

  export interface EnterpriseProjectAuthorityGateway {
    beginUploadSession(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    ingestProjectAuthorityDocuments(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    evaluateProjectAuthority(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    validateProjectAuthorityHandoff(input?: Record<string, unknown>): Record<string, unknown>;
  }

  export function createEnterpriseProjectAuthorityGateway(adapters: {
    authorizeUpload(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
    validateDocumentContent(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
    validateStatePackRelease(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
  }): EnterpriseProjectAuthorityGateway;

  export interface StateRulePackReleaseGateway {
    beginMaintenanceSession(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    ingestOfficialSources(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    createValidatedRelease(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    validateStatePackRelease(input?: Record<string, unknown>): Record<string, unknown>;
  }

  export function createStateRulePackReleaseGateway(adapters: {
    authorizeMaintainer(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
    validateSourceContent(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
    validateSourceConflicts(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
    validateRuleFixtures(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
    approveIndependentRelease(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
  }): StateRulePackReleaseGateway;

  export function signOffAllowed(result: EvaluationResult): boolean;
}
