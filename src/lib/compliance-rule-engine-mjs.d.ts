declare module "@/lib/compliance-rule-engine.mjs" {
  export const ENGINE_BUILD: string;
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

  export const FEDERAL_LIHTC_PACK: RulePack;

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
    statePack?: StatePackInput | null;
    jurisdiction?: string;
    minimumConfidence?: number;
  }): EvaluationResult;

  export function signOffAllowed(result: EvaluationResult): boolean;
}
