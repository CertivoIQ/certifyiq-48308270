import { ticCompletenessFindings } from "@/lib/tic-completeness";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";
import type { PackRelease, StateCoverage } from "@/lib/stateCoverageRegistry";
import { selectionFromHistory } from "@/lib/tic-packet-selection";
import { TIC_FIELD_KEYS } from "@/lib/tic-field-registry";

function organizationIdFor(userId: string) {
  return `org-${userId}`;
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

const CERTIFICATION_PROGRAMS = new Set<CertificationProgram>([
  "LIHTC",
  "HOME",
  "HTF",
  "HCV_TENANT_BASED",
  "HUD_PBV",
  "HUD_MFH_PROJECT_BASED",
  "PUBLIC_HOUSING",
  "RURAL_DEVELOPMENT",
  "TAX_EXEMPT_BOND",
]);

type StoredFact = {
  field_name: string;
  field_value: unknown;
  source_document_ref: string | null;
  source_page: number | null;
  source_snippet: string | null;
  confidence: number | null;
  human_verified: boolean | null;
  required_for_decision: boolean | null;
  extraction_provider: string | null;
};

function storedFactsResult(rows: StoredFact[], fallbackProvider: string): {
  provider: string;
  facts: ExtractedFact[];
  missingFields: string[];
} {
  const facts: ExtractedFact[] = rows.map((row) => ({
    field: row.field_name,
    value: row.field_value,
    sourceDocumentRef: row.source_document_ref ?? "confirmed-certification",
    page: row.source_page,
    snippet: row.source_snippet,
    confidence: Number(row.confidence ?? 1),
    humanVerified: Boolean(row.human_verified),
    requiredForDecision: Boolean(row.required_for_decision),
    provider: row.extraction_provider ?? fallbackProvider,
  }));
  const present = new Set(facts.map((fact) => fact.field));
  return {
    provider: fallbackProvider,
    facts,
    missingFields: TIC_FIELD_KEYS.filter((field) => !present.has(field)),
  };
}

/**
 * Run deterministic compliance review from the pre-save confirmed TIC facts.
 * Confirmed facts are authoritative. The original document is still downloaded,
 * hashed, and source-bound OCR provenance is retained in the immutable manifest.
 * Legacy documents with no confirmed facts fall back to deterministic extraction.
 */
export const runCertificationReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    itemId: string;
    jurisdiction?: string;
    programs?: CertificationProgram[];
    certificationType?: "INITIAL" | "ANNUAL" | "INTERIM";
  }) => {
    if (!data?.itemId || data.itemId.length > 100) throw new Error("A certification item id is required.");
    if (data.jurisdiction && !/^[A-Za-z]{2}$/.test(data.jurisdiction)) throw new Error("Jurisdiction must be a two-letter state code.");
    if (data.certificationType && !["INITIAL", "ANNUAL", "INTERIM"].includes(data.certificationType)) {
      throw new Error("Certification type must be INITIAL, ANNUAL, or INTERIM.");
    }
    if (data.programs && (!data.programs.length || data.programs.some((program) => !CERTIFICATION_PROGRAMS.has(program)))) {
      throw new Error("Every declared certification program must be supported.");
    }
    return { ...data, ...(data.programs ? { programs: [...new Set(data.programs)] } : {}) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = organizationIdFor(userId);

    const { assertProductionTenant } = await import("@/lib/demo-tenant");
    assertProductionTenant(organizationId);

    const { data: item, error: itemError } = await supabase
      .from("certification_import_items")
      .select("id, storage_path, original_file_name, mime_type, size_bytes, sha256, status, certification_type, jurisdiction, program_codes, extraction_provider, historical_changes")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return { error: "That certification file is not available." } as const;

    const certificationType = data.certificationType ?? item.certification_type;
    if (!certificationType || !["INITIAL", "ANNUAL", "INTERIM"].includes(certificationType)) {
      return { error: "Select a certification type before review." } as const;
    }
    const importedPrograms = Array.isArray(item.program_codes) ? item.program_codes : [];
    const programs = (data.programs?.length ? data.programs : importedPrograms.length ? importedPrograms : ["LIHTC"]) as CertificationProgram[];
    if (programs.some((program) => !CERTIFICATION_PROGRAMS.has(program))) {
      return { error: "This certification contains an unsupported program code." } as const;
    }
    const jurisdiction = (data.jurisdiction ?? item.jurisdiction ?? "US").toUpperCase();

    await supabase.from("certification_import_items").update({
      status: "processing",
      review_queue_status: "processing",
      review_started_at: new Date().toISOString(),
      review_finished_at: null,
      error_message: null,
    }).eq("id", item.id);

    const extraction = await import("@/lib/certification-extraction.server");
    const orchestrator = await import("@/lib/federal-certification-review-orchestrator.mjs");
    const { hashJson, sha256Hex } = await import("@/lib/complianceDecisionAndManifest");
    const registry = await import("@/lib/stateCoverageRegistry");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const download = await supabase.storage.from("certification-imports").download(item.storage_path);
    if (download.error || !download.data) {
      await supabase
        .from("certification_import_items")
        .update({ status: "failed", error_message: "The stored certification file could not be read." })
        .eq("id", item.id);
      return { error: "The stored certification file could not be read." } as const;
    }
    const bytes = await download.data.arrayBuffer();
    const documentSha256 = await sha256Hex(bytes);
    const packetSelection = selectionFromHistory(item.historical_changes, documentSha256);
    if (bytes.byteLength !== item.size_bytes || (item.sha256 && item.sha256 !== documentSha256)) {
      const message = "The stored certification no longer matches the file recorded at upload. Upload it again before review.";
      await supabase
        .from("certification_import_items")
        .update({ status: "failed", error_message: message })
        .eq("id", item.id);
      return { error: message } as const;
    }

    let ocrDocument: Awaited<ReturnType<typeof extraction.loadOcrDocument>> = null;
    const sidecarDownload = await supabase.storage
      .from("certification-imports")
      .download(extraction.sidecarPathFor(item.storage_path));
    if (sidecarDownload.data) {
      try {
        ocrDocument = extraction.loadOcrDocument(
          JSON.parse(await sidecarDownload.data.text()),
          {
            fileName: item.original_file_name,
            sha256: documentSha256,
            byteSize: bytes.byteLength,
          },
        );
      } catch {
        ocrDocument = null;
      }
    }

    const { data: confirmedRows, error: confirmedError } = await supabaseAdmin
      .from("certification_facts")
      .select("field_name, field_value, source_document_ref, source_page, source_snippet, confidence, human_verified, required_for_decision, extraction_provider")
      .eq("item_id", item.id)
      .eq("human_verified", true)
      .order("field_name");
    if (confirmedError) throw confirmedError;

    const fallbackProvider = item.extraction_provider ?? (ocrDocument ? "ocr-tesseract" : "deterministic-text");
    let result: { provider: string; facts: ExtractedFact[]; missingFields: string[] };
    let documentKind: "pdf" | "text" | "pdf-ocr";

    if ((confirmedRows ?? []).length) {
      if (packetSelection && (confirmedRows ?? []).some(row => row.source_page !== null && !packetSelection.ticPages.includes(row.source_page))) {
        throw new Error("A saved TIC field points outside the selected TIC pages. Reconfirm packet selection before review.");
      }
      result = storedFactsResult((confirmedRows ?? []) as StoredFact[], fallbackProvider);
      documentKind = ocrDocument
        ? ocrDocument.documentKind
        : (/application\/pdf/i.test(item.mime_type) || /\.pdf$/i.test(item.original_file_name) ? "pdf" : "text");
    } else {
      if (packetSelection) throw new Error("This selected packet has no confirmed TIC fields. Reopen intake; the complete original packet will not be used as fallback evidence.");
      let documentText: string;
      if (ocrDocument) {
        documentText = ocrDocument.text;
        documentKind = ocrDocument.documentKind;
      } else {
        try {
          const extractedDocument = await extraction.extractDocumentText(bytes, item.mime_type, item.original_file_name);
          documentText = extractedDocument.text;
          documentKind = extractedDocument.documentKind;
        } catch (error) {
          const message = error instanceof Error ? error.message : "The certification document could not be extracted.";
          await supabase
            .from("certification_import_items")
            .update({ status: "failed", error_message: message, sha256: documentSha256 })
            .eq("id", item.id);
          return { error: message } as const;
        }
      }
      const legacy = extraction.extractFactsFromText(
        documentText,
        item.original_file_name,
        ...(ocrDocument ? ([ocrDocument.pageProvenance] as const) : ([] as const)),
      );
      result = legacy;
      await supabaseAdmin.from("certification_facts").delete().eq("item_id", item.id);
      if (legacy.facts.length) {
        const { error: factError } = await supabaseAdmin.from("certification_facts").insert(
          legacy.facts.map((fact) => ({
            item_id: item.id,
            user_id: userId,
            organization_id: organizationId,
            field_name: fact.field,
            field_value: (fact.value ?? null) as never,
            source_document_ref: fact.sourceDocumentRef,
            source_page: fact.page,
            source_snippet: fact.snippet,
            confidence: fact.confidence,
            human_verified: fact.humanVerified,
            required_for_decision: fact.requiredForDecision ?? true,
            extraction_provider: fact.provider ?? legacy.provider,
          })),
        );
        if (factError) throw factError;
      }
    }

    const completionValues = Object.fromEntries(result.facts.map(f => [f.field, f.value]));
    for (const entry of Array.isArray(item.historical_changes) ? item.historical_changes : []) {
      if (!entry || typeof entry !== "object" || !("original_extracted_data" in entry)) continue;
      const original = entry["original_extracted_data"];
      if (original && typeof original === "object") for (const [field, value] of Object.entries(original)) {
        if (field.startsWith("source_present_") && value === "Yes") completionValues[field] = value;
      }
    }
    const completionFindings = ticCompletenessFindings(completionValues);
    if (completionFindings.length) {
      const message = completionFindings.map(f => f.message).join(" ");
      const { error: completionError } = await supabase.from("certification_import_items").update({
        status: "completed", review_queue_status: "not_queued", review_started_at: null,
        error_message: message,
      }).eq("id", item.id);
      if (completionError) throw completionError;
      return { error: message } as const;
    }

    let statePack: StateCoverage | undefined;
    if (jurisdiction !== "US") {
      const { data: releases } = await supabase
        .from("state_rule_pack_releases")
        .select("state_code, status, effective_from, approved_at, approved_by, validated_rule_count, limitations")
        .eq("state_code", jurisdiction);
      const packs = registry.applyReleases((releases ?? []) as PackRelease[]);
      statePack = registry.coverageForState(jurisdiction, packs);
      if (statePack && !registry.isUsableForDetermination(statePack)) statePack = undefined;
    }

    const evaluation = orchestrator.evaluateFederalCertificationReview({
      facts: result.facts,
      programs,
      certificationType: certificationType as "INITIAL" | "ANNUAL" | "INTERIM",
      jurisdiction,
      ...(statePack
        ? {
            statePack: {
              code: statePack.code,
              status: statePack.status,
              version: statePack.effectiveDate,
              approvedBy: statePack.reviewedBy,
              effectiveFrom: statePack.effectiveDate,
              validatedRuleCount: statePack.validatedRuleCount,
            },
          }
        : {}),
    });

    await supabaseAdmin.from("compliance_findings").delete().eq("item_id", item.id);
    const { data: insertedFindings, error: findingError } = await supabaseAdmin
      .from("compliance_findings")
      .insert(
        evaluation.findings.map((finding) => ({
          item_id: item.id,
          user_id: userId,
          organization_id: organizationId,
          rule_id: finding.ruleId,
          rule_version: finding.ruleVersion,
          rule_pack_id: finding.rulePackId,
          rule_pack_version: finding.rulePackVersion,
          jurisdiction: finding.jurisdiction,
          status: finding.status,
          severity: finding.severity,
          explanation: `${finding.explanation} (${finding.citation})`,
          blocking_reasons: finding.blockingReasons as never,
          evidence_refs: finding.evidenceRefs as never,
          engine_build: finding.engineBuild,
          review_state: finding.status === "UNABLE_TO_DETERMINE" ? "unable_to_determine" : "pending_review",
        })),
      )
      .select("id, rule_id, status");
    if (findingError) throw findingError;

    const outcome = evaluation.counts.unableToDetermine > 0
      ? "unable_to_determine"
      : evaluation.counts.fail > 0
        ? "fail"
        : "pass";
    const manifest = {
      packetSelection,
      schemaVersion: "1.1",
      reviewId: item.id,
      organizationId,
      generatedAt: new Date().toISOString(),
      outcome,
      documents: [{ id: item.id, filename: item.original_file_name, sha256: documentSha256 }],
      extractedInputs: result.facts,
      missingFields: result.missingFields,
      confirmedFactsAuthoritative: (confirmedRows ?? []).length > 0,
      evaluatedRules: evaluation.findings.map((finding) => ({
        ruleId: finding.ruleId,
        version: finding.ruleVersion,
        status: finding.status,
        citation: finding.citation,
        evidenceRefs: finding.evidenceRefs,
      })),
      engine: {
        build: evaluation.engineBuild,
        rulePackId: evaluation.rulePackId,
        rulePackVersion: evaluation.rulePackVersion,
        statePackApplied: evaluation.statePackApplied,
        extractionProvider: result.provider,
        documentKind,
        controlResults: evaluation.controlResults,
        ocr: ocrDocument
          ? {
              engines: ocrDocument.ocrEngines,
              sidecarSchemaVersion: ocrDocument.sidecarSchemaVersion,
              sourceSha256: ocrDocument.sourceSha256,
              sourceByteSize: ocrDocument.sourceByteSize,
              sourceIdentityVerified: true,
              ocrPageCount: ocrDocument.ocrPageCount,
              textPageCount: ocrDocument.textPageCount,
              skippedPageCount: ocrDocument.skippedPageCount,
            }
          : null,
      },
    };
    const manifestSha256 = await hashJson(manifest);
    const { error: manifestError } = await supabaseAdmin.from("evidence_manifests").insert({
      review_id: item.id,
      user_id: userId,
      organization_id: organizationId,
      certification_id: item.id,
      outcome,
      engine_build: evaluation.engineBuild,
      manifest: manifest as never,
      manifest_sha256: manifestSha256,
    });
    if (manifestError && (manifestError as { code?: string }).code !== "23505") throw manifestError;

    await supabase
      .from("certification_import_items")
      .update({
        status: "completed",
        sha256: documentSha256,
        extraction_provider: result.provider,
        extracted_data: Object.fromEntries(result.facts.map((fact) => [fact.field, fact.value])) as never,
        processed_at: new Date().toISOString(),
        error_message: null,
        review_queue_status: "completed",
        review_finished_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    return {
      itemId: item.id,
      outcome,
      extractionProvider: result.provider,
      missingFields: result.missingFields,
      confirmedFactsAuthoritative: (confirmedRows ?? []).length > 0,
      statePackApplied: evaluation.statePackApplied,
      rulePack: { id: evaluation.rulePackId, version: evaluation.rulePackVersion },
      counts: evaluation.counts,
      findingCount: insertedFindings?.length ?? 0,
      manifestSha256,
    } as const;
  });

