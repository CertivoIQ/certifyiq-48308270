import { ticCompletenessFindings } from "@/lib/tic-completeness";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { FileSearch, FileText, FileUp, UploadCloud } from "lucide-react";

import { TicPacketOrganizer } from "@/components/tic-packet-organizer";
import { validatePageChoices, type PacketPageChoice, type PacketPageInventory } from "@/lib/tic-packet-selection";
import { CertivoIqTicReviewForm } from "@/components/certivoiq-tic-review-form";
import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, sidecarPathFor } from "@/lib/ocr-sidecar.mjs";
import { isOcrSupportedFile, prepareCertificationForReview } from "@/lib/pdf-ocr";
import { uploadCertificationFile } from "@/lib/certification-upload";
import { TIC_FIELD_DEFINITIONS } from "@/lib/tic-field-registry";
import {
  SUPPORTING_DOCUMENT_DEFINITIONS,
  type SupportingDocumentType,
} from "@/lib/tic-supporting-document-registry";
import {
  cancelCertificationTicPreview,
  confirmCertificationTicPreview,
  extractCertificationTicPreview,
  listCertificationTenantDestinations,
} from "@/utils/tic-certification-intake.functions";

type Db = any;
type SupportingClassificationChoice = SupportingDocumentType | "tic_page";

type PreviewFact = {
  field: string;
  value: unknown;
  page: number | null;
  snippet: string | null;
  confidence: number;
  provider: string;
};

type DraftSource = {
  jobId: string;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadDurationMs: number;
  extractionDurationMs: number;
  totalIntakeDurationMs: number;
  uploadTransport: string;
};

type SupportingPreviewGroup = {
  id: string;
  documentType: SupportingDocumentType;
  label: string;
  pageStart: number;
  pageEnd: number;
  pageNumbers: number[];
  confidence: number;
  classificationBasis: string;
};

type ExtractionDraft = {
  source: DraftSource;
  facts: PreviewFact[];
  missingFields: string[];
  confidence: number;
  extractionProvider: string;
  sourcePreviewUrl: string | null;
  supportingDocuments: SupportingPreviewGroup[];
  pageClassifications: PacketPageInventory[];
  selectionDigest: string | null;
  ticPages: number[];
  omittedPages: number[];
};

const ACCEPTED_DOCUMENT_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";
const OCR_SIDECAR_STORAGE_MIME = "application/octet-stream";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fieldText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function isPdfSource(source: DraftSource) {
  return /application\/pdf/i.test(source.mimeType) || /\.pdf$/i.test(source.originalFileName);
}

function sourcePageUrl(baseUrl: string | null, source: DraftSource, page: number) {
  if (!baseUrl) return null;
  return isPdfSource(source) ? `${baseUrl}#page=${page}` : baseUrl;
}

export function CertificationUploadPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const extractPreview = useServerFn(extractCertificationTicPreview);
  const confirmPreview = useServerFn(confirmCertificationTicPreview);
  const cancelPreview = useServerFn(cancelCertificationTicPreview);
  const listTenantDestinations = useServerFn(listCertificationTenantDestinations);

  const tenantDestinations = useQuery({
    queryKey: ["certification-tenant-destinations"],
    queryFn: () => listTenantDestinations(),
  });

  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExtractionDraft | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [pageChoices, setPageChoices] = useState<PacketPageChoice[]>([]);
  const [stage, setStage] = useState<"organize" | "tic">("organize");
  const [viewTicPage, setViewTicPage] = useState(1);
  const [otherReviewAction, setOtherReviewAction] = useState<"" | "INITIAL" | "ANNUAL" | "INTERIM">("");
  const [tenantProfileId, setTenantProfileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveAction, setSaveAction] = useState<"save" | "review" | null>(null);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Choose a certification to begin.");

  const factsByField = useMemo(
    () => new Map((draft?.facts ?? []).map((fact) => [fact.field, fact])),
    [draft],
  );

  useEffect(() => {
    if (!draft || tenantProfileId || tenantDestinations.data?.length !== 1) return;
    setTenantProfileId(tenantDestinations.data[0]!.id);
  }, [draft, tenantDestinations.data, tenantProfileId]);

  async function uploadCertification() {
    if (!file || busy || draft) return;
    setBusy(true);
    setMessage("");
    setProgressPercent(1);
    setProgressLabel("Starting secure certification intake…");

    let jobId: string | null = null;
    let storagePath: string | null = null;

    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} exceeds the 50 MB per-file limit.`);
      if (!isOcrSupportedFile(file)) throw new Error("Certification intake accepts PDF, PNG, JPEG, or WEBP files only.");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please sign in before uploading a certification document.");
      const db = supabase as unknown as Db;

      setProgressPercent(5);
      setProgressLabel("Creating a temporary intake workspace…");
      const { data: job, error: jobError } = await db.from("certification_import_jobs").insert({
        user_id: user.id,
        created_by: user.id,
        status: "processing",
        source_name: file.name,
        total_files: 1,
        intake_type: "certification_documents",
      }).select("id").single();
      if (jobError) throw jobError;
      jobId = job.id;

      storagePath = `${user.id}/${job.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const pipelineStartedAt = performance.now();
      const preparationStartedAt = performance.now();
      let extractionDurationMs = 0;
      let uploadPercent = 0;
      let preparationPercent = 0;

      const updateConcurrentProgress = (label: string) => {
        setProgressPercent(clampPercent(8 + (uploadPercent * 0.35 + preparationPercent * 0.65) * 0.82));
        setProgressLabel(label);
      };

      const uploadPromise = uploadCertificationFile("certification-imports", storagePath, file, (uploadedBytes, total) => {
        uploadPercent = total ? (uploadedBytes / total) * 100 : 0;
        updateConcurrentProgress(`Staging ${file.name}: ${clampPercent(uploadPercent)}%…`);
      });

      const preparePromise = prepareCertificationForReview(file, (status, nextPreparationPercent) => {
        preparationPercent = clampPercent(nextPreparationPercent);
        updateConcurrentProgress(status);
      }).then((result) => {
        extractionDurationMs = performance.now() - preparationStartedAt;
        return result;
      });

      const [uploadOutcome, prepareOutcome] = await Promise.allSettled([uploadPromise, preparePromise]);
      if (uploadOutcome.status === "rejected") throw uploadOutcome.reason;
      if (prepareOutcome.status === "rejected") throw prepareOutcome.reason;
      const prepared = prepareOutcome.value;

      setProgressPercent(92);
      setProgressLabel("Saving temporary OCR provenance…");
      const sidecarBytes = new Blob([JSON.stringify(prepared.sidecar)], { type: OCR_SIDECAR_STORAGE_MIME });
      const { error: sidecarError } = await supabase.storage.from("certification-imports")
        .upload(sidecarPathFor(storagePath), sidecarBytes, { upsert: true, contentType: OCR_SIDECAR_STORAGE_MIME });
      if (sidecarError) throw sidecarError;

      const source: DraftSource = {
        jobId: job.id,
        storagePath,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: prepared.sourceSha256,
        uploadDurationMs: Math.round(uploadOutcome.value.durationMs),
        extractionDurationMs: Math.round(extractionDurationMs),
        totalIntakeDurationMs: Math.round(performance.now() - pipelineStartedAt),
        uploadTransport: uploadOutcome.value.transport,
      };

      setProgressPercent(96);
      setProgressLabel("Identifying TIC pages and organizing other documents for your decision…");
      const preview = await extractPreview({ data: { source } });
      if ("error" in preview) throw new Error(preview.error || "The certification extraction could not be completed.");

      const facts = preview.facts as PreviewFact[];
      const supportingDocuments = preview.supportingDocuments as SupportingPreviewGroup[];
      const extractedByField = new Map(facts.map((fact) => [fact.field, fieldText(fact.value)]));
      setFieldValues(Object.fromEntries(
        TIC_FIELD_DEFINITIONS.map((definition) => [definition.key, extractedByField.get(definition.key) ?? ""]),
      ));
      setPageChoices(preview.pageSelections);
      setStage("organize");
      setOtherReviewAction("");
      setDraft({
        source,
        facts,
        missingFields: [...preview.missingFields],
        confidence: Number(preview.confidence || 0),
        extractionProvider: preview.extractionProvider,
        sourcePreviewUrl: preview.sourcePreviewUrl,
        supportingDocuments,
        pageClassifications: preview.pageClassifications,
        selectionDigest: preview.selectionDigest,
        ticPages: [...preview.ticPages],
        omittedPages: [...preview.omittedPages],
      });
      setFile(null);
      setProgressPercent(100);
      setProgressLabel("Packet identified — confirm which documents belong in this review.");
      setMessage("Detected TIC pages are preselected. Decide which remaining pages to include or omit before building the TIC. Nothing has been saved to the tenant file.");
    } catch (error) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (storagePath) {
        await supabase.storage.from("certification-imports").remove([storagePath, sidecarPathFor(storagePath)]).catch(() => undefined);
      }
      if (jobId && userId) {
        const db = supabase as unknown as Db;
        await db.from("certification_import_jobs").delete().eq("id", jobId).eq("user_id", userId);
      }
      setProgressLabel("Certification preparation stopped before staging.");
      setMessage(error instanceof Error ? error.message : "The certification document could not be prepared for review.");
    } finally {
      setBusy(false);
    }
  }

  function changePageChoices(choices: PacketPageChoice[]) {
    setPageChoices(choices);
    setFieldValues({});
    setOtherReviewAction("");
    setDraft(current => current ? { ...current, facts: [], selectionDigest: null, ticPages: [], supportingDocuments: [] } : null);
  }

  async function extractSelectedPages() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      validatePageChoices(pageChoices, draft.pageClassifications.length, true);
      const preview = await extractPreview({ data: { source: draft.source, pageSelections: pageChoices } });
      if ("error" in preview) throw new Error(preview.error || "The selected TIC pages could not be extracted.");
      const facts = preview.facts as PreviewFact[];
      const extracted = new Map(facts.map(fact => [fact.field, fieldText(fact.value)]));
      setFieldValues(Object.fromEntries(TIC_FIELD_DEFINITIONS.map(definition => [definition.key, extracted.get(definition.key) ?? ""])));
      setDraft({ ...draft, facts, missingFields: [...preview.missingFields], confidence: preview.confidence, extractionProvider: preview.extractionProvider,
        sourcePreviewUrl: preview.sourcePreviewUrl, supportingDocuments: preview.supportingDocuments, pageClassifications: preview.pageClassifications,
        selectionDigest: preview.selectionDigest, ticPages: [...preview.ticPages], omittedPages: [...preview.omittedPages] });
      setPageChoices(preview.pageSelections);
      setViewTicPage(preview.ticPages[0] ?? 1);
      setStage("tic");
      setProgressPercent(100);
      setProgressLabel("TIC built only from your selected certification pages.");
      const namesMissing = !extracted.get("household_member_1_last_name") || !extracted.get("household_member_1_first_name_middle_initial");
      setMessage(namesMissing ? "Household-name cells were not fully recovered. Compare the selected TIC with the source and correct unreadable or missed fields; this is not a completed extraction." : "Compare every populated cell with the selected source TIC. Included supporting pages are separate; omitted pages were not used to populate this form.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Selected-page extraction failed.");
    } finally { setBusy(false); }
  }

  async function confirmAndSave(startReview: boolean) {
    if (!draft || busy) return;
    if (startReview && ticCompletenessFindings(fieldValues).length) { setMessage("Complete the yellow findings before starting another review. You can still save your changes."); return; }
    if (stage !== "tic" || !draft.selectionDigest) { setMessage("Confirm document selection and rebuild the TIC before saving."); return; }
    if (!tenantProfileId) {
      setMessage("Select the tenant file before saving this certification packet.");
      return;
    }
    setBusy(true);
    setSaveAction(startReview ? "review" : "save");
    setMessage("");
    setProgressPercent(98);
    setProgressLabel(startReview ? "Saving TIC and supporting documents, then starting review…" : "Saving TIC and supporting documents…");
    try {
      const result = await confirmPreview({
        data: {
          source: draft.source,
          tenantProfileId,
          fields: TIC_FIELD_DEFINITIONS.map((definition) => ({
            field: definition.key,
            value: fieldValues[definition.key] ?? "",
          })),
          pageSelections: pageChoices,
          selectionDigest: draft.selectionDigest,
          ...(otherReviewAction ? { otherReviewAction } : {}),
          startReview,
        },
      });
      const changes = result.correctionCount + result.reviewerSuppliedCount;
      const changeText = changes
        ? ` ${result.correctionCount} OCR correction${result.correctionCount === 1 ? "" : "s"} and ${result.reviewerSuppliedCount} previously missed TIC field${result.reviewerSuppliedCount === 1 ? "" : "s"} were recorded.`
        : " No TIC field changes were needed.";
      const supportText = ` ${result.supportingDocumentCount} selected supporting page(s) preserved; ${result.omittedPageCount} page(s) omitted from review and retained only in the original packet.`;
      setDraft(null);
      setFieldValues({});
      setPageChoices([]);
      setStage("organize");
      setOtherReviewAction("");
      setTenantProfileId("");
      setProgressPercent(100);
      if (result.queuedForReview) {
        setProgressLabel("Certification packet saved and queued for review.");
        setMessage(`Certification saved to the tenant file.${changeText}${supportText} It is now in the Compliance Review Queue.`);
      } else {
        setProgressLabel("Certification packet saved.");
        setMessage(`Certification saved to the tenant file.${changeText}${supportText} It has not been queued for compliance review.`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["certification-items"] }),
        queryClient.invalidateQueries({ queryKey: ["certification-review"] }),
        queryClient.invalidateQueries({ queryKey: ["certification-supporting-documents"] }),
      ]);
      if (result.queuedForReview) {
        await navigate({ to: "/files", search: { item: result.itemId } });
      }
    } catch (error) {
      setProgressPercent(100);
      setProgressLabel("TIC review is still open — document not saved.");
      setMessage(error instanceof Error ? error.message : "The confirmed certification packet could not be saved.");
    } finally {
      setBusy(false);
      setSaveAction(null);
    }
  }

  async function cancelStagedUpload() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await cancelPreview({ data: { source: draft.source } });
      setDraft(null);
      setFieldValues({});
      setPageChoices([]);
      setStage("organize");
      setOtherReviewAction("");
      setTenantProfileId("");
      setProgressPercent(0);
      setProgressLabel("Choose a certification to begin.");
      setMessage("Staged upload cancelled. No certification or supporting document was saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The staged upload could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <FileUp className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Certification document intake</h2>
          <p className="mt-1 max-w-5xl text-sm text-muted-foreground">
            Upload the full Tenant Income Certification packet. First choose the TIC pages and which supporting documents to include or omit. CertivoIQ then maps only the selected TIC pages into the editable form.
          </p>
        </div>
      </div>

      {!draft ? (
        <>
          <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30">
            <UploadCloud className="size-8 text-muted-foreground" />
            <span className="mt-3 font-medium">Choose certification packet</span>
            <span className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPEG, or WEBP · up to 50 scanned pages · 50 MB</span>
            <span className="mt-2 text-xs font-medium text-foreground">{file?.name ?? "No certification selected"}</span>
            <input
              className="sr-only"
              type="file"
              accept={ACCEPTED_DOCUMENT_TYPES}
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setMessage("");
                setProgressPercent(0);
                setProgressLabel(selected ? "Ready to extract selected certification packet." : "Choose a certification to begin.");
              }}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : "One certification packet per upload"}</span>
            <button type="button" disabled={!file || busy} onClick={() => void uploadCertification()} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Identifying documents…" : "Upload & identify documents"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{stage === "organize" ? "Organize the uploaded packet" : "2. Check extracted TIC fields"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{draft.source.originalFileName} is temporarily staged only. Nothing appears in Documents or the Compliance Review Queue until you confirm it.</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{draft.pageClassifications.length} original packet pages</div>
              {stage === "tic" && <div className="mt-1">{draft.facts.length} proposed fields · confirm cell accuracy, not just OCR confidence</div>}
            </div>
          </div>

          {stage === "organize" ? (
            <TicPacketOrganizer inventory={draft.pageClassifications} choices={pageChoices} sourceUrl={draft.sourcePreviewUrl} isPdf={isPdfSource(draft.source)} busy={busy} onChange={changePageChoices} onConfirm={() => void extractSelectedPages()} />
          ) : <>
          <div className="mt-4 rounded border bg-background p-3 text-sm">
            <strong>TIC pages: {draft.ticPages.join(", ")}</strong> · {draft.supportingDocuments.length} included supporting page(s) · omitted pages: {draft.omittedPages.join(", ") || "None"}.
            <button type="button" disabled={busy} className="ml-3 underline" onClick={() => setStage("organize")}>Change document selection</button>
            <p className="mt-1 text-xs text-muted-foreground">Changing page roles clears unsaved field corrections and requires a fresh extraction. The original file is not altered.</p>
          </div>
          <div className="mt-4 rounded-xl border bg-background p-4">
            <label className="text-sm font-semibold" htmlFor="tenant-destination">Tenant file destination</label>
            <p className="mt-1 text-xs text-muted-foreground">The TIC and every preserved supporting document will be stored under this tenant.</p>
            <select id="tenant-destination" className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm" value={tenantProfileId} disabled={busy || tenantDestinations.isLoading} onChange={(event) => setTenantProfileId(event.target.value)}>
              <option value="">Select tenant file</option>
              {(tenantDestinations.data ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.householdName}{tenant.propertyName ? ` · ${tenant.propertyName}` : ""}{tenant.unitNumber ? ` · Unit ${tenant.unitNumber}` : ""}</option>
              ))}
            </select>
            {tenantDestinations.data?.length === 0 ? <p className="mt-2 text-xs text-destructive">No tenant profiles are available. Complete Portfolio & Tenant Onboarding before saving a certification.</p> : null}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border bg-background p-3 min-w-0 lg:sticky lg:top-4 lg:self-start">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileSearch className="size-4" /> Selected TIC source</div>
              <div className="mb-2 flex flex-wrap gap-2">{draft.ticPages.map(page => <button type="button" key={page} disabled={busy} aria-pressed={viewTicPage === page} className="rounded border px-2 py-1 text-xs" onClick={() => setViewTicPage(page)}>TIC page {page}</button>)}</div>
              {draft.sourcePreviewUrl ? (
                isPdfSource(draft.source) ? (
                  <iframe key={viewTicPage} title={`Source certification page ${viewTicPage}`} src={sourcePageUrl(draft.sourcePreviewUrl, draft.source, viewTicPage) ?? undefined} className="h-[78vh] min-h-[720px] w-full rounded-lg border bg-white" />
                ) : (
                  <div className="max-h-[78vh] overflow-auto rounded-lg border bg-white p-2"><img src={draft.sourcePreviewUrl} alt="Staged certification source" className="mx-auto max-w-full" /></div>
                )
              ) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Source preview is temporarily unavailable. The packet remains staged and unsaved.</p>}
            </div>

            <div className="min-w-0 max-h-[84vh] overflow-auto pr-1">
              <div className="mb-3 rounded-lg border bg-background p-3 text-sm">
                <strong>CertivoIQ TIC Review Form.</strong> Values are placed into the same logical sections and tables as the source TIC. A blank source field stays blank rather than inheriting nearby labels.
              </div>
              <CertivoIqTicReviewForm
                values={fieldValues}
                factsByField={factsByField}
                busy={busy}
                onChange={(field, value) => setFieldValues((current) => ({ ...current, [field]: value }))}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-background p-4">
            <h4 className="text-sm font-semibold">Included supporting documents</h4>
            <p className="mt-1 text-xs text-muted-foreground">Only these selected pages are included beneath the TIC. Source contents are preserved read-only.</p>
            {draft.supportingDocuments.map(document => <p className="mt-2 text-sm" key={document.id}>{document.label} · original page {document.pageStart} {draft.sourcePreviewUrl && <a className="underline" href={sourcePageUrl(draft.sourcePreviewUrl, draft.source, document.pageStart) ?? undefined} target="_blank" rel="noreferrer">Open source page</a>}</p>)}
            {!draft.supportingDocuments.length && <p className="mt-2 text-sm">No supporting documents selected. Required-evidence checks still apply.</p>}
          </div>
          {(fieldValues["certification_type"] ?? "").toLowerCase() === "other" && <label className="mt-4 block text-sm">Review action for Other certification
            <select className="ml-2 rounded border bg-background p-2" value={otherReviewAction} disabled={busy} onChange={e => setOtherReviewAction(e.target.value as typeof otherReviewAction)}><option value="">Select before starting review</option><option value="INITIAL">Initial</option><option value="ANNUAL">Annual recertification</option><option value="INTERIM">Interim</option></select>
          </label>}
          </>}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => void cancelStagedUpload()} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">Cancel Upload</button>
            <button type="button" disabled={busy || !tenantProfileId || stage !== "tic" || !draft.selectionDigest} onClick={() => void confirmAndSave(false)} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">{saveAction === "save" ? "Saving…" : "Save Document"}</button>
            <button type="button" disabled={busy || !tenantProfileId || stage !== "tic" || !draft.selectionDigest || ticCompletenessFindings(fieldValues).length > 0} onClick={() => void confirmAndSave(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saveAction === "review" ? "Saving & queuing…" : "Save & Start Review"}</button>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg border bg-background p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{progressLabel}</span><span className="font-semibold tabular-nums text-foreground">{progressPercent}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Certification intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} /></div>
      </div>
      {message ? <p className="mt-3 rounded-lg border bg-background p-3 text-sm" role="status">{message}</p> : null}
    </section>
  );
}

