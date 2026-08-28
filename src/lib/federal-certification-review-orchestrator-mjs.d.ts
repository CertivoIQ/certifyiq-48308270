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
  import type { HotmaApplicabilityInput, HotmaApplicabilityResult } from "@/lib/hotma-applicability-gate.mjs";

  export const FEDERAL_REVIEW_ORCHESTRATOR_BUILD: string;
  export const FEDERAL_REVIEW_PACK_VERSION: string;

  export interface FederalCertificationReviewInput {
    facts: readonly ExtractedFact[];
    programs?: readonly CertificationProgram[];
    certificationType?: "INITIAL" | "ANNUAL" | "INTERIM";
    jurisdiction?: string;
    statePack?: StatePackInput | null;
    hotmaApplicable?: boolean;
    hotmaApplicabilityInput?: HotmaApplicabilityInput;
    tenantFileInput?: Record<string, unknown>;
    layeredProgramInput?: Record<string, unknown>;
    recertificationInput?: Record<string, unknown>;
    mfhHotmaInput?: Omit<MfhHotmaReviewInput, "module_id">;
    phaHotmaInput?: Omit<PhaHotmaImplementationInput, "module_id" | "program">;
  }

  export interface FederalCertificationReviewResult extends EvaluationResult {
    programs: CertificationProgram[];
    findings: EngineFinding[];
    controlResults: {
      tenantEligibility: Record<string, unknown>;
      hotmaApplicability: HotmaApplicabilityResult | null;
      recertification: Record<string, unknown> | null;
      layeredPrograms: Record<string, unknown> | null;
      mfhHotma: MfhHotmaAllModuleResult | null;
      phaHotma: Array<PhaHotmaAllModuleResult & { program: string }> | null;
    };
  }

  export function evaluateFederalCertificationReview(
    input?: FederalCertificationReviewInput,
  ): FederalCertificationReviewResult;
}
