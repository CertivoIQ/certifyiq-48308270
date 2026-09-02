/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function organizationIdFor(userId: string) {
  return `org-${userId}`;
}

function restrictedDocumentError() {
  return new Error(
    "Restricted VAWA documents are not processed through standard Document Intelligence. A safeguarded VAWA document workflow is required.",
  );
}

export const recognizeCertificationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => {
    if (!data?.itemId || data.itemId.length > 100) throw new Error("A certification item id is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: item, error: itemError } = await supabase
      .from("certification_import_items")
      .select("id,storage_path,original_file_name,mime_type")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("That certification document is not available.");

    const recognitionModule = await import("@/lib/compliance-form-recognition.mjs");
    const filenamePreflight = recognitionModule.recognizeComplianceForm({
      fileName: item.original_file_name,
      text: "",
    });
    if (
      filenamePreflight.status === "recognized" &&
      recognitionModule.isRestrictedSensitiveFormCode(filenamePreflight.formCode)
    ) {
      throw restrictedDocumentError();
    }

    const download = await supabase.storage.from("certification-imports").download(item.storage_path);
    if (download.error || !download.data) throw new Error("The stored certification document could not be read.");

    const bytes = await download.data.arrayBuffer();
    const [{ sha256Hex }, extraction, serverClient] = await Promise.all([
      import("@/lib/complianceDecisionAndManifest"),
      import("@/lib/certification-extraction.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    const documentSha256 = await sha256Hex(bytes);

    let text = "";
    let sidecar = null as Awaited<ReturnType<typeof extraction.loadOcrDocument>>;
    const sidecarDownload = await supabase.storage
      .from("certification-imports")
      .download(extraction.sidecarPathFor(item.storage_path));
    if (sidecarDownload.data) {
      try {
        sidecar = extraction.loadOcrDocument(JSON.parse(await sidecarDownload.data.text()), {
          fileName: item.original_file_name,
          sha256: documentSha256,
          byteSize: bytes.byteLength,
        });
      } catch {
        sidecar = null;
      }
    }
    if (sidecar) {
      text = sidecar.text;
    } else {
      text = (await extraction.extractDocumentText(bytes, item.mime_type, item.original_file_name)).text;
    }

    const recognition = recognitionModule.recognizeComplianceForm({
      fileName: item.original_file_name,
      text,
    });
    if (
      recognition.status === "recognized" &&
      recognitionModule.isRestrictedSensitiveFormCode(recognition.formCode)
    ) {
      throw restrictedDocumentError();
    }

    const admin = serverClient.supabaseAdmin as any;

    let registryForm: any = null;
    if (recognition.status === "recognized" && recognition.formCode) {
      const { data: registryRows, error: registryError } = await admin
        .from("compliance_form_registry")
        .select("id,form_code,form_name,revision_label,effective_from,effective_to,support_status,validation_support")
        .eq("form_code", recognition.formCode)
        .order("effective_from", { ascending: false, nullsFirst: false })
        .limit(1);
      if (registryError) throw registryError;
      registryForm = registryRows?.[0] ?? null;
    }

    const recognitionStatus = recognition.status === "recognized"
      ? recognitionModule.registryRecognitionDisposition(registryForm)
      : recognition.status;
    const reviewStatus =
      registryForm?.support_status === "validated_supported" && recognitionStatus === "recognized"
        ? "not_required"
        : "pending_analyst_verification";

    const { data: instance, error: instanceError } = await admin
      .from("certification_document_instances")
      .upsert({
        certification_item_id: item.id,
        user_id: userId,
        organization_id: organizationIdFor(userId),
        registry_form_id: registryForm?.id ?? null,
        detected_form_code: recognition.formCode ?? null,
        detected_revision: null,
        recognition_status: recognitionStatus,
        confidence: recognition.confidence ?? null,
        source_document_ref: item.original_file_name,
        source_page: null,
        evidence_snippet: recognition.snippet ?? null,
        document_sha256: documentSha256,
        review_status: reviewStatus,
        updated_at: new Date().toISOString(),
      }, { onConflict: "certification_item_id" })
      .select("id,registry_form_id,detected_form_code,recognition_status,confidence,review_status")
      .single();
    if (instanceError) throw instanceError;

    return {
      instance,
      registry: registryForm,
      candidates: recognition.candidates ?? [],
    };
  });
