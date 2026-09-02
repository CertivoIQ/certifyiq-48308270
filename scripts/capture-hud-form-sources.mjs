import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const inventory = JSON.parse(
  await readFile(new URL("../src/lib/hud-form-source-inventory.json", import.meta.url)),
);
const USER_AGENT = "Mozilla/5.0 (compatible; CertivoIQ-HUDFormEvidence/1.0; +https://certivoiq.com)";
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export function isOfficialHudUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "hud.gov" || host.endsWith(".hud.gov"));
  } catch {
    return false;
  }
}

async function readBoundedBody(response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_SOURCE_BYTES) throw new Error("SOURCE_DECLARED_SIZE_EXCEEDS_LIMIT");
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
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function fetchHudSource(source) {
  let currentUrl = source.url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!isOfficialHudUrl(currentUrl)) throw new Error("SOURCE_NOT_HUD_ALLOWLISTED");
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: "application/pdf,application/octet-stream,*/*;q=0.8",
        "user-agent": USER_AGENT,
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("REDIRECT_LOCATION_MISSING");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const body = await readBoundedBody(response);
    const magic = Buffer.from(body.subarray(0, 5)).toString("ascii");
    if (magic !== "%PDF-") throw new Error("SOURCE_NOT_PDF");
    return {
      final_url: currentUrl,
      http_status: response.status,
      content_type: response.headers.get("content-type"),
      byte_length: body.byteLength,
      sha256: createHash("sha256").update(body).digest("hex"),
      pdf_magic_verified: true,
    };
  }
  throw new Error("REDIRECT_LIMIT_EXCEEDED");
}

async function capture(source, retrievedAt) {
  try {
    const evidence = await fetchHudSource(source);
    return {
      ...source,
      ...evidence,
      retrieved_at: retrievedAt,
      source_evidence_status: "captured_exact_bytes",
      decision_use: false,
      support_status_change_authorized: false,
    };
  } catch (error) {
    return {
      ...source,
      retrieved_at: retrievedAt,
      source_evidence_status: "capture_failed",
      capture_error: error instanceof Error ? error.message : String(error),
      decision_use: false,
      support_status_change_authorized: false,
    };
  }
}

export async function runCapture() {
  const outputDirectory = resolve(process.env.HUD_FORM_EVIDENCE_OUTPUT_DIR ?? "artifacts/hud-form-source-evidence");
  const retrievedAt = new Date().toISOString();
  const sources = [];
  for (const source of inventory.sources) sources.push(await capture(source, retrievedAt));
  const counts = sources.reduce((acc, source) => {
    acc[source.source_evidence_status] = (acc[source.source_evidence_status] ?? 0) + 1;
    return acc;
  }, {});
  const manifest = {
    title: "CertivoIQ HUD form exact-byte capture manifest",
    captured_at: retrievedAt,
    activation_policy: inventory.activation_policy,
    counts,
    sources,
  };
  await mkdir(outputDirectory, { recursive: true });
  const fileName = `hud-form-source-capture-${retrievedAt.replace(/[:.]/g, "-")}.json`;
  await writeFile(resolve(outputDirectory, fileName), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ artifact: basename(fileName), counts }, null, 2));
  if (sources.some((source) => source.source_evidence_status !== "captured_exact_bytes")) process.exitCode = 1;
  return manifest;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCapture();
