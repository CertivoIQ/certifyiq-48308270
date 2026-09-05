/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, UploadCloud } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, sidecarPathFor } from "@/lib/ocr-sidecar.mjs";
import { isOcrSupportedFile, prepareCertificationForReview } from "@/lib/pdf-ocr";
import { uploadCertificationFile } from "@/lib/certification-upload";

type Db = any;

const ACCEPTED_DOCUMENT_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function CertificationUploadPanel() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Choose a certification to begin.");

  async function uploadCertification() {
    if (!file || busy) return;

    setBusy(true);
    setMessage("");
    setProgressPercent(1);
    setProgressLabel("Starting secure certification intake…");

    let jobId: string | null = null;
    let storagePath: string | null = null;
    let completed = false;

    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} exceeds the 50 MB per-file limit.`);
      if (!isOcrSupportedFile(file)) throw new Error("Certification intake accepts PDF, PNG, JPEG, or WEBP files only.");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please sign in before uploading a certification document.");
      const db = supabase as unknown as Db;

      setProgressPercent(5);
      setProgressLabel("Creating the certification intake record…");
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
        updateConcurrentProgress(`Uploading ${file.name}: ${clampPercent(uploadPercent)}%…`);
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
      setProgressLabel("Saving extracted text and page provenance…");
      if (prepared.sidecar) {
        const { error: sidecarError } = await supabase.storage.from("certification-imports")
          .upload(
            sidecarPathFor(storagePath),
            new Blob([JSON.stringify(prepared.sidecar)], { type: "application/json" }),
            { upsert: true },
          );
        if (sidecarError) throw sidecarError;
      }

      setProgressPercent(96);
      setProgressLabel("Recording the certification in CertivoIQ…");
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

      const { error: completeError } = await db.from("certification_import_jobs").update({
        status: "completed",
        processed_files: 1,
        error_count: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id).eq("user_id", user.id);
      if (completeError) throw completeError;

      completed = true;
      setFile(null);
      setProgressPercent(100);
      setProgressLabel("Certification upload complete.");
      setMessage(`${file.name} is stored with OCR evidence and provenance. It has not been queued for compliance review yet.`);
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
      if (!completed) {
        setProgressPercent(0);
        setProgressLabel(file ? "Ready to process selected certification." : "Choose a certification to begin.");
      }
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <FileUp className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Certification document intake</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Upload a certification package for OCR and evidence preparation. This workspace does not create properties, units, or tenant profiles.
          </p>
        </div>
      </div>

      <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30">
        <UploadCloud className="size-8 text-muted-foreground" />
        <span className="mt-3 font-medium">Choose certification document</span>
        <span className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPEG, or WEBP · up to 50 scanned pages · 50 MB</span>
        <span className="mt-2 text-xs font-medium text-foreground">{file?.name ?? "No certification selected"}</span>
        <input
          className="sr-only"
          type="file"
          accept={ACCEPTED_DOCUMENT_TYPES}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setMessage("");
            setProgressPercent(0);
            setProgressLabel(selected ? "Ready to process selected certification." : "Choose a certification to begin.");
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
          {busy ? "Processing…" : "Upload certification & prepare OCR"}
        </button>
      </div>

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
