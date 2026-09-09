declare module "@/lib/federal-certification-review-orchestrator.mjs" {
  import type {
    CertificationProgram,
    EngineFinding,
    EvaluationResult,
    ExtractedFact,
    StatePackInput,
  } from "@/lib/compliance-rule-engine.mjs";
  import type {
    MfhHotmaAllModuleResult,
    MfhHotmaReviewInput,
  } from "@/lib/mfh-hotma-rule-engine.mjs";
  import type {
    PhaHotmaAllModuleResult,
    PhaHotmaImplementationInput,
  } from "@/lib/pha-hotma-implementation-engine.mjs";
  import type { ComplianceProcedureScanResult } from "@/lib/compliance-procedure-registry.mjs";

  export const FEDERAL_REVIEW_ORCHESTRATOR_BUILD: string;
  export const FEDERAL_REVIEW_PACK_VERSION: string;

  export interface FederalCertificationReviewInput {
    facts: readonly ExtractedFact[];
    /** Recomputed on the server from confirmed TIC inputs and the saved worksheet method. */
    ticWorksheetCalculation?: Record<string, string> | null;
    programs?: readonly CertificationProgram[];
    certificationType?: "INITIAL" | "ANNUAL" | "INTERIM";
    jurisdiction?: string;
    statePack?: StatePackInput | null;
    hotmaApplicable?: boolean;
    tenantFileInput?: Record<string, unknown>;
    layeredProgramInput?: Record<string, unknown>;
    recertificationInput?: Record<string, unknown>;
    mfhHotmaInput?: Omit<MfhHotmaReviewInput, "module_id">;
    mfhHotmaOperationsInput?: Record<string, unknown>;
    phaHotmaInput?: Omit<PhaHotmaImplementationInput, "module_id" | "program">;
  }

  export interface FederalCertificationReviewResult extends EvaluationResult {
    programs: CertificationProgram[];
    findings: EngineFinding[];
    controlResults: {
      tenantEligibility: Record<string, unknown>;
      recertification: Record<string, unknown> | null;
      complianceProcedures: ComplianceProcedureScanResult | null;
      layeredPrograms: Record<string, unknown> | null;
      mfhHotma: MfhHotmaAllModuleResult | null;
      mfhHotmaOperations: Record<string, unknown> | null;
      phaHotma: Array<PhaHotmaAllModuleResult & { program: string }> | null;
    };
  }

  export function evaluateFederalCertificationReview(
    input?: FederalCertificationReviewInput,
  ): FederalCertificationReviewResult;
}
