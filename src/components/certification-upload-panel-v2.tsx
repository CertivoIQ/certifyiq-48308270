/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { FileSearch, FileUp, UploadCloud } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, sidecarPathFor } from "@/lib/ocr-sidecar.mjs";
import { isOcrSupportedFile, prepareCertificationForReview } from "@/lib/pdf-ocr";
import { uploadCertificationFile } from "@/lib/certification-upload";
import {
  TIC_FIELD_DEFINITIONS,
  TIC_FIELD_SECTIONS,
  type TicFieldDefinition,
} from "@/lib/tic-field-registry";
import {
  cancelCertificationTicPreview,
  confirmCertificationTicPreview,
  extractCertificationTicPreview,
} from "@/utils/tic-certification-intake.functions";

type Db = any;

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

type ExtractionDraft = {
  source: DraftSource;
  facts: PreviewFact[];
  missingFields: string[];
  confidence: number;
  extractionProvider: string;
  sourcePreviewUrl: string | null;
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

function FieldEditor({
  definition,
  fact,
  value,
  busy,
  onChange,
}: {
  definition: TicFieldDefinition;
  fact?: PreviewFact;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
}) {
  const original = fact ? fieldText(fact.value) : "";
  const changed = fact ? value.trim() !== original.trim() : value.trim().length > 0;
  const status = fact
    ? `Page ${fact.page ?? "—"} · ${Math.round(Number(fact.confidence) * 100)}% confidence${changed ? " · corrected" : ""}`
    : value.trim()
      ? "Entered during review"
      : "Not extracted — enter if shown on the certification";

  return (
    <label className="block rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{definition.label}</span>
        <span className="text-xs text-muted-foreground">{status}</span>
      </div>
      {definition.type === "yes_no" ? (
        <select
          className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Not entered</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : (
        <input
          className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={value}
          disabled={busy}
          inputMode={definition.type === "currency" || definition.type === "number" ? "decimal" : undefined}
          placeholder={definition.placeholder ?? (fact ? "" : "Enter value if present")}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {fact?.snippet ? <p className="mt-2 text-xs text-muted-foreground">Source: “{fact.snippet}”</p> : null}
      {fact && changed ? <p className="mt-1 text-xs text-muted-foreground">OCR value: {original || "blank"}</p> : null}
    </label>
  );
}

export function CertificationUploadPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const extractPreview = useServerFn(extractCertificationTicPreview);
  const confirmPreview = useServerFn(confirmCertificationTicPreview);
  const cancelPreview = useServerFn(cancelCertificationTicPreview);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExtractionDraft | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveAction, setSaveAction] = useState<"save" | "review" | null>(null);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Choose a certification to begin.");

  const factsByField = useMemo(
    () => new Map((draft?.facts ?? []).map((fact) => [fact.field, fact])),
    [draft],
  );

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
        .upload(
          sidecarPathFor(storagePath),
          sidecarBytes,
          { upsert: true, contentType: OCR_SIDECAR_STORAGE_MIME },
        );
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
      setProgressLabel("Preparing every TIC field for your review…");
      const preview = await extractPreview({ data: { source } });
      if ("error" in preview && preview.error) throw new Error(preview.error);

      const facts = preview.facts as PreviewFact[];
      const extractedByField = new Map(facts.map((fact) => [fact.field, fieldText(fact.value)]));
      setFieldValues(Object.fromEntries(
        TIC_FIELD_DEFINITIONS.map((definition) => [definition.key, extractedByField.get(definition.key) ?? ""]),
      ));
      setDraft({
        source,
        facts,
        missingFields: [...preview.missingFields],
        confidence: Number(preview.confidence || 0),
        extractionProvider: preview.extractionProvider,
        sourcePreviewUrl: preview.sourcePreviewUrl,
      });
      setFile(null);
      setProgressPercent(100);
      setProgressLabel("TIC extraction ready for review — document not saved yet.");
      setMessage("Review the certification beside the complete TIC field list. Correct OCR values and enter any field OCR missed before saving.");
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
      setProgressPercent(0);
      setProgressLabel("Certification intake could not be staged.");
      setMessage(error instanceof Error ? error.message : "The certification document could not be prepared for review.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndSave(startReview: boolean) {
    if (!draft || busy) return;
    setBusy(true);
    setSaveAction(startReview ? "review" : "save");
    setMessage("");
    setProgressPercent(98);
    setProgressLabel(startReview ? "Saving confirmed TIC information and starting review…" : "Saving confirmed TIC information…");
    try {
      const result = await confirmPreview({
        data: {
          source: draft.source,
          fields: TIC_FIELD_DEFINITIONS.map((definition) => ({
            field: definition.key,
            value: fieldValues[definition.key] ?? "",
          })),
          startReview,
        },
      });
      const changes = result.correctionCount + result.reviewerSuppliedCount;
      const changeText = changes
        ? ` ${result.correctionCount} OCR correction${result.correctionCount === 1 ? "" : "s"} and ${result.reviewerSuppliedCount} previously missed field${result.reviewerSuppliedCount === 1 ? "" : "s"} were recorded in the audit history.`
        : " No field changes were needed.";
      setDraft(null);
      setFieldValues({});
      setProgressPercent(100);
      if (result.queuedForReview) {
        setProgressLabel("Certification saved and queued for review.");
        setMessage(`Document saved to Documents.${changeText} It is now in the Compliance Review Queue.`);
      } else {
        setProgressLabel("Certification document saved.");
        setMessage(`Document saved to Documents.${changeText} It has not been queued for compliance review.`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["certification-items"] }),
        queryClient.invalidateQueries({ queryKey: ["certification-review"] }),
      ]);
      if (result.queuedForReview) {
        await navigate({ to: "/files", search: { item: result.itemId } });
      }
    } catch (error) {
      setProgressPercent(100);
      setProgressLabel("TIC review is still open — document not saved.");
      setMessage(error instanceof Error ? error.message : "The confirmed document could not be saved.");
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
      setProgressPercent(0);
      setProgressLabel("Choose a certification to begin.");
      setMessage("Staged upload cancelled. No certification document was saved.");
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
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            Upload a Tenant Income Certification for OCR and evidence preparation. The full TIC field set is shown for review and correction before anything is saved to Documents. This workspace does not create properties, units, or tenant profiles.
          </p>
        </div>
      </div>

      {!draft ? (
        <>
          <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30">
            <UploadCloud className="size-8 text-muted-foreground" />
            <span className="mt-3 font-medium">Choose certification document</span>
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
                setProgressLabel(selected ? "Ready to extract selected certification." : "Choose a certification to begin.");
              }}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : "One certification package per upload"}</span>
            <button
              type="button"
              disabled={!file || busy}
              onClick={() => void uploadCertification()}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Extracting…" : "Upload & extract for review"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Review and correct the complete TIC before saving</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {draft.source.originalFileName} is temporarily staged only. OCR-proposed values are prefilled; every standard TIC question remains editable even when OCR did not recover a value.
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="rounded-full border bg-background px-2 py-1">{Math.round(draft.confidence * 100)}% average confidence on extracted fields</div>
              <div className="mt-1">{draft.facts.length} extracted · {draft.missingFields.length} available for completion</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
            <div className="rounded-xl border bg-background p-3 xl:sticky xl:top-4 xl:self-start">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <FileSearch className="size-4" />
                Staged source certification
              </div>
              {draft.sourcePreviewUrl ? (
                isPdfSource(draft.source) ? (
                  <iframe
                    title={`Source certification ${draft.source.originalFileName}`}
                    src={draft.sourcePreviewUrl}
                    className="h-[72vh] min-h-[640px] w-full rounded-lg border bg-white"
                  />
                ) : (
                  <div className="max-h-[72vh] overflow-auto rounded-lg border bg-white p-2">
                    <img src={draft.sourcePreviewUrl} alt="Staged certification source" className="mx-auto max-w-full" />
                  </div>
                )
              ) : (
                <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Source preview is temporarily unavailable. The certification remains staged and unsaved; you may cancel and retry before confirming any field.
                </p>
              )}
            </div>

            <div className="max-h-[78vh] space-y-4 overflow-y-auto pr-1">
              {TIC_FIELD_SECTIONS.map((section) => {
                const definitions = TIC_FIELD_DEFINITIONS.filter((definition) => definition.section === section);
                return (
                  <details key={section} open className="rounded-xl border bg-background">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                      {section} <span className="font-normal text-muted-foreground">({definitions.length} fields)</span>
                    </summary>
                    <div className="space-y-3 border-t p-3">
                      {definitions.map((definition) => (
                        <FieldEditor
                          key={definition.key}
                          definition={definition}
                          fact={factsByField.get(definition.key)}
                          value={fieldValues[definition.key] ?? ""}
                          busy={busy}
                          onChange={(value) => setFieldValues((values) => ({ ...values, [definition.key]: value }))}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-lg border bg-background p-3 text-sm">
            Compare every populated field to the source certification. Blank fields are not treated as evidence. Values you enter for fields OCR missed are recorded as review-confirmed entries with a separate audit trail.
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelStagedUpload()}
              className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel Upload
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmAndSave(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saveAction === "save" ? "Saving…" : "Save Document"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmAndSave(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saveAction === "review" ? "Saving & queuing…" : "Save & Start Review"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg border bg-background p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-muted-foreground">{progressLabel}</span>
          <span className="font-semibold tabular-nums text-foreground">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Certification intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {message ? <p className="mt-3 rounded-lg border bg-background p-3 text-sm" role="status">{message}</p> : null}
    </section>
  );
}
