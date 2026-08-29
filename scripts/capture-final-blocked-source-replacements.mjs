import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const config = JSON.parse(await readFile(resolve(root, "config/final-blocked-source-replacements.json"), "utf8"));
const outputPath = resolve(root, process.argv[2] ?? "artifacts/final-blocked-source-replacements.json");

const allowedHost = (source, hostname) => source.allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));

function pinnedHttpsGet(source, inputUrl, redirects = 0) {
  return new Promise((resolveRequest, rejectRequest) => {
    if (redirects > 5) return rejectRequest(new Error("too_many_redirects"));
    const url = new URL(inputUrl);
    if (url.protocol !== "https:" || !allowedHost(source, url.hostname.toLowerCase())) return rejectRequest(new Error("unapproved_url"));
    const request = httpsRequest(url, {
      method: "GET",
      rejectUnauthorized: source.tlsCertificateException !== true,
      timeout: 30_000,
      headers: {
        "user-agent": "Mozilla/5.0 CertivoIQ-Controlled-Capture/3.0",
        accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.5"
      }
    }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        const redirected = new URL(response.headers.location, url);
        if (!allowedHost(source, redirected.hostname.toLowerCase())) return rejectRequest(new Error(`redirected_to_unapproved_host:${redirected.hostname}`));
        return pinnedHttpsGet(source, redirected.toString(), redirects + 1).then(resolveRequest, rejectRequest);
      }
      if (status < 200 || status >= 300) {
        response.resume();
        return rejectRequest(new Error(`http_status:${status}`));
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const bytes = Buffer.concat(chunks);
        if (!bytes.length) return rejectRequest(new Error("empty_response"));
        resolveRequest({
          finalUrl: url.toString(),
          httpStatus: status,
          contentType: response.headers["content-type"] ?? null,
          etag: response.headers.etag ?? null,
          lastModified: response.headers["last-modified"] ?? null,
          bytes
        });
      });
    });
    request.on("timeout", () => request.destroy(new Error("request_timeout")));
    request.on("error", rejectRequest);
    request.end();
  });
}

async function capture(source) {
  const errors = [];
  for (const url of source.urls) {
    try {
      const response = await pinnedHttpsGet(source, url);
      const pdfHeader = response.bytes.subarray(0, 5).toString("ascii") === "%PDF-";
      if (!pdfHeader) throw new Error(`unexpected_content:${response.contentType ?? "unknown"}`);
      return {
        ...source,
        sourceUrl: response.finalUrl,
        retrievedAt: new Date().toISOString(),
        httpStatus: response.httpStatus,
        contentType: response.contentType,
        etag: response.etag,
        lastModified: response.lastModified,
        byteSize: response.bytes.length,
        sha256: createHash("sha256").update(response.bytes).digest("hex"),
        tlsPeerVerification: source.tlsCertificateException !== true,
        captureKind: "controlled_document",
        captureStatus: "captured_unvalidated",
        independentValidationRequired: true,
        complianceActivationAllowed: false
      };
    } catch (error) {
      errors.push(`${url} => ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    ...source,
    captureStatus: "blocked",
    blocker: errors.join(" | "),
    independentValidationRequired: true,
    complianceActivationAllowed: false
  };
}

const sources = await Promise.all(config.sources.map(capture));
const manifest = {
  schemaVersion: config.schemaVersion,
  capturedAt: new Date().toISOString(),
  sourceCount: sources.length,
  capturedCount: sources.filter((source) => source.captureStatus === "captured_unvalidated").length,
  blockedCount: sources.filter((source) => source.captureStatus === "blocked").length,
  independentValidationRequired: true,
  complianceActivationAllowed: false,
  sources
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ outputPath, sourceCount: manifest.sourceCount, capturedCount: manifest.capturedCount, blockedCount: manifest.blockedCount }));
if (manifest.blockedCount) process.exitCode = 1;
