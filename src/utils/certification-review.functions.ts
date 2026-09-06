// TIC_EVIDENCE_WIRING_V1
/* eslint-disable @typescript-eslint/no-explicit-any */
import { summarizeCalculationHistory } from "@/lib/tic-supporting-evidence.mjs";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PackRelease, StateCoverage } from "@/lib/stateCoverageRegistry";
import { evaluateSubmissionAuthority } from "@/lib/certification-authority.mjs";

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
      .select("id, storage_path, original_file_name, mime_type, size_bytes, sha256, status, certification_type, jurisdiction, program_codes")
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
      status: "processing", review_queue_status: "processing", review_started_at: new Date().toISOString(),
      review_finished_at: null, error_message: null,
    }).eq("id", item.id);

    const extraction = await import("@/lib/certification-extraction.server");
    const orchestrator = await import(
      "@/lib/federal-certification-review-orchestrator.mjs"
    );
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

    if (bytes.byteLength !== item.size_bytes || (item.sha256 && item.sha256 !== documentSha256)) {
      const message = "The stored certification no longer matches the file recorded at upload. Upload it again before review.";
      await supabase
        .from("certification_import_items")
        .update({ status: "failed", error_message: message })
        .eq("id", item.id);
      return { error: message } as const;
    }

    // The source-bound sidecar contains native PDF text and/or OCR text already
    // extracted during upload. The original bytes are still hashed above before
    // the sidecar is trusted, but the PDF never needs to be parsed a second time.
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

    // Certification extraction is intentionally local and deterministic. Scanned
    // documents arrive with a source-bound Tesseract OCR sidecar created in the
    // customer's browser. Missing evidence remains "unable to determine" and is
    // routed to human review; no external AI extraction service is called.
    const result = extraction.extractFactsFromText(
      documentText,
      item.original_file_name,
      ...(ocrDocument ? ([ocrDocument.pageProvenance] as const) : ([] as const)),
    );

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
        controlResults: evaluation.controlResults,
        // OCR provenance for the audit trail: which pages were OCR-derived and
        // with which engine. Absent for machine-readable documents.
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
    const [facts, findings, history] = await Promise.all([
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
      context.supabase.from("certification_import_items").select("historical_changes").eq("id", data.itemId).eq("user_id", context.userId).maybeSingle(),
    ]);
    if (facts.error) throw facts.error;
    if (findings.error) throw findings.error;
    if (history.error) throw history.error;

    const findingIds = (findings.data ?? []).map((finding) => finding.id);
    const reviews = findingIds.length
      ? await context.supabase
          .from("finding_reviews")
          .select("finding_id, decision, reason, created_at, reviewer_id, manifest_sha256, expires_at, revoked_at")
          .in("finding_id", findingIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (reviews.error) throw reviews.error;

    return { facts: facts.data ?? [], findings: findings.data ?? [], reviews: reviews.data ?? [], calculations: summarizeCalculationHistory(history.data?.historical_changes) };
  });

export const listCertificationItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("certification_import_items")
      .select("id, original_file_name, mime_type, status, extraction_provider, created_at, processed_at, error_message, upload_sequence, certification_type, jurisdiction, program_codes, review_queue_status, queued_for_review_at, tenant_profile_id, unit_id, property_id, portfolio_tenant_profiles(household_name), portfolio_units(unit_number), portfolio_properties(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((item: any) => ({
      ...item,
      household_name: item.portfolio_tenant_profiles?.household_name ?? null,
      unit_number: item.portfolio_units?.unit_number ?? null,
      property_name: item.portfolio_properties?.name ?? null,
    }));
  });

/** Human sign-off. Recorded append-only; a determination is never auto-approved. */
export const recordFindingDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      findingId: string;
      decision: ReviewDecisionInput;
      reason?: string;
      expiresAt?: string;
    }) => {
      if (!data?.findingId) {
        throw new Error("A finding id is required.");
      }

      if (
        ![
          "approved",
          "remediation_requested",
          "unable_to_determine",
        ].includes(data.decision)
      ) {
        throw new Error("Unsupported reviewer decision.");
      }

      if (data.reason && data.reason.length > 2000) {
        throw new Error("The reason is too long.");
      }

      if (data.expiresAt) {
        const expiresAt = new Date(data.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
          throw new Error("The approval expiration timestamp is invalid.");
        }
        if (data.decision !== "approved") {
          throw new Error("Only an approval may have an expiration timestamp.");
        }
        if (expiresAt.getTime() <= Date.now()) {
          throw new Error("The approval expiration timestamp must be in the future.");
        }
      }

      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: finding, error } = await supabase
      .from("compliance_findings")
      .select("id, item_id, status")
      .eq("id", data.findingId)
      .maybeSingle();

    if (error) throw error;

    if (!finding) {
      return {
        error: "That finding is not available.",
      } as const;
    }

    const { data: manifest, error: manifestError } = await supabase
      .from("evidence_manifests")
      .select("manifest_sha256")
      .eq("review_id", finding.item_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (manifestError) throw manifestError;

    if (!manifest?.manifest_sha256) {
      return {
        error:
          "A current evidence manifest is required before a human decision can be recorded.",
      } as const;
    }

    if (
      finding.status === "UNABLE_TO_DETERMINE" &&
      data.decision === "approved"
    ) {
      return {
        error:
          "This finding is undetermined because required evidence is missing. Resolve the blocking reasons before approving.",
      } as const;
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: reviewError } = await supabaseAdmin
      .from("finding_reviews")
      .insert({
        finding_id: finding.id,
        user_id: userId,
        reviewer_id: userId,
        decision: data.decision,
        reason: data.reason ?? null,
        expires_at: data.expiresAt ?? null,
        revoked_at: null,
        manifest_sha256: manifest.manifest_sha256,
      });

    if (reviewError) throw reviewError;

    const { error: updateError } = await supabaseAdmin
      .from("compliance_findings")
      .update({
        review_state: data.decision,
      })
      .eq("id", finding.id);

    if (updateError) throw updateError;

    return {
      findingId: finding.id,
      decision: data.decision,
      manifestSha256: manifest.manifest_sha256,
    } as const;
  });
/** Explicit human revocation. Appends a new immutable review record; prior approvals are never mutated. */
export const revokeFindingApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      findingId: string;
      reason: string;
    }) => {
      if (!data?.findingId) {
        throw new Error("A finding id is required.");
      }

      const reason = data.reason?.trim();

      if (!reason) {
        throw new Error("A revocation reason is required.");
      }

      if (reason.length > 2000) {
        throw new Error("The revocation reason is too long.");
      }

      return {
        findingId: data.findingId,
        reason,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: finding, error: findingError } = await supabase
      .from("compliance_findings")
      .select("id")
      .eq("id", data.findingId)
      .maybeSingle();

    if (findingError) throw findingError;

    if (!finding) {
      return {
        error: "That finding is not available.",
      } as const;
    }

    const { data: latestReview, error: reviewLookupError } = await supabase
      .from("finding_reviews")
      .select(
        "id, decision, manifest_sha256, expires_at, revoked_at, created_at",
      )
      .eq("finding_id", finding.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewLookupError) throw reviewLookupError;

    if (!latestReview || latestReview.decision !== "approved") {
      return {
        error: "There is no current approval to revoke.",
      } as const;
    }

    if (latestReview.revoked_at) {
      return {
        findingId: finding.id,
        revokedAt: latestReview.revoked_at,
        manifestSha256: latestReview.manifest_sha256,
        alreadyRevoked: true,
      } as const;
    }

    if (!latestReview.manifest_sha256) {
      return {
        error: "The approval cannot be revoked because its evidence manifest is missing.",
      } as const;
    }

    const revokedAt = new Date().toISOString();

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: revokeError } = await supabaseAdmin
      .from("finding_reviews")
      .insert({
        finding_id: finding.id,
        user_id: userId,
        reviewer_id: userId,
        decision: "approved",
        reason: data.reason,
        manifest_sha256: latestReview.manifest_sha256,
        expires_at: latestReview.expires_at,
        revoked_at: revokedAt,
        revoked_review_id: latestReview.id,
      });

    if (revokeError?.code === "23505") {
      const { data: existingRevocation, error: existingRevocationError } =
        await supabaseAdmin
          .from("finding_reviews")
          .select("revoked_at, manifest_sha256")
          .eq("revoked_review_id", latestReview.id)
          .maybeSingle();

      if (existingRevocationError) throw existingRevocationError;

      if (existingRevocation) {
        return {
          findingId: finding.id,
          revokedAt: existingRevocation.revoked_at,
          manifestSha256: existingRevocation.manifest_sha256,
          alreadyRevoked: true,
        } as const;
      }
    }

    if (revokeError) throw revokeError;

    return {
      findingId: finding.id,
      revokedAt,
      manifestSha256: latestReview.manifest_sha256,
      alreadyRevoked: false,
    } as const;
  });
export const getSubmissionAuthority = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!data?.itemId || data.itemId.length > 100) {
      throw new Error("A certification item id is required.");
    }

    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [itemResult, findingsResult, manifestResult] = await Promise.all([
      supabase
        .from("certification_import_items")
        .select("id, status")
        .eq("id", data.itemId)
        .maybeSingle(),

      supabase
        .from("compliance_findings")
        .select("id, status")
        .eq("item_id", data.itemId),

      supabase
        .from("evidence_manifests")
        .select("manifest_sha256, created_at")
        .eq("review_id", data.itemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (itemResult.error) throw itemResult.error;
    if (findingsResult.error) throw findingsResult.error;
    if (manifestResult.error) throw manifestResult.error;

    const findings = findingsResult.data ?? [];
    const findingIds = findings.map((finding) => finding.id);

    const reviewsResult = findingIds.length
      ? await supabase
          .from("finding_reviews")
          .select(
            "finding_id, decision, reason, reviewer_id, created_at, manifest_sha256, expires_at, revoked_at",
          )
          .in("finding_id", findingIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (reviewsResult.error) throw reviewsResult.error;

    const authority = evaluateSubmissionAuthority({
      item: itemResult.data,
      findings,
      reviews: reviewsResult.data ?? [],
      manifest: manifestResult.data,
    });

    return {
      itemId: data.itemId,
      ...authority,
    } as const;
  });

