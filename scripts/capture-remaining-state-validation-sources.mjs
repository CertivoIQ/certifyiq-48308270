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

async function request(source, attempt) {
  const response = await fetch(source.url, {
    redirect: "follow",
    headers: {
      "user-agent": "CertivoIQ-Controlled-Source-Capture/2.0 (+https://certivoiq.com)",
      accept: "application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(45_000),
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
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await request(source, attempt); }
    catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 1500);
    }
  }
  return {
    ...source, retrievedAt: new Date().toISOString(), captureStatus: "blocked",
    blocker: lastError instanceof Error ? lastError.message : String(lastError),
    independentValidationRequired: true, complianceActivationAllowed: false,
  };
}

const sources = [];
for (const source of config.sources) {
  sources.push(await capture(source));
  const latest = sources.at(-1);
  console.log(JSON.stringify({stateCode:latest.stateCode,sourceType:latest.sourceType,status:latest.captureStatus,blocker:latest.blocker}));
}
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
