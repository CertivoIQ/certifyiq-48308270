/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPPORTED_FIELDS = [
  "tenant_signature_date",
  "certification_effective_date",
  "household_annual_income",
  "applicable_lihtc_income_limit",
  "household_net_assets",
  "hotma_asset_cap",
  "gross_rent",
  "state_max_gross_rent",
  "utility_allowance_source",
] as const;

type SupportedField = (typeof SUPPORTED_FIELDS)[number];
const SUPPORTED_FIELD_SET = new Set<string>(SUPPORTED_FIELDS);
const NUMERIC_FIELDS = new Set<string>([
  "household_annual_income",
  "applicable_lihtc_income_limit",
  "household_net_assets",
  "hotma_asset_cap",
  "gross_rent",
  "state_max_gross_rent",
]);

type StagedCertificationSource = {
  jobId: string;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadDurationMs?: number;
  extractionDurationMs?: number;
  totalIntakeDurationMs?: number;
  uploadTransport?: string;
};

type ConfirmedField = {
  field: SupportedField;
  value: string | number | null;
};

function validateSource(source: StagedCertificationSource) {
  if (!source?.jobId || source.jobId.length > 100) throw new Error("A certification intake id is required.");
  if (!source.storagePath || source.storagePath.length > 1200) throw new Error("A staged certification path is required.");
  if (!source.originalFileName || source.originalFileName.length > 500) throw new Error("The certification filename is invalid.");
  if (!source.mimeType || source.mimeType.length > 200) throw new Error("The certification MIME type is invalid.");
  if (!Number.isSafeInteger(source.sizeBytes) || source.sizeBytes < 1 || source.sizeBytes > 50 * 1024 * 1024) {
    throw new Error("The certification file size is invalid.");
  }
  if (!/^[a-f0-9]{64}$/i.test(source.sha256)) throw new Error("The certification source hash is invalid.");
  for (const value of [source.uploadDurationMs, source.extractionDurationMs, source.totalIntakeDurationMs]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 86_400_000)) {
      throw new Error("Certification processing timing is invalid.");
    }
  }
  if (source.uploadTransport && source.uploadTransport.length > 100) throw new Error("Upload transport is invalid.");
  return source;
}

function normalizeConfirmedValue(field: string, value: string | number | null) {
  if (value === null || value === "") return null;
  if (NUMERIC_FIELDS.has(field)) {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(numeric)) throw new Error(`${field.replaceAll("_", " ")} must be a number.`);
    return numeric;
  }
  const text = String(value).trim();
  if (text.length > 500) throw new Error(`${field.replaceAll("_", " ")} is too long.`);
  return text || null;
}

async function extractStagedSource(supabase: any, userId: string, source: StagedCertificationSource) {
  const db = supabase as any;
  const { data: job, error: jobError } = await db
    .from("certification_import_jobs")
    .select("id, status")
    .eq("id", source.jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error("That staged certification intake is not available.");
  if (job.status !== "processing") throw new Error("That certification intake is no longer awaiting confirmation.");
  if (!source.storagePath.startsWith(`${userId}/${source.jobId}/`)) {
    throw new Error("The staged certification path does not belong to this intake.");
  }

  const extraction = await import("@/lib/certification-extraction.server");
  const { sha256Hex } = await import("@/lib/complianceDecisionAndManifest");
  const download = await supabase.storage.from("certification-imports").download(source.storagePath);
  if (download.error || !download.data) throw new Error("The staged certification file could not be read for extraction.");

  const bytes = await download.data.arrayBuffer();
  const sourceSha256 = await sha256Hex(bytes);
  if (bytes.byteLength !== Number(source.sizeBytes) || source.sha256.toLowerCase() !== sourceSha256.toLowerCase()) {
    throw new Error("The staged certification does not match the uploaded source bytes.");
  }

  let ocrDocument: Awaited<ReturnType<typeof extraction.loadOcrDocument>> = null;
  const sidecarDownload = await supabase.storage
    .from("certification-imports")
    .download(extraction.sidecarPathFor(source.storagePath));
  if (sidecarDownload.data) {
    try {
      ocrDocument = extraction.loadOcrDocument(
        JSON.parse(await sidecarDownload.data.text()),
        { fileName: source.originalFileName, sha256: sourceSha256, byteSize: bytes.byteLength },
      );
    } catch {
      ocrDocument = null;
    }
  }

  let documentText: string;
  if (ocrDocument) documentText = ocrDocument.text;
  else documentText = (await extraction.extractDocumentText(bytes, source.mimeType, source.originalFileName)).text;

  const result = extraction.extractFactsFromText(
    documentText,
    source.originalFileName,
    ...(ocrDocument ? ([ocrDocument.pageProvenance] as const) : ([] as const)),
  );
  const confidence = result.facts.length
    ? result.facts.reduce((sum, fact) => sum + Number(fact.confidence || 0), 0) / result.facts.length
    : 0;
  return { result, confidence, sourceSha256 };
}

/** Read staged source bytes and return an editable extraction preview. */
export const extractCertificationDocumentPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { source: StagedCertificationSource }) => ({ source: validateSource(data.source) }))
  .handler(async ({ data, context }) => {
    try {
      const { result, confidence } = await extractStagedSource(context.supabase, context.userId, data.source);
      return {
        facts: result.facts.map((fact) => ({
          field: fact.field,
          value: fact.value,
          page: fact.page,
          snippet: fact.snippet,
          confidence: fact.confidence,
          provider: fact.provider ?? result.provider,
        })),
        missingFields: result.missingFields,
        extractionProvider: result.provider,
        confidence,
      } as const;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The certification document could not be extracted." } as const;
    }
  });

/**
 * Nothing is written to certification_import_items or certification_facts until this confirmation runs.
 * startReview=true saves the confirmed document and queues that exact new item in the same server-controlled operation.
 */
export const confirmCertificationDocumentPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { source: StagedCertificationSource; fields: ConfirmedField[]; startReview?: boolean }) => {
    const source = validateSource(data.source);
    if (!Array.isArray(data.fields) || data.fields.length > SUPPORTED_FIELDS.length) {
      throw new Error("The extracted field confirmation is invalid.");
    }
    const seen = new Set<string>();
    const fields = data.fields.map((entry) => {
      if (!entry || !SUPPORTED_FIELD_SET.has(entry.field)) throw new Error("An unsupported extracted field was submitted.");
      if (seen.has(entry.field)) throw new Error("An extracted field was submitted more than once.");
      seen.add(entry.field);
      return { field: entry.field as SupportedField, value: entry.value ?? null };
    });
    return { source, fields, startReview: data.startReview === true };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;
    const { result, confidence, sourceSha256 } = await extractStagedSource(supabase, userId, data.source);
    const originalByField = new Map(result.facts.map((fact) => [fact.field, fact]));
    const submittedByField = new Map(data.fields.map((entry) => [entry.field, entry.value]));
    const originalExtractedData = Object.fromEntries(result.facts.map((fact) => [fact.field, fact.value]));
    const confirmedExtractedData: Record<string, string | number> = {};
    const corrections: Array<{ field: string; extractedValue: unknown; confirmedValue: unknown }> = [];

    for (const fact of result.facts) {
      const submitted = submittedByField.has(fact.field) ? submittedByField.get(fact.field)! : fact.value;
      const confirmed = normalizeConfirmedValue(fact.field, submitted as string | number | null);
      if (confirmed !== null) confirmedExtractedData[fact.field] = confirmed;
      if (JSON.stringify(confirmed) !== JSON.stringify(fact.value)) {
        corrections.push({ field: fact.field, extractedValue: fact.value, confirmedValue: confirmed });
      }
    }
    for (const entry of data.fields) {
      if (!originalByField.has(entry.field)) {
        throw new Error(`${entry.field.replaceAll("_", " ")} was not extracted from this document and cannot be confirmed here.`);
      }
    }

    const confirmedAt = new Date().toISOString();
    const { data: item, error: itemError } = await db
      .from("certification_import_items")
      .insert({
        job_id: data.source.jobId,
        user_id: userId,
        storage_path: data.source.storagePath,
        original_file_name: data.source.originalFileName,
        mime_type: data.source.mimeType,
        size_bytes: data.source.sizeBytes,
        sha256: sourceSha256,
        status: "processing",
        extraction_provider: result.provider,
        extracted_data: confirmedExtractedData,
        historical_changes: [{
          type: "extraction_confirmation",
          confirmed_at: confirmedAt,
          reviewer_id: userId,
          original_extracted_data: originalExtractedData,
          confirmed_extracted_data: confirmedExtractedData,
          corrections,
        }],
        confidence,
        processed_at: confirmedAt,
        upload_duration_ms: data.source.uploadDurationMs ?? null,
        extraction_duration_ms: data.source.extractionDurationMs ?? null,
        total_intake_duration_ms: data.source.totalIntakeDurationMs ?? null,
        upload_transport: data.source.uploadTransport ?? null,
        upload_sequence: 0,
        review_queue_status: "not_queued",
      })
      .select("id")
      .single();
    if (itemError) throw itemError;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const confirmedFacts = result.facts
        .filter((fact) => Object.prototype.hasOwnProperty.call(confirmedExtractedData, fact.field))
        .map((fact) => ({
          item_id: item.id,
          user_id: userId,
          organization_id: `org-${userId}`,
          field_name: fact.field,
          field_value: confirmedExtractedData[fact.field] as never,
          source_document_ref: fact.sourceDocumentRef,
          source_page: fact.page,
          source_snippet: fact.snippet,
          confidence: fact.confidence,
          human_verified: true,
          required_for_decision: fact.requiredForDecision ?? true,
          extraction_provider: fact.provider ?? result.provider,
        }));
      if (confirmedFacts.length) {
        const { error: factError } = await supabaseAdmin.from("certification_facts").insert(confirmedFacts);
        if (factError) throw factError;
      }

      const itemCompletion = data.startReview
        ? {
            status: "completed",
            review_queue_status: "queued",
            queued_for_review_at: confirmedAt,
            review_order: Date.now() * 1000,
            review_started_at: null,
            review_finished_at: null,
          }
        : { status: "completed" };
      const { error: itemCompleteError } = await db
        .from("certification_import_items")
        .update(itemCompletion)
        .eq("id", item.id)
        .eq("user_id", userId);
      if (itemCompleteError) throw itemCompleteError;

      const { error: completeError } = await db
        .from("certification_import_jobs")
        .update({ status: "completed", processed_files: 1, error_count: 0, completed_at: confirmedAt })
        .eq("id", data.source.jobId)
        .eq("user_id", userId);
      if (completeError) throw completeError;
    } catch (error) {
      await db.from("certification_import_items").delete().eq("id", item.id).eq("user_id", userId);
      throw error;
    }

    return {
      itemId: item.id,
      extractedData: confirmedExtractedData,
      correctionCount: corrections.length,
      reviewQueueStatus: data.startReview ? "queued" : "not_queued",
      queuedForReview: data.startReview,
    } as const;
  });

/** Cancel a staged intake before it becomes a Documents record. */
export const cancelCertificationDocumentPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { source: StagedCertificationSource }) => ({ source: validateSource(data.source) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;
    const { data: job, error: jobError } = await db
      .from("certification_import_jobs")
      .select("id")
      .eq("id", data.source.jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return { cancelled: true } as const;
    if (!data.source.storagePath.startsWith(`${userId}/${data.source.jobId}/`)) {
      throw new Error("The staged certification path does not belong to this intake.");
    }

    const extraction = await import("@/lib/certification-extraction.server");
    await supabase.storage
      .from("certification-imports")
      .remove([data.source.storagePath, extraction.sidecarPathFor(data.source.storagePath)]);
    const { error: deleteError } = await db
      .from("certification_import_jobs")
      .delete()
      .eq("id", data.source.jobId)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;
    return { cancelled: true } as const;
  });

/** Documents list contains confirmed/saved certification records only. */
export const listCertificationDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("certification_import_items")
      .select("id, original_file_name, mime_type, status, extraction_provider, extracted_data, confidence, created_at, processed_at, error_message, upload_sequence, certification_type, jurisdiction, program_codes, review_queue_status, queued_for_review_at, tenant_profile_id, unit_id, property_id, portfolio_tenant_profiles(household_name), portfolio_units(unit_number), portfolio_properties(name)")
      .eq("status", "completed")
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