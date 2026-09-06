/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { MAX_UPLOAD_BYTES, sidecarPathFor } from "@/lib/ocr-sidecar.mjs";
import { isOcrSupportedFile, prepareCertificationForReview } from "@/lib/pdf-ocr";
import { uploadCertificationFile } from "@/lib/certification-upload";
import { PORTFOLIO_IMPORT_TEMPLATE, parsePortfolioIntakeCsv } from "@/lib/portfolio-intake";
import {
  createPortfolioIntake,
  finalizePortfolioIntake,
  listPortfolioSummary,
} from "@/lib/portfolio-intake.functions";

type Db = any;

const singleDocumentTypes = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_PARALLEL_DOCUMENTS = 3;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function PortfolioIntakePanel() {
  const queryClient = useQueryClient();
  const createIntake = useServerFn(createPortfolioIntake);
  const finalizeIntake = useServerFn(finalizePortfolioIntake);
  const listSummary = useServerFn(listPortfolioSummary);
  const { isActive: hasPaidSubscription } = useSubscription();
  const [manifest, setManifest] = useState<File | null>(null);
  const [documents, setDocuments] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const summary = useQuery({ queryKey: ["portfolio-intake-summary"], queryFn: () => listSummary() });
  const totalBytes = useMemo(() => documents.reduce((sum, file) => sum + file.size, 0), [documents]);

  function setStage(percent: number, label: string) {
    setProgressPercent(clampPercent(percent));
    setProgressLabel(label);
  }

  function resetProgress() {
    setProgress({ current: 0, total: 0 });
    setProgressPercent(0);
    setProgressLabel("");
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([PORTFOLIO_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "certivoiq-portfolio-tenant-intake-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function chooseManifest(file: File | null) {
    if (!file) {
      setManifest(null);
      return;
    }
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      setManifest(null);
      setMessage("The portfolio mapping file must be a CSV. For one PDF or image, use the certification document selector instead; no CSV is required.");
      return;
    }
    setManifest(file);
    setMessage("");
    resetProgress();
  }

  async function uploadSingleDocument() {
    if (documents.length !== 1 || busy) return;
    const file = documents[0]!;
    setBusy(true);
    setMessage(`Preparing ${file.name} for secure single-document intake…`);
    setProgress({ current: 1, total: 1 });
    setStage(1, "Starting secure intake…");

    let jobId: string | null = null;
    let storagePath: string | null = null;
    let completed = false;
    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} exceeds the 50 MB per-file limit.`);
      if (!isOcrSupportedFile(file)) throw new Error("Single-document intake accepts PDF, PNG, JPEG, or WEBP files only.");

      setStage(3, "Checking your secure session…");
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please sign in before uploading a certification document.");
      const db = supabase as unknown as Db;

      setStage(5, "Creating the intake record…");
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
      setStage(8, "Uploading securely while reading the certification…");

      const pipelineStartedAt = performance.now();
      const preparationStartedAt = performance.now();
      let extractionDurationMs = 0;
      let uploadPercent = 0;
      let preparationPercent = 0;
      const updateConcurrentProgress = (label: string) => {
        setStage(8 + (uploadPercent * 0.35 + preparationPercent * 0.65) * 0.82, label);
      };
      const uploadPromise = uploadCertificationFile("certification-imports", storagePath, file, (uploadedBytes, total) => {
        uploadPercent = total ? (uploadedBytes / total) * 100 : 0;
        updateConcurrentProgress(`Uploading ${file.name}: ${clampPercent(uploadPercent)}%…`);
      });
      const preparePromise = prepareCertificationForReview(file, (status, nextPreparationPercent) => {
        preparationPercent = clampPercent(nextPreparationPercent);
        updateConcurrentProgress(status);
        setMessage(`${file.name}: ${status}`);
      }).then((result) => {
        extractionDurationMs = performance.now() - preparationStartedAt;
        return result;
      });

      const [uploadOutcome, prepareOutcome] = await Promise.allSettled([uploadPromise, preparePromise]);
      if (uploadOutcome.status === "rejected") throw uploadOutcome.reason;
      if (prepareOutcome.status === "rejected") throw prepareOutcome.reason;
      const prepared = prepareOutcome.value;

      setStage(90, "Secure upload and document reading complete…");
      if (prepared.sidecar) {
        setStage(92, "Saving extracted text and page provenance…");
        const { error: sidecarError } = await supabase.storage.from("certification-imports")
          .upload(sidecarPathFor(storagePath), new Blob([JSON.stringify(prepared.sidecar)], { type: "application/json" }), { upsert: true });
        if (sidecarError) throw sidecarError;
      }

      setStage(96, "Recording the certification in CertivoIQ…");
      const { error: itemError } = await db.from("certification_import_items").insert({
        job_id: job.id,
        user_id: user.id,
        storage_path: storagePath,
        original_file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        sha256: prepared.sourceSha256,
        upload_duration_ms: Math.round(uploadOutcome.value.durationMs),
        extraction_duration_ms: Math.round(extractionDurationMs),
        total_intake_duration_ms: Math.round(performance.now() - pipelineStartedAt),
        upload_transport: uploadOutcome.value.transport,
        status: "completed",
        upload_sequence: 0,
        review_queue_status: "not_queued",
      });
      if (itemError) throw itemError;

      setStage(98, "Finalizing intake…");
      const { error: completeError } = await db.from("certification_import_jobs").update({
        status: "completed",
        processed_files: 1,
        error_count: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id).eq("user_id", user.id);
      if (completeError) throw completeError;

      completed = true;
      setDocuments([]);
      setStage(100, "Complete");
      setMessage(`Single-document intake complete: ${file.name} is stored securely and was not queued for compliance review. Add a CSV only when you want documents mapped to property, unit, and tenant profiles.`);
      await queryClient.invalidateQueries({ queryKey: ["certification-items"] });
    } catch (error) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (storagePath) {
        await supabase.storage.from("certification-imports").remove([storagePath, sidecarPathFor(storagePath)]).catch(() => undefined);
      }
      if (jobId && userId) {
        const db = supabase as unknown as Db;
        await db.from("certification_import_jobs").update({
          status: "failed",
          processed_files: 0,
          error_count: 1,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId).eq("user_id", userId);
      }
      setMessage(error instanceof Error ? error.message : "The certification document could not be uploaded.");
    } finally {
      setBusy(false);
      setProgress({ current: 0, total: 0 });
      if (!completed) {
        setProgressPercent(0);
        setProgressLabel(documents.length === 1 ? "Ready to process selected certification." : "");
      }
    }
  }

  async function importPortfolio() {
    if (!manifest || busy) return;
    setBusy(true);
    setMessage("Validating property, unit, tenant, and document mappings…");
    setProgress({ current: 0, total: documents.length });
    setStage(1, "Validating portfolio mappings…");
    let jobId: string | null = null;
    let uploaded = 0;
    let completed = false;
    try {
      const rows = parsePortfolioIntakeCsv(await manifest.text());
      if ((rows.length > 1 || documents.length > 1) && !hasPaidSubscription) {
        throw new Error("Mass property and tenant intake requires an active CertivoIQ subscription.");
      }
      for (const file of documents) {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} exceeds the 50 MB per-file limit.`);
      }
      const filesByName = new Map(documents.map((file) => [file.name.toLowerCase(), file]));
      const referencedNames = new Set(rows.map((row) => row.documentFileName?.toLowerCase()).filter(Boolean));
      const missing = [...referencedNames].filter((name) => !filesByName.has(name!));
      if (missing.length) throw new Error(`The manifest references document files that were not selected: ${missing.join(", ")}`);
      const unmatched = documents.filter((file) => !referencedNames.has(file.name.toLowerCase()));
      if (unmatched.length) throw new Error(`Selected documents must be assigned in document_file_name: ${unmatched.map((file) => file.name).join(", ")}`);

      setStage(5, "Creating property, unit, and tenant mappings…");
      const intake = await createIntake({ data: {
        rows,
        documentCount: documents.length,
        sourceName: manifest.name,
      } });
      jobId = intake.jobId;
      const mappingByName = new Map(intake.documentMappings.map((mapping) => [mapping.documentFileName.toLowerCase(), mapping]));
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please sign in before importing portfolio data.");
      const userId = user.id;
      const db = supabase as unknown as Db;

      const filePercents = Array.from({ length: documents.length }, () => 0);
      let nextSequence = 0;

      const updateFileProgress = (sequence: number, percent: number, label: string) => {
        filePercents[sequence] = clampPercent(percent);
        const aggregate = filePercents.reduce((sum, value) => sum + value, 0) / Math.max(1, filePercents.length);
        setStage(8 + aggregate * 0.82, label);
      };

      async function processDocument(sequence: number) {
        const file = documents[sequence]!;
        const mapping = mappingByName.get(file.name.toLowerCase());
        if (!mapping) throw new Error(`No tenant mapping was created for ${file.name}.`);

        updateFileProgress(sequence, 2, `Starting ${sequence + 1} of ${documents.length}: ${file.name}`);
        setMessage(`Uploading and reading ${sequence + 1} of ${documents.length}: ${file.name}`);
        const path = `${userId}/${intake.jobId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const pipelineStartedAt = performance.now();
        let uploadPercent = 0;
        let preparationPercent = isOcrSupportedFile(file) ? 0 : 100;
        const updateConcurrentProgress = (label: string) => {
          updateFileProgress(sequence, 5 + (uploadPercent * 0.35 + preparationPercent * 0.65) * 0.72, label);
        };
        const uploadPromise = uploadCertificationFile("certification-imports", path, file, (uploadedBytes, total) => {
          uploadPercent = total ? (uploadedBytes / total) * 100 : 0;
          updateConcurrentProgress(`${file.name}: upload ${clampPercent(uploadPercent)}%…`);
        });

        const preparationStartedAt = performance.now();
        let extractionDurationMs = 0;
        const preparationPromise = isOcrSupportedFile(file)
          ? prepareCertificationForReview(file, (status, nextPreparationPercent) => {
              preparationPercent = clampPercent(nextPreparationPercent);
              updateConcurrentProgress(`${file.name}: ${status}`);
            }).then((result) => {
              extractionDurationMs = performance.now() - preparationStartedAt;
              return result;
            })
          : Promise.resolve(null);

        const [uploadOutcome, preparationOutcome] = await Promise.allSettled([
          uploadPromise,
          preparationPromise,
        ]);
        if (uploadOutcome.status === "rejected") throw uploadOutcome.reason;
        if (preparationOutcome.status === "rejected") throw preparationOutcome.reason;
        const prepared = preparationOutcome.value;

        updateFileProgress(sequence, 82, `Saving extracted text for ${file.name}…`);
        if (prepared?.sidecar) {
          const { error: sidecarError } = await supabase.storage.from("certification-imports")
            .upload(sidecarPathFor(path), new Blob([JSON.stringify(prepared.sidecar)], { type: "application/json" }), { upsert: true });
          if (sidecarError) throw sidecarError;
        }

        const { data: item, error: itemError } = await db.from("certification_import_items").insert({
          job_id: intake.jobId, user_id: userId, storage_path: path, original_file_name: file.name,
          mime_type: file.type || "application/octet-stream", size_bytes: file.size,
          sha256: prepared?.sourceSha256 ?? null,
          upload_duration_ms: Math.round(uploadOutcome.value.durationMs),
          extraction_duration_ms: Math.round(extractionDurationMs),
          total_intake_duration_ms: Math.round(performance.now() - pipelineStartedAt),
          upload_transport: uploadOutcome.value.transport,
          property_id: mapping.propertyId, unit_id: mapping.unitId, tenant_profile_id: mapping.tenantProfileId,
          upload_sequence: sequence, certification_type: mapping.certificationType,
          jurisdiction: mapping.jurisdiction, program_codes: mapping.programCodes,
          status: "completed", review_queue_status: "not_queued",
        }).select("id").single();
        if (itemError) throw itemError;
        const { error: documentError } = await db.from("portfolio_tenant_documents").insert({
          user_id: userId, tenant_profile_id: mapping.tenantProfileId,
          certification_import_item_id: item.id, storage_path: path, original_file_name: file.name,
          document_category: "certification_support",
        });
        if (documentError) throw documentError;

        uploaded += 1;
        updateFileProgress(sequence, 100, `Completed ${uploaded} of ${documents.length}: ${file.name}`);
        setProgress({ current: uploaded, total: documents.length });
      }

      async function runDocumentWorker() {
        while (nextSequence < documents.length) {
          const sequence = nextSequence;
          nextSequence += 1;
          await processDocument(sequence);
        }
      }

      const workerCount = Math.min(MAX_PARALLEL_DOCUMENTS, Math.max(1, documents.length));
      await Promise.all(Array.from({ length: workerCount }, () => runDocumentWorker()));

      setStage(95, "Finalizing portfolio intake…");
      await finalizeIntake({ data: { jobId: intake.jobId, itemCount: uploaded, errorCount: 0 } });
      setManifest(null);
      setDocuments([]);
      completed = true;
      setStage(100, "Complete");
      setMessage(`Intake complete: ${intake.propertyCount} properties, ${intake.unitCount} units, ${intake.tenantCount} tenant profiles, and ${uploaded} documents. Nothing was queued for compliance review.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolio-intake-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["certification-items"] }),
      ]);
    } catch (error) {
      if (jobId) {
        try { await finalizeIntake({ data: { jobId, itemCount: uploaded, errorCount: 1 } }); } catch { /* preserve the original intake failure */ }
      }
      setMessage(error instanceof Error ? error.message : "The portfolio intake could not be completed.");
    } finally {
      setBusy(false);
      if (!completed) {
        setProgressPercent(0);
        setProgressLabel("");
      }
    }
  }

  async function submitIntake() {
    if (manifest) {
      await importPortfolio();
      return;
    }
    if (documents.length === 1) {
      await uploadSingleDocument();
      return;
    }
    setMessage("Choose one certification document, or choose a CSV when importing mapped property/unit/tenant data.");
  }

  const canSubmit = !busy && (!!manifest || documents.length === 1);
  const showProgress = true; // Always render so users can verify progress UI before selecting a file.

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Property, unit & tenant intake</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Upload one certification document directly, or add a CSV to map documents into property, unit, and tenant profiles. Uploading never starts a compliance review.
            </p>
          </div>
        </div>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
          <Download className="size-4" /> Download CSV template
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center hover:bg-muted/30">
          <FileSpreadsheet className="size-7 text-muted-foreground" />
          <span className="mt-2 font-medium">Choose CSV for portfolio mapping</span>
          <span className="mt-1 text-xs text-muted-foreground">{manifest?.name ?? "Optional for one document · required for property/unit/tenant mapping"}</span>
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => chooseManifest(event.target.files?.[0] ?? null)} />
        </label>
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center hover:bg-muted/30">
          <UploadCloud className="size-7 text-muted-foreground" />
          <span className="mt-2 font-medium">{hasPaidSubscription ? "Choose certification documents" : "Choose one certification document"}</span>
          <span className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPEG, or WEBP · up to 50 scanned pages · 50 MB each · one file needs no CSV</span>
          <input className="sr-only" type="file" multiple={hasPaidSubscription} accept={singleDocumentTypes} onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            setDocuments(selected);
            setMessage("");
            resetProgress();
            if (selected.length === 1) setProgressLabel("Ready to process selected certification.");
          }} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
        <span>{documents.length} document{documents.length === 1 ? "" : "s"} · {(totalBytes / 1024 / 1024).toFixed(1)} MB</span>
        <button type="button" disabled={!canSubmit} onClick={submitIntake} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Processing…" : manifest ? "Import profiles & documents" : documents.length === 1 ? "Upload single document" : "Import profiles & documents"}
        </button>
      </div>

      {showProgress ? (
        <div className="mt-3 rounded-lg border bg-background p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-muted-foreground">{progressLabel || "Choose a certification to begin."}</span>
            <span className="font-semibold tabular-nums text-foreground">{progressPercent}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Certification intake progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {busy && progress.total > 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">Document {progress.current} of {progress.total}</p>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-3 rounded-lg border bg-background p-3 text-sm" role="status">{message}</p> : null}

      {summary.data?.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr><th className="py-2 pr-4">Property</th><th className="py-2 pr-4">State</th><th className="py-2 pr-4">Units</th><th className="py-2">Tenants</th></tr></thead>
            <tbody>{summary.data.map((property) => <tr key={property.id} className="border-b last:border-0"><td className="py-2 pr-4 font-medium">{property.name}</td><td className="py-2 pr-4">{property.state_code}</td><td className="py-2 pr-4">{property.unitCount}</td><td className="py-2">{property.tenantCount}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

