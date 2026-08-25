declare module "@/lib/federal-certification-review-orchestrator.mjs" {
  import type {
    CertificationProgram,
    EngineFinding,
    EvaluationResult,
    ExtractedFact,
    StatePackInput,
  } from "@/lib/compliance-rule-engine.mjs";

  export const FEDERAL_REVIEW_ORCHESTRATOR_BUILD: string;
  export const FEDERAL_REVIEW_PACK_VERSION: string;

  export interface FederalCertificationReviewInput {
    facts: readonly ExtractedFact[];
    programs?: readonly CertificationProgram[];
    certificationType?: "INITIAL" | "ANNUAL" | "INTERIM";
    jurisdiction?: string;
    statePack?: StatePackInput | null;
    hotmaApplicable?: boolean;
    tenantFileInput?: Record<string, unknown>;
    layeredProgramInput?: Record<string, unknown>;
    recertificationInput?: Record<string, unknown>;
  }

  export interface FederalCertificationReviewResult extends EvaluationResult {
    programs: CertificationProgram[];
    findings: EngineFinding[];
    controlResults: {
      tenantEligibility: Record<string, unknown>;
      recertification: Record<string, unknown> | null;
      layeredPrograms: Record<string, unknown> | null;
    };
  }

  export function evaluateFederalCertificationReview(
    input?: FederalCertificationReviewInput,
  ): FederalCertificationReviewResult;
}
