import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const uploader = read("src/lib/certification-upload.ts");
const browserExtraction = read("src/lib/pdf-ocr.ts");
const serverExtraction = read("src/lib/certification-extraction.server.ts");
const intakeUi = read("src/components/portfolio-intake-panel.tsx");
const review = read("src/utils/certification-review.functions.ts");
const migration = read(
  "supabase/migrations/20260904191637_certification_pipeline_performance_metrics.sql",
);
const intakeOptimization = read(
  "supabase/migrations/20260904194503_optimize_certification_import_items.sql",
);

test("large certification uploads use direct resumable storage with progress and retry", () => {
  assert.match(
    uploader,
    /RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 \* 1024 \* 1024/,
  );
  assert.match(uploader, /RESUMABLE_UPLOAD_CHUNK_BYTES = 6 \* 1024 \* 1024/);
  assert.match(uploader, /\.storage\.supabase\.co/);
  assert.match(uploader, /"tus-resumable": TUS_VERSION/);
  assert.match(uploader, /"upload-offset"/);
  assert.match(uploader, /onProgress\?\./);
  assert.match(uploader, /RETRY_DELAYS_MS/);
  assert.match(
    intakeUi,
    /uploadCertificationFile\([\s\S]*?"certification-imports",[\s\S]*?storagePath,[\s\S]*?file/,
  );
  assert.match(
    intakeUi,
    /uploadCertificationFile\([\s\S]*?"certification-imports",[\s\S]*?path,[\s\S]*?file/,
  );
});

test("document extraction is shared, bounded, and reused during review", () => {
  assert.match(browserExtraction, /const sharedOcrPool = createOcrWorkerPool/);
  assert.match(browserExtraction, /sharedOcrPool\.run\(workerCount/);
  assert.match(browserExtraction, /MAX_PARALLEL_TEXT_READERS = 6/);
  assert.match(browserExtraction, /kind: ["']machine-readable["'][\s\S]*sidecar:/);
  assert.doesNotMatch(browserExtraction, /ocrWorker\.terminate/);
  assert.match(
    serverExtraction,
    /if \(!composed\.text\.trim\(\)\) return null/,
  );
  assert.match(review, /const documentSha256 = await sha256Hex\(bytes\)/);
  assert.match(review, /item\.sha256 && item\.sha256 !== documentSha256/);
});

test("per-document upload and extraction timings are persisted", () => {
  for (const field of [
    "upload_duration_ms",
    "extraction_duration_ms",
    "total_intake_duration_ms",
    "upload_transport",
  ]) {
    assert.match(migration, new RegExp(field));
    assert.match(intakeUi, new RegExp(field));
  }
  assert.match(migration, /add column if not exists/);
  assert.match(
    migration,
    /check \(upload_transport is null or upload_transport in \('standard', 'tus'\)\)/,
  );
});

test("the intake table keeps one strict policy and indexed portfolio relationships", () => {
  assert.match(intakeOptimization, /drop policy if exists "users manage own import items"/);
  for (const column of ["property_id", "unit_id", "tenant_profile_id"]) {
    assert.match(intakeOptimization, new RegExp(`on public\\.certification_import_items\\(${column}\\)`));
  }
});


