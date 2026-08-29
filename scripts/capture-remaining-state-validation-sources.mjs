import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const configPath = resolve(root, "config/remaining-state-validation-sources.json");
const outputPath = resolve(root, process.argv[2] ?? "artifacts/remaining-state-source-evidence.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const isAllowedHost = (source, hostname) =>
  source.allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));

async function request(source, attempt, requestUrl) {
  const response = await fetch(requestUrl, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 CertivoIQ-Controlled-Capture/2.0",
      accept: "application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "sec-fetch-site": "none",
      "sec-fetch-mode": "navigate",
      "upgrade-insecure-requests": "1",
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const finalUrl = new URL(response.url);
  if (!isAllowedHost(source, finalUrl.hostname.toLowerCase())) throw new Error(`redirected_to_unapproved_host:${finalUrl.hostname}`);
  if (!response.ok) throw new Error(`http_status:${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("empty_response");
  const contentType = response.headers.get("content-type");
  return {
    ...source, retrievedAt: new Date().toISOString(), finalUrl: finalUrl.toString(),
    httpStatus: response.status, contentType, etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"), byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    captureKind: /text\/html|application\/xhtml\+xml/i.test(contentType ?? "") ? "authority_page_snapshot" : "controlled_document",
    captureStatus: "captured_unvalidated", independentValidationRequired: true,
    complianceActivationAllowed: false, attempt,
  };
}

async function capture(source) {
  let lastError;
  const requestUrls = [source.url, ...(source.fallbackUrls ?? [])];
  for (const requestUrl of requestUrls) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try { return await request(source, attempt, requestUrl); }
      catch (error) {
        lastError = error;
        if (attempt < 2) await delay(attempt * 1500);
      }
    }
  }
  return {
    ...source, retrievedAt: new Date().toISOString(), captureStatus: "blocked",
    blocker: lastError instanceof Error ? lastError.message : String(lastError),
    independentValidationRequired: true, complianceActivationAllowed: false,
  };
}

const sources = new Array(config.sources.length);
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= config.sources.length) return;
    const latest = await capture(config.sources[index]);
    sources[index] = latest;
    console.log(JSON.stringify({stateCode:latest.stateCode,sourceType:latest.sourceType,status:latest.captureStatus,blocker:latest.blocker}));
  }
}
await Promise.all(Array.from({ length: Math.min(8, config.sources.length) }, () => worker()));
const manifest = {
  schemaVersion: config.schemaVersion, capturedAt: new Date().toISOString(),
  sourceCount: sources.length,
  capturedCount: sources.filter((source) => source.captureStatus === "captured_unvalidated").length,
  controlledDocumentCount: sources.filter((source) => source.captureKind === "controlled_document").length,
  authorityPageSnapshotCount: sources.filter((source) => source.captureKind === "authority_page_snapshot").length,
  blockedCount: sources.filter((source) => source.captureStatus === "blocked").length,
  independentValidationRequired: true, complianceActivationAllowed: false, sources,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({outputPath,sourceCount:manifest.sourceCount,capturedCount:manifest.capturedCount,controlledDocumentCount:manifest.controlledDocumentCount,authorityPageSnapshotCount:manifest.authorityPageSnapshotCount,blockedCount:manifest.blockedCount}));
