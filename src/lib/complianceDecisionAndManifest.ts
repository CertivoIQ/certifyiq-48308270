/**
 * Determination policy and evidence manifest schema.
 *
 * AI performs extraction and classification only. Deterministic code in this
 * module decides the outcome. When required evidence is missing, below the
 * confidence policy, unverified, or affected by an unresolved rule conflict,
 * the outcome is `unable_to_determine` — final Pass/Fail and authorized compliance approval
 * are blocked until the blocking reasons are resolved.
 */

import type { StateCoverage } from "@/lib/stateCoverageRegistry";

export function assertStatePackValidated(pack: StateCoverage) {
  if (
    pack.status !== "validated" ||
    !pack.reviewedBy ||
    !pack.effectiveDate ||
    pack.validatedRuleCount < 1
  ) {
    throw new Error(`${pack.code} state-specific compliance pack is not validated for determinations.`);
  }
}

export type ReviewOutcome = "pass" | "fail" | "unable_to_determine";

export type ExtractedField = {
  name: string;
  value: unknown;
  sourceDocumentId: string;
  page: number | null;
  confidence: number;
  humanVerified: boolean;
  requiredForDecision: boolean;
};

export type DeterminationInput = {
  fields: ExtractedField[];
  failedRuleIds: string[];
  minimumConfidence: number;
  missingRequiredDocumentIds: string[];
  unresolvedRuleConflicts: string[];
  /** Set when the outcome could change if an unvalidated state rule applied. */
  stateRuleUnvalidated?: boolean;
};

export type Determination = {
  outcome: ReviewOutcome;
  blockingReasons: string[];
  signOffAllowed: boolean;
};

export function determineReviewOutcome(input: DeterminationInput): ReviewOutcome {
  return determineReview(input).outcome;
}

/** Full determination, including the reasons that block sign-off. */
export function determineReview(input: DeterminationInput): Determination {
  const blockingReasons: string[] = [];

  for (const field of input.fields) {
    if (field.requiredForDecision && !field.humanVerified && field.confidence < input.minimumConfidence) {
      blockingReasons.push(
        `Field "${field.name}" is below the ${Math.round(input.minimumConfidence * 100)}% confidence policy and is not verified by an authorized compliance agent.`,
      );
    }
  }
  for (const id of input.missingRequiredDocumentIds) {
    blockingReasons.push(`Required document ${id} is missing.`);
  }
  for (const conflict of input.unresolvedRuleConflicts) {
    blockingReasons.push(`Unresolved rule conflict: ${conflict}.`);
  }
  if (input.stateRuleUnvalidated) {
    blockingReasons.push(
      "Federal baseline only — state-specific review required. The missing state rule could change this outcome.",
    );
  }

  if (blockingReasons.length) {
    return { outcome: "unable_to_determine", blockingReasons, signOffAllowed: false };
  }
  return {
    outcome: input.failedRuleIds.length ? "fail" : "pass",
    blockingReasons: [],
    signOffAllowed: true,
  };
}

export const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  pass: "Pass",
  fail: "Fail",
  unable_to_determine: "Unable to determine",
};

export type EvidenceManifest = {
  schemaVersion: "1.0";
  reviewId: string;
  organizationId: string;
  propertyId: string;
  certificationId: string;
  generatedAt: string;
  outcome: ReviewOutcome;
  blockingReasons: string[];
  documents: Array<{ id: string; filename: string; sha256: string; byteLength: number }>;
  extractedInputs: ExtractedField[];
  calculations: Array<{ id: string; formulaVersion: string; inputs: Record<string, unknown>; result: unknown }>;
  evaluatedRules: Array<{
    ruleId: string;
    version: string;
    sourceId: string;
    sourceSha256: string;
    result: "pass" | "fail" | "not_evaluated";
  }>;
  humanActions: Array<{ actorId: string; action: string; at: string; reason: string | null }>;
  engine: { build: string; extractionModel: string; minimumConfidence: number };
};

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashJson(value: unknown): Promise<string> {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer);
}

export function downloadEvidenceManifest(manifest: EvidenceManifest) {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${manifest.certificationId}-evidence-manifest.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
