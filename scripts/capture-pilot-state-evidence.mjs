import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const configPath = resolve(root, "config/pilot-state-sources.json");
const outputPath = resolve(
  root,
  process.argv[2] ?? "artifacts/pilot-state-source-evidence.json",
);

const config = JSON.parse(await readFile(configPath, "utf8"));
const capturedAt = new Date().toISOString();

async function capture(source) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, {
      redirect: "follow",
      headers: {
        "user-agent": "CertivoIQ-Controlled-Source-Capture/1.0",
        accept: "text/html,application/pdf,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30_000),
    });
    const finalUrl = new URL(response.url);
    if (!source.allowedHosts.includes(finalUrl.hostname)) {
      throw new Error(`redirected_to_unapproved_host:${finalUrl.hostname}`);
    }
    if (!response.ok) throw new Error(`http_status:${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("empty_response");
    return {
      ...source,
      startedAt,
      retrievedAt: new Date().toISOString(),
      finalUrl: finalUrl.toString(),
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      byteSize: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      captureStatus: "captured_unvalidated",
      complianceActivationAllowed: false,
    };
  } catch (error) {
    return {
      ...source,
      startedAt,
      retrievedAt: new Date().toISOString(),
      captureStatus: "blocked",
      blocker: error instanceof Error ? error.message : String(error),
      complianceActivationAllowed: false,
    };
  }
}

const sources = [];
for (const source of config.sources) sources.push(await capture(source));
const manifest = {
  schemaVersion: config.schemaVersion,
  capturedAt,
  states: config.states,
  sourceCount: sources.length,
  capturedCount: sources.filter((source) => source.captureStatus === "captured_unvalidated").length,
  blockedCount: sources.filter((source) => source.captureStatus === "blocked").length,
  independentValidationRequired: true,
  complianceActivationAllowed: false,
  sources,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({
  outputPath,
  sourceCount: manifest.sourceCount,
  capturedCount: manifest.capturedCount,
  blockedCount: manifest.blockedCount,
}));

if (manifest.blockedCount > 0) process.exitCode = 2;
