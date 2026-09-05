/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Extract and persist proposed document facts immediately after upload.
 *
 * This is intentionally separate from compliance review: it never queues the
 * document, evaluates a rule, creates a finding, or records a determination.
 * The original document remains immutable; extracted values are persisted as
 * proposed document metadata with source citations for display in Documents.
 */
export const extractCertificationDocumentPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!data?.itemId || data.itemId.length > 100) {
      throw new Error("A certification item id is required.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;

    const { data: item, error: itemError } = await db
      .from("certification_import_items")
      .select("id, storage_path, original_file_name, mime_type, size_bytes, sha256, review_queue_status")
      .eq("id", data.itemId)
      .eq("user_id", userId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return { error: "That certification file is not available." } as const;

    const extraction = await import("@/lib/certification-extraction.server");
    const { sha256Hex } = await import("@/lib/complianceDecisionAndManifest");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const download = await supabase.storage.from("certification-imports").download(item.storage_path);
    if (download.error || !download.data) {
      return { error: "The stored certification file could not be read for extraction." } as const;
    }

    const bytes = await download.data.arrayBuffer();
    const sourceSha256 = await sha256Hex(bytes);
    if (bytes.byteLength !== Number(item.size_bytes) || (item.sha256 && item.sha256 !== sourceSha256)) {
      return { error: "The stored certification does not match the recorded upload bytes." } as const;
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
            sha256: sourceSha256,
            byteSize: bytes.byteLength,
          },
        );
      } catch {
        ocrDocument = null;
      }
    }

    let documentText: string;
    if (ocrDocument) {
      documentText = ocrDocument.text;
    } else {
      try {
        const extractedDocument = await extraction.extractDocumentText(
          bytes,
          item.mime_type,
          item.original_file_name,
        );
        documentText = extractedDocument.text;
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "The certification document could not be extracted.",
        } as const;
      }
    }

    const result = extraction.extractFactsFromText(
      documentText,
      item.original_file_name,
      ...(ocrDocument ? ([ocrDocument.pageProvenance] as const) : ([] as const)),
    );

    const organizationId = `org-${userId}`;
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
          human_verified: false,
          required_for_decision: fact.requiredForDecision ?? true,
          extraction_provider: fact.provider ?? result.provider,
        })),
      );
      if (factError) throw factError;
    }

    const confidence = result.facts.length
      ? result.facts.reduce((sum, fact) => sum + Number(fact.confidence || 0), 0) / result.facts.length
      : 0;
    const extractedData = Object.fromEntries(result.facts.map((fact) => [fact.field, fact.value]));

    const { error: updateError } = await db
      .from("certification_import_items")
      .update({
        sha256: sourceSha256,
        extraction_provider: result.provider,
        extracted_data: extractedData,
        confidence,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (updateError) throw updateError;

    return {
      itemId: item.id,
      extractedData,
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
      reviewQueueStatus: item.review_queue_status,
    } as const;
  });

/** Documents list with automatic extraction metadata. */
export const listCertificationDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("certification_import_items")
      .select("id, original_file_name, mime_type, status, extraction_provider, extracted_data, confidence, created_at, processed_at, error_message, upload_sequence, certification_type, jurisdiction, program_codes, review_queue_status, queued_for_review_at, tenant_profile_id, unit_id, property_id, portfolio_tenant_profiles(household_name), portfolio_units(unit_number), portfolio_properties(name)")
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
