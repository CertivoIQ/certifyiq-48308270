import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  MAX_SOURCE_BYTES,
  createCapturedSourceRecord,
  isOfficialSourceUrl,
} from "../src/lib/nationwide-state-source-evidence-pipeline.mjs";

const inventory = JSON.parse(
  await readFile(new URL("../src/lib/nationwide-state-source-discovery.json", import.meta.url)),
);
const outputDirectory = resolve(process.env.STATE_SOURCE_EVIDENCE_OUTPUT_DIR ?? "artifacts/state-source-evidence");
const retrievedAt = new Date().toISOString();
const USER_AGENT = "Mozilla/5.0 (compatible; CertivoIQ-StateSourceEvidence/1.0; +https://certivoiq.com)";

function flattenCandidates() {
  return inventory.jurisdictions.flatMap((jurisdiction) =>
    jurisdiction.sources.map((source) => ({ jurisdiction, source })),
  );
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SOURCE_BYTES) throw new Error("SOURCE_DECLARED_SIZE_EXCEEDS_LIMIT");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SOURCE_BODY_UNAVAILABLE");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel("SOURCE_SIZE_EXCEEDS_LIMIT");
      throw new Error("SOURCE_SIZE_EXCEEDS_LIMIT");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function fetchOnlyOfficialSource(jurisdiction, source) {
  let currentUrl = source.url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!isOfficialSourceUrl(currentUrl, jurisdiction.official_domain)) {
      return { finalUrl: currentUrl, fetchError: "REDIRECT_TARGET_NOT_OFFICIAL_ALLOWLISTED" };
    }
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: { accept: "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8", "user-agent": USER_AGENT },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { finalUrl: currentUrl, httpStatus: response.status, fetchError: "REDIRECT_LOCATION_MISSING" };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    const body = response.ok ? await readBoundedBody(response) : new Uint8Array();
    return {
      finalUrl: currentUrl,
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      declaredContentLength: response.headers.get("content-length"),
      body,
    };
  }
  return { finalUrl: currentUrl, fetchError: "REDIRECT_LIMIT_EXCEEDED" };
}

async function extractPdfText(bytes) {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await getDocument({ data: bytes, disableWorker: true }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 20); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent();
      pages.push(text.items.map((item) => item.str ?? "").join(" "));
    }
    return pages.join(" ");
  } catch {
    return null;
  }
}

async function captureCandidate({ jurisdiction, source }) {
  try {
    const response = await fetchOnlyOfficialSource(jurisdiction, source);
    let extractedText = null;
    const isPdf = String(response.contentType ?? "").toLowerCase().includes("pdf") ||
      Buffer.from(response.body ?? []).subarray(0, 5).toString("ascii") === "%PDF-";
    if (response.body?.byteLength && isPdf) extractedText = await extractPdfText(response.body);
    return createCapturedSourceRecord({ jurisdiction, source, retrievedAt, extractedText, ...response });
  } catch (error) {
    return createCapturedSourceRecord({
      jurisdiction,
      source,
      retrievedAt,
      fetchError: error instanceof Error ? error.message : String(error),
    });
  }
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

const records = await mapConcurrent(flattenCandidates(), 6, captureCandidate);
const counts = records.reduce((summary, record) => {
  summary[record.source_evidence_status] = (summary[record.source_evidence_status] ?? 0) + 1;
  return summary;
}, {});
const manifest = {
  title: "Nationwide state-source exact-byte capture manifest",
  capture_build: "nationwide-state-source-evidence-2026.08.27.1",
  captured_at: retrievedAt,
  source_inventory_title: inventory.title,
  source_inventory_generated_at: inventory.generated_at,
  activation_policy: "SOURCE CAPTURE CREATES NO STATE RULE PACK AND CANNOT ACTIVATE COMPLIANCE RULES. Hashes and declared dates require content validation, supersession reconciliation, deterministic rule fixtures, independent compliance approval, and property-specific authority before release.",
  counts,
  sources: records,
};
await mkdir(outputDirectory, { recursive: true });
const fileName = `nationwide-state-source-capture-${retrievedAt.replace(/[:.]/g, "-")}.json`;
await writeFile(resolve(outputDirectory, fileName), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ artifact: basename(fileName), source_count: records.length, counts }, null, 2));
