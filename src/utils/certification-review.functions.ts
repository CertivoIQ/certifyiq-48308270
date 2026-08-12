import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PackRelease, StateCoverage } from "@/lib/stateCoverageRegistry";

/**
 * The live compliance vertical slice.
 *
 * upload (storage + certification_import_items)
 *   -> extraction with per-fact citations (certification_facts)
 *   -> validated/versioned rule pack selection (state_rule_pack_releases + registry)
 *   -> deterministic evaluation (compliance-rule-engine.mjs — AI never decides)
 *   -> persisted findings (compliance_findings)
 *   -> human decision recorded append-only (finding_reviews)
 *   -> immutable evidence manifest (evidence_manifests)
 *
 * Row-level security scopes every read and write to the signed-in user.
 */

export type ReviewDecisionInput = "approved" | "remediation_requested" | "unable_to_determine";

/** Never a demo tenant: reviews always run against the caller's own tenant id. */
function organizationIdFor(userId: string) {
  return `org-${userId}`;
}

export const runCertificationReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string; jurisdiction?: string; useAi?: boolean }) => {
    if (!data?.itemId || data.itemId.length > 100) throw new Error("A certification item id is required.");
    if (data.jurisdiction && !/^[A-Za-z]{2}$/.test(data.jurisdiction)) throw new Error("Jurisdiction must be a two-letter state code.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = organizationIdFor(userId);
    const jurisdiction = (data.jurisdiction ?? "US").toUpperCase();

    const { assertProductionTenant } = await import("@/lib/demo-tenant");
    assertProductionTenant(organizationId);

    const { data: item, error: itemError } = await supabase
      .from("certification_import_items")
      .select("id, storage_path, original_file_name, mime_type, status")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return { error: "That certification file is not available." } as const;

    await supabase.from("certification_import_items").update({ status: "processing" }).eq("id", item.id);

    const extraction = await import("@/lib/certification-extraction.server");
    const engine = await import("@/lib/compliance-rule-engine.mjs");
    const { hashJson, sha256Hex } = await import("@/lib/complianceDecisionAndManifest");
    const registry = await import("@/lib/stateCoverageRegistry");
    // Evidence, findings and manifests are written with the service role: end users
    // hold read-only rights on those tables so they can never tamper with a
    // determination or forge a verification flag. Ownership is already proven by
    // the RLS-scoped read of the import item above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- extraction -------------------------------------------------------
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

    // OCR sidecar produced during upload for scanned/image-only or mixed PDFs.
    // It is preferred only when it actually contains OCR'd pages; a fully
    // machine-readable PDF keeps the untouched server-side text path.
    let ocrDocument: Awaited<ReturnType<typeof extraction.loadOcrDocument>> = null;
    const sidecarDownload = await supabase.storage
      .from("certification-imports")
      .download(extraction.sidecarPath(item.storage_path));
    if (sidecarDownload.data) {
      try {
        ocrDocument = extraction.loadOcrDocument(JSON.parse(await sidecarDownload.data.text()));
      } catch {
        // An unreadable sidecar never becomes evidence; fall back to PDF text.
        ocrDocument = null;
      }
    }

    let documentText: string;
    let documentKind: "pdf" | "text" | "pdf-ocr";
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

    const apiKey = process.env["LOVABLE_API_KEY"];
    let result = extraction.extractFactsFromText(
      documentText,
      item.original_file_name,
      ...(ocrDocument ? ([ocrDocument.pageProvenance] as const) : ([] as const)),
    );
    if (data.useAi && apiKey && !ocrDocument) {
      try {
        const aiResult = await extraction.extractFactsWithAi(documentText, item.original_file_name, apiKey);
        // Keep whichever provider produced more evidence-backed facts.
        if (aiResult.facts.length > result.facts.length) result = aiResult;
      } catch {
        // Extraction stays deterministic when the gateway is unavailable.
      }
    }


    await supabaseAdmin.from("certification_facts").delete().eq("item_id", item.id);
    if (result.facts.length) {
      const { error: factError } = await supabaseAdmin.from("certification_facts").insert(
        result.facts.map((fact) => ({
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
          extraction_provider: fact.provider ?? result.provider,
        })),
      );
      if (factError) throw factError;
    }

    // --- versioned rule pack selection -----------------------------------
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

    // --- deterministic evaluation ----------------------------------------
    const evaluation = engine.evaluateCertification({
      facts: result.facts,
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
          review_state:
            finding.status === "UNABLE_TO_DETERMINE" ? "unable_to_determine" : "pending_review",
        })),
      )
      .select("id, rule_id, status");
    if (findingError) throw findingError;

    // --- immutable evidence manifest -------------------------------------
    const outcome =
      evaluation.counts.unableToDetermine > 0 ? "unable_to_determine" : evaluation.counts.fail > 0 ? "fail" : "pass";
    const manifest = {
      schemaVersion: "1.0",
      reviewId: item.id,
      organizationId,
      generatedAt: new Date().toISOString(),
      outcome,
      documents: [{ id: item.id, filename: item.original_file_name, sha256: documentSha256 }],
      extractedInputs: result.facts,
      missingFields: result.missingFields,
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
      })
      .eq("id", item.id);

    return {
      itemId: item.id,
      outcome,
      extractionProvider: result.provider,
      missingFields: result.missingFields,
      statePackApplied: evaluation.statePackApplied,
      rulePack: { id: evaluation.rulePackId, version: evaluation.rulePackVersion },
      counts: evaluation.counts,
      findingCount: insertedFindings?.length ?? 0,
      manifestSha256,
    } as const;
  });

export const getCertificationReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!data?.itemId) throw new Error("A certification item id is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const [facts, findings] = await Promise.all([
      context.supabase
        .from("certification_facts")
        .select("field_name, field_value, source_document_ref, source_page, source_snippet, confidence, human_verified, extraction_provider")
        .eq("item_id", data.itemId)
        .order("field_name"),
      context.supabase
        .from("compliance_findings")
        .select("id, rule_id, rule_version, rule_pack_id, rule_pack_version, jurisdiction, status, severity, explanation, blocking_reasons, evidence_refs, review_state, engine_build")
        .eq("item_id", data.itemId)
        .order("severity"),
    ]);
    if (facts.error) throw facts.error;
    if (findings.error) throw findings.error;

    const findingIds = (findings.data ?? []).map((finding) => finding.id);
    const reviews = findingIds.length
      ? await context.supabase
          .from("finding_reviews")
          .select("finding_id, decision, reason, created_at, reviewer_id")
          .in("finding_id", findingIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (reviews.error) throw reviews.error;

    return { facts: facts.data ?? [], findings: findings.data ?? [], reviews: reviews.data ?? [] };
  });

export const listCertificationItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("certification_import_items")
      .select("id, original_file_name, mime_type, status, extraction_provider, created_at, processed_at, error_message")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return data ?? [];
  });

/** Human sign-off. Recorded append-only; a determination is never auto-approved. */
export const recordFindingDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { findingId: string; decision: ReviewDecisionInput; reason?: string }) => {
    if (!data?.findingId) throw new Error("A finding id is required.");
    if (!["approved", "remediation_requested", "unable_to_determine"].includes(data.decision)) {
      throw new Error("Unsupported reviewer decision.");
    }
    if (data.reason && data.reason.length > 2000) throw new Error("The reason is too long.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: finding, error } = await supabase
      .from("compliance_findings")
      .select("id, status")
      .eq("id", data.findingId)
      .maybeSingle();
    if (error) throw error;
    if (!finding) return { error: "That finding is not available." } as const;

    // Guardrail: an undetermined finding cannot be approved as compliant.
    if (finding.status === "UNABLE_TO_DETERMINE" && data.decision === "approved") {
      return {
        error:
          "This finding is undetermined because required evidence is missing. Resolve the blocking reasons before approving.",
      } as const;
    }

    // Reviewer decisions are append-only and service-role written, so a user
    // cannot fabricate an approval trail directly through the Data API.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: reviewError } = await supabaseAdmin.from("finding_reviews").insert({
      finding_id: finding.id,
      user_id: userId,
      reviewer_id: userId,
      decision: data.decision,
      reason: data.reason ?? null,
    });
    if (reviewError) throw reviewError;

    const { error: updateError } = await supabaseAdmin
      .from("compliance_findings")
      .update({ review_state: data.decision })
      .eq("id", finding.id);
    if (updateError) throw updateError;

    return { findingId: finding.id, decision: data.decision } as const;
  });
