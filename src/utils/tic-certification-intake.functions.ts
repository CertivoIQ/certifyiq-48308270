import { calculateTicWorksheet, assertTicWorksheetSettings, newTicWorksheetSettings, type TicWorksheetSettings } from "@/lib/tic-calculations";
import { buildIncomePreparation, validateIncomePreparation, assertIncomeDraft, type IncomeDraft } from "@/lib/certification-income-evidence";
import { ticCompletenessFindings } from "@/lib/tic-completeness";
import { previewEvidenceValue } from "@/lib/preview-evidence-value";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TIC_FIELD_KEYS,
  TIC_FIELD_KEY_SET,
  ticFieldDefinition,
  ticFieldIsNumeric,
} from "@/lib/tic-field-registry";
import {
  SUPPORTING_DOCUMENT_TYPE_SET,
  supportingDocumentLabel,
  type SupportingDocumentType,
} from "@/lib/tic-supporting-document-registry";
import { composeSidecarText, provenanceIndex } from "@/lib/ocr-sidecar.mjs";
import { buildPacketSelection, selectionFromHistory, initialPageChoices, packetInventory, selectedSupportingPages, selectedTicText, selectedWorksheetText, validatePageChoices, type PacketPageChoice } from "@/lib/tic-packet-selection";

const REVIEWER_CONFIRMED_PROVIDER = "reviewer-confirmed";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  field: string;
  value: string | number | null;
};

type SupportingClassificationChoice = SupportingDocumentType | "tic_page";

type SupportingDocumentChoice = {
  id: string;
  documentType: SupportingClassificationChoice;
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
  if (value === null || String(value).trim() === "") return null;
  if (ticFieldIsNumeric(field)) {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[$,%\s]/g, ""));
    if (!Number.isFinite(numeric)) throw new Error(`${ticFieldDefinition(field)?.label ?? field} must be a number.`);
    return numeric;
  }
  const text = String(value).trim();
  if (text.length > 500) throw new Error(`${ticFieldDefinition(field)?.label ?? field} is too long.`);
  return text || null;
}

async function extractStagedSource(supabase: any, userId: string, source: StagedCertificationSource, pageChoices?: PacketPageChoice[]) {
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
  const ticExtraction = await import("@/lib/tic-field-extraction");
  const { sha256Hex, hashJson } = await import("@/lib/complianceDecisionAndManifest");
  const download = await supabase.storage.from("certification-imports").download(source.storagePath);
  if (download.error || !download.data) throw new Error("The staged certification file could not be read for extraction.");

  const bytes = await download.data.arrayBuffer();
  const sourceSha256 = await sha256Hex(bytes);
  if (bytes.byteLength !== Number(source.sizeBytes) || source.sha256.toLowerCase() !== sourceSha256.toLowerCase()) {
    throw new Error("The staged certification does not match the uploaded source bytes.");
  }

  const sidecarDownload = await supabase.storage.from("certification-imports").download(extraction.sidecarPathFor(source.storagePath));
  if (sidecarDownload.error || !sidecarDownload.data) throw new Error("The source-bound page inventory is unavailable. Re-upload the packet; extraction will not guess its page boundaries.");
  const composed = composeSidecarText(JSON.parse(await sidecarDownload.data.text()), {
    fileName: source.originalFileName, sha256: sourceSha256, byteSize: bytes.byteLength,
  });
  const textByPage = new Map(composed.pages.map(page => [page.page, page.text]));
  const packetPages = Array.from({ length: composed.sourceIdentity.pageCount }, (_, index) => ({
    page: index + 1, text: textByPage.get(index + 1) ?? "",
  }));
  const pageClassifications = packetInventory(packetPages);
  const selection = pageChoices ? buildPacketSelection(packetPages, pageChoices, sourceSha256) : null;
  const result = ticExtraction.extractTicFieldsFromText(
    selection ? selectedTicText(packetPages, selection) : "",
    source.originalFileName,
    provenanceIndex(composed.pages),
  );
  if (selection) {
    const worksheet = ticExtraction.extractTicFieldsFromText(selectedWorksheetText(packetPages, selection), source.originalFileName, provenanceIndex(composed.pages));
    const existing = new Set(result.facts.map(f => f.field));
    const supplemental = worksheet.facts.filter(f => /^(?:worksheet_|source_present_worksheet_)/.test(f.field) && !existing.has(f.field));
    result.facts.push(...supplemental);
    const fields = new Set(result.facts.map(f => f.field));
    result.missingFields = result.missingFields.filter(field => !fields.has(field));
    if (supplemental.some(f => f.provider === 'ocr-tesseract')) result.provider = 'ocr-tesseract';
  }
  result.facts = result.facts.filter(f => !/^(?:source_present_)?application_/.test(f.field));
  result.missingFields = result.missingFields.filter(f => !/^(?:source_present_)?application_/.test(f));
  const confidence = result.facts.length ? result.facts.reduce((sum, fact) => sum + Number(fact.confidence || 0), 0) / result.facts.length : 0;
  const supportingDocuments = selection ? selectedSupportingPages(selection, pageClassifications) : [];
  const selectionDigest = selection ? await hashJson(selection) : null;
  const incomePreparation = selection && selectionDigest ? buildIncomePreparation(packetPages, selection.choices, sourceSha256, selectionDigest, String(result.facts.find(f => f.field === "certification_effective_date")?.value ?? "")) : null;
  return { result, confidence, sourceSha256, packetPages, pageClassifications, supportingDocuments, selection, selectionDigest, incomePreparation };

}

export const listCertificationTenantDestinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { data, error } = await db
      .from("portfolio_tenant_profiles")
      .select("id, household_name, property_id, unit_id, certification_type, certification_effective_date, portfolio_units(unit_number), portfolio_properties(name)")
      .eq("user_id", context.userId)
      .order("household_name")
      .limit(2000);
    if (error) throw error;
    return (data ?? []).map((profile) => ({
      id: profile.id,
      householdName: profile.household_name,
      propertyId: profile.property_id,
      unitId: profile.unit_id,
      propertyName: profile.portfolio_properties?.name ?? null,
      unitNumber: profile.portfolio_units?.unit_number ?? null,
      certificationType: profile.certification_type ?? null,
      certificationEffectiveDate: profile.certification_effective_date ?? null,
    }));
  });

/** Read staged source bytes and return a complete, editable TIC preview plus read-only packet documents. */
export const extractCertificationTicPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { source: StagedCertificationSource; pageSelections?: PacketPageChoice[] }) => ({
    source: validateSource(data.source),
    ...(data.pageSelections === undefined ? {} : { pageSelections: validatePageChoices(data.pageSelections, undefined, true) }),
  }))
  .handler(async ({ data, context }) => {
    try {
      const { result, confidence, pageClassifications, supportingDocuments, selection, selectionDigest, incomePreparation } = await extractStagedSource(
        context.supabase,
        context.userId,
        data.source,
        data.pageSelections,
      );
      const signed = await context.supabase.storage
        .from("certification-imports")
        .createSignedUrl(data.source.storagePath, 20 * 60);
      return {
        facts: result.facts.map((fact) => ({
          field: fact.field,
          value: previewEvidenceValue(fact.value),
          page: fact.page,
          snippet: fact.snippet,
          confidence: fact.confidence,
          provider: fact.provider ?? result.provider,
        })),
        missingFields: result.missingFields,
        allFields: TIC_FIELD_KEYS,
        extractionProvider: result.provider,
        confidence,
        sourcePreviewUrl: signed.data?.signedUrl ?? null,
        pageClassifications,
        pageSelections: selection?.choices ?? initialPageChoices(pageClassifications),
        selectionDigest,
        ticPages: selection?.ticPages ?? [],
        omittedPages: selection?.omittedPages ?? [],
        supportingDocuments,
        incomePreparation,
      } as const;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The certification document could not be extracted." } as const;
    }
  });

/**
 * Save reviewer-confirmed TIC values and preserve supporting pages as read-only
 * tenant documents beneath the certification. OCR-proposed fields keep source
 * provenance; values supplied during review are never represented as OCR facts.
 */
export const confirmCertificationTicPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    source: StagedCertificationSource;
    fields: ConfirmedField[];
    tenantProfileId?: string | null;
    standaloneJurisdiction?: string;
    worksheetSettings?: TicWorksheetSettings;
    sourceTicFields?: Record<string,string>;
    supportingDocuments?: SupportingDocumentChoice[];
    pageSelections: PacketPageChoice[];
    selectionDigest: string;
    otherReviewAction?: "INITIAL" | "ANNUAL" | "INTERIM";
    startReview?: boolean;
    incomeDraft?: IncomeDraft;
  }) => {
    assertIncomeDraft(data.incomeDraft);
    const source = validateSource(data.source);
    const pageSelections = validatePageChoices(data.pageSelections, undefined, true);
    if (typeof data.selectionDigest !== "string" || !/^[a-f0-9]{64}$/i.test(data.selectionDigest)) throw new Error("Confirm packet pages and rebuild the TIC before saving.");
    if (data.otherReviewAction && !["INITIAL", "ANNUAL", "INTERIM"].includes(data.otherReviewAction)) throw new Error("Select a valid review action for Other certification.");
    if (data.supportingDocuments?.length) throw new Error("Document selections changed. Reload intake and choose each packet page before saving.");
    if(data.tenantProfileId&&!UUID_PATTERN.test(data.tenantProfileId))throw new Error("The selected tenant file is invalid.");
    if(data.standaloneJurisdiction&&!/^[A-Z]{2}$/.test(data.standaloneJurisdiction))throw new Error("Use a two-letter certification state.");
    if(data.worksheetSettings)assertTicWorksheetSettings(data.worksheetSettings);
    if(data.sourceTicFields&&(!data.sourceTicFields||typeof data.sourceTicFields!=='object'||Array.isArray(data.sourceTicFields)||Object.entries(data.sourceTicFields).some(([k,v])=>!TIC_FIELD_KEY_SET.has(k)||typeof v!=='string'||v.length>500)))throw new Error("Invalid source TIC fields.");
    if (!Array.isArray(data.fields) || data.fields.length > TIC_FIELD_KEYS.length) {
      throw new Error("The TIC field confirmation is invalid.");
    }
    const seen = new Set<string>();
    const fields = data.fields.map((entry) => {
      if (!entry || !TIC_FIELD_KEY_SET.has(entry.field)) throw new Error("An unsupported TIC field was submitted.");
      if (seen.has(entry.field)) throw new Error("A TIC field was submitted more than once.");
      seen.add(entry.field);
      return { field: entry.field, value: entry.value ?? null };
    });
    const supportingDocuments = Array.isArray(data.supportingDocuments)
      ? data.supportingDocuments.map((entry) => {
          if (!entry?.id || entry.id.length > 200) throw new Error("A supporting-document page group is invalid.");
          const type = entry.documentType;
          if (type !== "tic_page" && !SUPPORTING_DOCUMENT_TYPE_SET.has(type)) {
            throw new Error("A supporting-document type is invalid.");
          }
          return { id: entry.id, documentType: type };
        })
      : [];
    if (new Set(supportingDocuments.map((entry) => entry.id)).size !== supportingDocuments.length) {
      throw new Error("A supporting-document page group was submitted more than once.");
    }
    return {
      source,
      fields,
      tenantProfileId: data.tenantProfileId || null,
      standaloneJurisdiction: data.standaloneJurisdiction,
      worksheetSettings: data.worksheetSettings,
      sourceTicFields: data.sourceTicFields,
      pageSelections,
      selectionDigest: data.selectionDigest,
      otherReviewAction: data.otherReviewAction,
      supportingDocuments,
      startReview: data.startReview === true,
      incomeDraft: data.incomeDraft,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;
    const { result, confidence, sourceSha256, supportingDocuments: serverSupportingDocuments, selection, selectionDigest, incomePreparation } = await extractStagedSource(
      supabase,
      userId,
      data.source,
      data.pageSelections,
    );
    if (!selection || data.selectionDigest !== selectionDigest) throw new Error("The selected packet pages no longer match this TIC preview. Rebuild the TIC from the current selections before saving.");

    const {data:access,error:accessError}=await db.rpc("income_calculator_access");
    if(accessError||!access?.allowed)throw new Error(access?.reason||"Certification review access could not be verified.");
    let tenant:any=null;
    if(data.tenantProfileId){
    const { data: selectedTenant, error: tenantError } = await db
      .from("portfolio_tenant_profiles")
      .select("id, property_id, unit_id, household_name, program_codes, portfolio_properties(jurisdiction)")
      .eq("id", data.tenantProfileId)
      .eq("user_id", userId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!selectedTenant) throw new Error("The selected tenant file is not available to this account.");
    tenant=selectedTenant;
    }

    if (!incomePreparation) throw new Error("Complete the Income Calculator before saving this certification.");
    // Recalculate from the reviewer's confirmed form. sourceTicFields is the
    // immutable OCR snapshot used below for correction history; using it here
    // discards confirmed handwriting and user-supplied values at save time.
    const workingSource=Object.fromEntries(data.fields.map(f=>[f.field,f.value==null?'':String(f.value)]));
    const worksheet=calculateTicWorksheet(workingSource,data.worksheetSettings||newTicWorksheetSettings());
    const incomeDraft=data.incomeDraft?.basis==='TIC'?{...data.incomeDraft,ticWorksheet:{values:workingSource,settings:data.worksheetSettings||newTicWorksheetSettings()}}:data.incomeDraft;
    const preparedIncome = validateIncomePreparation(incomeDraft, incomePreparation);

    const originalByField = new Map(result.facts.map((fact) => [fact.field, fact]));
    const submittedByField = new Map(data.fields.map((entry) => [entry.field, entry.value]));
    const originalExtractedData = Object.fromEntries(result.facts.map((fact) => [fact.field, fact.value]));
    const confirmedExtractedData: Record<string, string | number> = {};
    const corrections: Array<{ field: string; extractedValue: unknown; confirmedValue: unknown }> = [];
    const reviewerSuppliedFields: Array<{ field: string; confirmedValue: unknown }> = [];

    for (const field of TIC_FIELD_KEYS) {
      if (/^(?:source_present_)?application_/.test(field)) continue;
      const original = originalByField.get(field);
      const wasSubmitted = submittedByField.has(field);
      const submitted = field.startsWith("source_present_") ? original?.value ?? null : worksheet.calculated[field] ?? (wasSubmitted ? submittedByField.get(field)! : original?.value ?? null);
      const confirmed = normalizeConfirmedValue(field, submitted as string | number | null);
      if (confirmed !== null) confirmedExtractedData[field] = confirmed;
      if (original) {
        if (JSON.stringify(confirmed) !== JSON.stringify(original.value)) {
          corrections.push({ field, extractedValue: original.value, confirmedValue: confirmed });
        }
      } else if (confirmed !== null) {
        reviewerSuppliedFields.push({ field, confirmedValue: confirmed });
      }
    }

    // Only explicitly included supporting pages become tenant documents; omitted pages stay in the original source only.
    const finalSupportingDocuments = serverSupportingDocuments;
    const ticType = String(confirmedExtractedData["certification_type"] ?? "").toLowerCase();
    const certificationType = ticType === "initial certification" ? "INITIAL" : ticType === "recertification" ? "ANNUAL" : ticType === "other" ? data.otherReviewAction ?? null : null;
    if (data.startReview && !certificationType) throw new Error("Confirm the TIC certification type (and an explicit review action for Other) before starting review.");

    if (String(confirmedExtractedData["certification_effective_date"] ?? "") !== preparedIncome.draft.effectiveDate) throw new Error("The TIC effective date changed. Return to the Income Calculator and recalculate for that date.");
    // Keep the signed source amount intact. The derived projection accompanies it for review.
    confirmedExtractedData["calculated_projected_annual_income"] = preparedIncome.calculation.annualIncome!;
    const completionFindings = ticCompletenessFindings(confirmedExtractedData);
    if (data.startReview && completionFindings.length) throw new Error(completionFindings.map(f => f.message).join(" "));

    const programFields:Record<string,string>={program_type_lihtc:'LIHTC',program_type_home:'HOME',program_type_tax_exempt_bond:'TAX_EXEMPT_BOND',program_type_rural_development:'RURAL_DEVELOPMENT',program_type_hud:'HUD_MFH_PROJECT_BASED'};
    const declaredPrograms=Object.entries(programFields).filter(([field])=>String(confirmedExtractedData[field]||'').toLowerCase()==='yes').map(([,program])=>program);
    if(!tenant&&data.startReview&&(!data.standaloneJurisdiction||!declaredPrograms.length))throw new Error("Confirm the certification state and applicable program checkboxes before starting the standalone review.");
    const confirmedAt = new Date().toISOString();
    const { data: item, error: itemError } = await db
      .from("certification_import_items")
      .insert({
        job_id: data.source.jobId,
        user_id: userId,
        property_id: tenant?.property_id ?? null,
        unit_id: tenant?.unit_id ?? null,
        tenant_profile_id: tenant?.id ?? null,
        storage_path: data.source.storagePath,
        original_file_name: data.source.originalFileName,
        mime_type: data.source.mimeType,
        size_bytes: data.source.sizeBytes,
        sha256: sourceSha256,
        status: "processing",
        extraction_provider: result.provider,
        certification_type: certificationType,
        jurisdiction: tenant?.portfolio_properties?.jurisdiction ?? data.standaloneJurisdiction ?? null,
        program_codes: Array.isArray(tenant?.program_codes) ? tenant.program_codes : declaredPrograms,
        extracted_data: confirmedExtractedData,
        historical_changes: [{
          type: "tic_pre_save_confirmation",
          standalone: !tenant,
          tic_worksheet: {settings:data.worksheetSettings||newTicWorksheetSettings(),source_values:workingSource,calculated:worksheet.calculated,formulas:worksheet.formulas,differences:worksheet.differences},
          income_preparation_version: preparedIncome.draft.version,
          income_preparation: { ...preparedIncome, pages: incomePreparation.pages.map(({ excerpt: _excerpt, ...page }) => page) },
          confirmed_at: confirmedAt,
          reviewer_id: userId,
          tenant_profile_id: tenant?.id ?? null,
          packet_selection: selection,
          packet_selection_digest: selectionDigest,
          page_classification_version: "tic-packet-selection:1",
          original_extracted_data: originalExtractedData,
          confirmed_extracted_data: confirmedExtractedData,
          completion_findings: completionFindings,
          corrections,
          reviewer_supplied_fields: reviewerSuppliedFields,
          preserved_supporting_documents: finalSupportingDocuments.map((document) => ({
            type: document.documentType,
            page_start: document.pageStart,
            page_end: document.pageEnd,
            page_numbers: document.pageNumbers,
          })),
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
      const confirmedFacts = Object.entries(confirmedExtractedData).filter(([field]) => field !== "calculated_projected_annual_income").map(([field, value]) => {
        const original = originalByField.get(field);
        const corrected = !original || JSON.stringify(original.value) !== JSON.stringify(value);
        return {
          item_id: item.id,
          user_id: userId,
          organization_id: `org-${userId}`,
          field_name: field,
          field_value: value as never,
          source_document_ref: data.source.originalFileName,
          source_page: original?.page ?? null,
          source_snippet: worksheet.formulas[field] ? "Calculated from confirmed TIC inputs: "+worksheet.formulas[field] : original?.snippet ?? "Entered during pre-save TIC review; OCR did not provide a value for this field.",
          confidence: original?.confidence ?? 1,
          human_verified: true,
          required_for_decision: original?.requiredForDecision ?? false,
          extraction_provider: worksheet.calculated[field] ? "calculated-tic-worksheet" : corrected ? REVIEWER_CONFIRMED_PROVIDER : original?.provider ?? REVIEWER_CONFIRMED_PROVIDER,
        };
      });
      if (confirmedFacts.length) {
        const { error: factError } = await supabaseAdmin.from("certification_facts").insert(confirmedFacts);
        if (factError) throw factError;
      }

      if (finalSupportingDocuments.length) {
        const supportingRows = finalSupportingDocuments.map((document) => ({
          user_id: userId,
          tenant_profile_id: tenant?.id ?? null,
          certification_import_item_id: item.id,
          storage_path: data.source.storagePath,
          original_file_name: data.source.originalFileName,
          document_category: "certification_support",
          document_type: document.documentType,
          display_name: supportingDocumentLabel(document.documentType),
          mime_type: data.source.mimeType,
          size_bytes: data.source.sizeBytes,
          sha256: sourceSha256,
          source_kind: "packet_page_range",
          source_page_start: document.pageStart,
          source_page_end: document.pageEnd,
          source_page_numbers: document.pageNumbers,
          classification_confidence: document.confidence,
          classification_basis: document.classificationBasis,
          immutable: true,
          printable: true,
          review_status: "pending_review",
          metadata: {
            parent_file_name: data.source.originalFileName,
            parent_sha256: sourceSha256,
            source_page_reference: true,
          },
        }));
        const { error: supportingError } = await supabaseAdmin.from("portfolio_tenant_documents").insert(supportingRows);
        if (supportingError) throw supportingError;
      }

      if (completionFindings.length) {
        const { error: completionError } = await supabaseAdmin.from("compliance_findings").insert(completionFindings.map(f => ({
          item_id: item.id, user_id: userId, organization_id: `org-${userId}`,
          rule_id: `TIC-COMPLETE-${f.field}`, rule_version: "1", rule_pack_id: "tic-completeness", rule_pack_version: "1",
          jurisdiction: tenant?.portfolio_properties?.jurisdiction ?? data.standaloneJurisdiction ?? "US", status: "UNABLE_TO_DETERMINE", severity: "critical",
          explanation: f.message, blocking_reasons: [f.code], evidence_refs: [{ field: f.field }],
          engine_build: "tic-completeness:1", review_state: "unable_to_determine",
        })));
        if (completionError) throw completionError;
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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("portfolio_tenant_documents").delete().eq("certification_import_item_id", item.id);
      await db.from("certification_import_items").delete().eq("id", item.id).eq("user_id", userId);
      throw error;
    }

    return {
      itemId: item.id,
      extractedData: confirmedExtractedData,
      correctionCount: corrections.length,
      reviewerSuppliedCount: reviewerSuppliedFields.length,
      supportingDocumentCount: finalSupportingDocuments.length,
      omittedPageCount: selection.omittedPages.length,
      tenantProfileId: tenant?.id ?? null,
      reviewQueueStatus: data.startReview ? "queued" : "not_queued",
      queuedForReview: data.startReview,
    } as const;
  });

export const listCertificationSupportingDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!UUID_PATTERN.test(String(data?.itemId ?? ""))) throw new Error("A certification item id is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("portfolio_tenant_documents")
      .select("id, certification_import_item_id, tenant_profile_id, storage_path, original_file_name, document_category, document_type, display_name, mime_type, size_bytes, sha256, source_kind, source_page_start, source_page_end, source_page_numbers, classification_confidence, classification_basis, immutable, printable, review_status, reviewed_at, created_at")
      .eq("certification_import_item_id", data.itemId)
      .eq("user_id", context.userId)
      .order("source_page_start", { ascending: true });
    if (error) throw error;

    return Promise.all((rows ?? []).map(async (row: any) => {
      const signed = await context.supabase.storage
        .from("certification-imports")
        .createSignedUrl(row.storage_path, 20 * 60);
      const baseUrl = signed.data?.signedUrl ?? null;
      const pageFragment = row.source_page_start && /application\/pdf/i.test(row.mime_type ?? "")
        ? `#page=${row.source_page_start}`
        : "";
      return {
        ...row,
        display_name: row.display_name ?? supportingDocumentLabel(row.document_type),
        open_url: baseUrl ? `${baseUrl}${pageFragment}` : null,
        page_range_label: row.source_page_start
          ? row.source_page_end && row.source_page_end !== row.source_page_start
            ? `Pages ${row.source_page_start}–${row.source_page_end}`
            : `Page ${row.source_page_start}`
          : "Standalone document",
      };
    }));
  });

export const markCertificationSupportingDocumentReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => {
    if (!UUID_PATTERN.test(String(data?.documentId ?? ""))) throw new Error("A tenant document id is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const reviewedAt = new Date().toISOString();
    const { data: row, error } = await db
      .from("portfolio_tenant_documents")
      .update({ review_status: "reviewed", reviewed_at: reviewedAt, reviewed_by: context.userId })
      .eq("id", data.documentId)
      .eq("user_id", context.userId)
      .select("id, review_status, reviewed_at")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("That supporting document is not available.");
    return row;
  });

export const cancelCertificationTicPreview = createServerFn({ method: "POST" })
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

/** Saved include/omit scope for the review screen; original source pages are retained. */
export const getCertificationPacketSelection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!UUID_PATTERN.test(String(data?.itemId ?? ""))) throw new Error("A certification item id is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase.from("certification_import_items")
      .select("id, sha256, historical_changes").eq("id", data.itemId).eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    if (!item) throw new Error("That certification is not available to this account.");
    return selectionFromHistory(item.historical_changes, item.sha256 ?? "");
  });

