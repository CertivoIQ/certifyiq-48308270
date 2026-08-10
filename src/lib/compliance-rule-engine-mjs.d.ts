declare module '@/lib/compliance-rule-engine.mjs' {
  export const ENGINE_BUILD: string;
  export const MINIMUM_CONFIDENCE: number;
  export const REVIEW_DECISIONS: readonly ReviewDecision[];

  export type FindingStatus = 'PASS' | 'FAIL' | 'UNABLE_TO_DETERMINE';
  export type ReviewDecision = 'approved' | 'remediation_requested' | 'unable_to_determine';

  export const FINDING_STATUS: {
    pass: 'PASS';
    fail: 'FAIL';
    unableToDetermine: 'UNABLE_TO_DETERMINE';
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
    severity: 'critical' | 'major' | 'minor' | 'info';
    citation: string;
    engineBuild: string;
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
      jurisdiction: 'federal' | 'state';
      severity: 'critical' | 'major' | 'minor' | 'info';
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

  export const FEDERAL_LIHTC_PACK: RulePack;

  export function isStatePackUsable(pack?: StatePackInput | null): boolean;

  export function evaluateCertification(input: {
    facts: readonly ExtractedFact[];
    pack?: RulePack;
    statePack?: StatePackInput | null;
    jurisdiction?: string;
    minimumConfidence?: number;
  }): EvaluationResult;

  export function signOffAllowed(result: EvaluationResult): boolean;
}
