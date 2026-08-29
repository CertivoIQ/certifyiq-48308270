import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { extractDeclaredEffectiveDate } from "../src/lib/nationwide-state-source-evidence-pipeline.mjs";
import {
  classifyDocument,
  coverageGaps,
  extractOfficialLinks,
  selectCurrentDocuments,
} from "../src/lib/state-validation-document-families.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const inventoryPath = resolve(root, "src/lib/nationwide-state-source-discovery.json");
const outputPath = resolve(root, process.argv[2] ?? "artifacts/state-validation-document-families.json");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const execFileAsync = promisify(execFile);
const STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]);

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const domainsFor = (jurisdiction) =>
  (Array.isArray(jurisdiction.official_domain) ? jurisdiction.official_domain : [jurisdiction.official_domain])
    .map((domain) => String(domain ?? "").toLowerCase())
    .filter(Boolean);

function isAllowed(jurisdiction, url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && domainsFor(jurisdiction)
      .some((domain) => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

async function fetchFloridaWithPinnedTlsException(jurisdiction, url, timeoutMs) {
  const requested = new URL(url);
  if (
    jurisdiction.state_code !== "FL" ||
    requested.protocol !== "https:" ||
    !requested.hostname.toLowerCase().endsWith("floridahousing.org")
  ) {
    throw new Error("tls_exception_not_authorized");
  }

  const tempDirectory = await mkdtemp(join(tmpdir(), "certivoiq-florida-"));
  const output = join(tempDirectory, "response.bin");
  try {
    const { stdout } = await execFileAsync("curl", [
      "--insecure",
      "--location",
      "--fail",
      "--silent",
      "--show-error",
      "--max-time", String(Math.max(10, Math.ceil(timeoutMs / 1000))),
      "--proto", "=https",
      "--output", output,
      "--write-out", "%{url_effective}\\n%{http_code}\\n%{content_type}",
      url,
    ], { maxBuffer: 1024 * 1024 });
    const [finalUrl, statusText, contentType = ""] = stdout.trim().split("\n");
    if (!isAllowed(jurisdiction, finalUrl)) {
      throw new Error("tls_exception_redirected_to_unapproved_host");
    }
    const httpStatus = Number(statusText);
    if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus > 299) {
      throw new Error("http_status:" + statusText);
    }
    const file = await readFile(output);
    const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
    if (!bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error("document_size_invalid");
    }
    return {
      bytes,
      finalUrl,
      contentType: contentType.split(";", 1)[0].toLowerCase(),
      etag: null,
      lastModified: null,
      attempt: 1,
      tlsPeerVerification: false,
      tlsExceptionScope: "Pinned Florida Housing hosts only; final redirect host revalidated before hashing.",
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function fetchOfficial(jurisdiction, url, { attempts = 2, timeoutMs = 25_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 CertivoIQ-Controlled-Document-Family-Capture/1.0",
          accept: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error("http_status:" + response.status);
      if (!isAllowed(jurisdiction, response.url)) {
        throw new Error("redirected_to_unapproved_host:" + new URL(response.url).hostname);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength) throw new Error("empty_response");
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error("document_too_large");
      return {
        bytes,
        finalUrl: response.url,
        contentType: String(response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 1250);
    }
  }
  if (jurisdiction.state_code === "FL") {
    return fetchFloridaWithPinnedTlsException(jurisdiction, url, timeoutMs);
  }
  throw lastError;
}

function sitemapLocations(xml) {
  return [...String(xml ?? "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/gi, "&").trim())
    .filter(Boolean);
}

async function discoverSitemapSources(jurisdiction) {
  const pages = new Set();
  const sitemapQueue = domainsFor(jurisdiction)
    .map((domain) => "https://" + domain + "/sitemap.xml");
  const visitedSitemaps = new Set();

  while (sitemapQueue.length && visitedSitemaps.size < 4) {
    const sitemapUrl = sitemapQueue.shift();
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl) || !isAllowed(jurisdiction, sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);
    try {
      const response = await fetchOfficial(jurisdiction, sitemapUrl, { attempts: 1, timeoutMs: 8_000 });
      const xml = Buffer.from(response.bytes).toString("utf8");
      for (const location of sitemapLocations(xml)) {
        if (!isAllowed(jurisdiction, location)) continue;
        if (/\.xml(?:\?|$)/i.test(location) && sitemapQueue.length < 12) {
          sitemapQueue.push(location);
          continue;
        }
        if (/compliance|asset.management|property.manag|lihtc|tax.credit|income.{0,8}limit|rent.{0,8}limit|utility.{0,8}allow|training|forms?/i.test(location)) {
          pages.add(location);
        }
      }
    } catch {
      // Sitemap coverage is supplemental; configured authority pages remain primary.
    }
  }

  return [...pages]
    .sort((left, right) => {
      const leftYear = Number(left.match(/\b(20\d{2})\b/)?.[1] ?? 0);
      const rightYear = Number(right.match(/\b(20\d{2})\b/)?.[1] ?? 0);
      return rightYear - leftYear || left.localeCompare(right);
    })
    .slice(0, 15)
    .map((url) => ({
      type: "SITEMAP_VALIDATION_DOCUMENT_DISCOVERY",
      url,
      status: "PENDING_EXACT_BYTES_AND_HASHES",
    }));
}

async function extractPdfText(bytes) {
  try {
    const pdfjs = await import(process.env.PDFJS_DIST_PATH ?? "pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 12); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return pages.join(" ").slice(0, 200_000);
  } catch {
    return "";
  }
}

async function discoverJurisdiction(jurisdiction) {
  const candidates = [];
  const discoveryFailures = [];
  const configuredSources = jurisdiction.sources ?? [];
  const sitemapSources = await discoverSitemapSources(jurisdiction);
  const discoverySources = [...new Map(
    [...configuredSources, ...sitemapSources].map((source) => [source.url, source]),
  ).values()];
  for (const source of discoverySources) {
    try {
      const response = await fetchOfficial(
        jurisdiction,
        source.url,
        source.type === "SITEMAP_VALIDATION_DOCUMENT_DISCOVERY"
          ? { attempts: 1, timeoutMs: 10_000 }
          : undefined,
      );
      const isHtml = /text\/html|application\/xhtml\+xml/.test(response.contentType);
      if (isHtml) {
        const html = Buffer.from(response.bytes).toString("utf8");
        for (const link of extractOfficialLinks(html, response.finalUrl, jurisdiction.official_domain)) {
          const classification = classifyDocument({
            label: link.label,
            url: link.url,
            sourceType: source.type,
          });
          if (!classification.families.length) continue;
          candidates.push({
            ...link,
            discovery_url: source.url,
            source_type_hint: source.type,
            ...classification,
          });
        }
      } else {
        const classification = classifyDocument({
          label: source.type,
          url: response.finalUrl,
          sourceType: source.type,
        });
        if (classification.families.length) {
          candidates.push({
            url: response.finalUrl,
            label: source.type.replaceAll("_", " "),
            discovery_url: source.url,
            source_type_hint: source.type,
            ...classification,
          });
        }
      }
    } catch (error) {
      discoveryFailures.push({
        state_code: jurisdiction.state_code,
        discovery_url: source.url,
        source_type_hint: source.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { candidates: selectCurrentDocuments(candidates), discoveryFailures };
}

async function captureDocument(jurisdiction, candidate) {
  try {
    const response = await fetchOfficial(jurisdiction, candidate.url);
    if (/text\/html|application\/xhtml\+xml/.test(response.contentType)) {
      throw new Error("candidate_resolved_to_html_not_document");
    }
    if (!response.bytes.byteLength) throw new Error("empty_response");
    const byteSize = response.bytes.byteLength;
    const sourceSha256 = createHash("sha256").update(response.bytes).digest("hex");
    if (sourceSha256 === EMPTY_SHA256) throw new Error("empty_document_hash");

    // PDF.js may transfer and detach the supplied ArrayBuffer. Parse an isolated copy
    // after preserving the exact source byte count and digest.
    const extractedText = response.contentType === "application/pdf"
      ? await extractPdfText(Uint8Array.from(response.bytes))
      : Buffer.from(response.bytes).toString("utf8", 0, Math.min(byteSize, 200_000));
    const effective = extractDeclaredEffectiveDate(
      candidate.label + " " + candidate.url + " " + extractedText,
    );
    return {
      document_id: createHash("sha256")
        .update(jurisdiction.state_code + "|" + response.finalUrl)
        .digest("hex"),
      state_code: jurisdiction.state_code,
      scope: jurisdiction.scope,
      agency: jurisdiction.agency,
      document_title: candidate.label || candidate.source_type_hint,
      document_families: candidate.families,
      source_type: candidate.families.join("_AND_"),
      source_url: candidate.url,
      final_url: response.finalUrl,
      discovery_url: candidate.discovery_url,
      official_domains: domainsFor(jurisdiction),
      content_type: response.contentType || null,
      byte_size: byteSize,
      source_sha256: sourceSha256,
      retrieved_at: new Date().toISOString(),
      etag: response.etag,
      last_modified: response.lastModified,
      declared_year: candidate.declared_year,
      ...effective,
      tls_peer_verification: response.tlsPeerVerification ?? true,
      tls_exception_scope: response.tlsExceptionScope ?? null,
      capture_status: "captured_unvalidated",
      independent_validation_required: true,
      compliance_activation_allowed: false,
    };
  } catch (error) {
    return {
      state_code: jurisdiction.state_code,
      document_title: candidate.label || candidate.source_type_hint,
      document_families: candidate.families,
      source_url: candidate.url,
      discovery_url: candidate.discovery_url,
      capture_status: "blocked",
      blocker: error instanceof Error ? error.message : String(error),
      independent_validation_required: true,
      compliance_activation_allowed: false,
    };
  }
}

const jurisdictions = inventory.jurisdictions.filter((item) => STATES.has(item.state_code));
const results = new Array(jurisdictions.length);
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= jurisdictions.length) return;
    const jurisdiction = jurisdictions[index];
    const discovery = await discoverJurisdiction(jurisdiction);
    const documents = [];
    for (const candidate of discovery.candidates) {
      documents.push(await captureDocument(jurisdiction, candidate));
    }
    const captured = documents.filter((item) => item.capture_status === "captured_unvalidated");
    results[index] = {
      state_code: jurisdiction.state_code,
      agency: jurisdiction.agency,
      candidate_count: discovery.candidates.length,
      captured_count: captured.length,
      blocked_count: documents.length - captured.length,
      discovery_failures: discovery.discoveryFailures,
      documents,
      coverage_gaps: coverageGaps(
        jurisdiction.state_code,
        captured.map((item) => ({ families: item.document_families })),
      ),
    };
    console.log(JSON.stringify({
      stateCode: jurisdiction.state_code,
      candidates: discovery.candidates.length,
      captured: captured.length,
      gaps: results[index].coverage_gaps.length,
    }));
  }
}

await Promise.all(Array.from({ length: 5 }, () => worker()));
const states = [...results.reduce((byState, item) => {
  const current = byState.get(item.state_code) ?? {
    state_code: item.state_code,
    agency: item.agency,
    candidate_count: 0,
    captured_count: 0,
    blocked_count: 0,
    discovery_failures: [],
    documents: [],
    coverage_gaps: [],
  };
  current.candidate_count += item.candidate_count;
  current.captured_count += item.captured_count;
  current.blocked_count += item.blocked_count;
  current.discovery_failures.push(...item.discovery_failures);
  current.documents.push(...item.documents);
  byState.set(item.state_code, current);
  return byState;
}, new Map()).values()].map((item) => {
  const captured = item.documents.filter((document) => document.capture_status === "captured_unvalidated");
  return {
    ...item,
    coverage_gaps: coverageGaps(
      item.state_code,
      captured.map((document) => ({ families: document.document_families })),
    ),
  };
}).sort((left, right) => left.state_code.localeCompare(right.state_code));

const documents = states.flatMap((item) => item.documents);
const manifest = {
  schema_version: "2026-08-29.2",
  captured_at: new Date().toISOString(),
  state_count: states.length,
  required_document_families: [
    "COMPLIANCE_RULE_CHANGES",
    "COMPLIANCE_GUIDEBOOK",
    "INCOME_LIMITS",
    "RENT_LIMITS",
    "UTILITY_ALLOWANCE",
    "COMPLIANCE_FORMS",
    "COMPLIANCE_TRAINING",
  ],
  document_count: documents.length,
  captured_count: documents.filter((item) => item.capture_status === "captured_unvalidated").length,
  blocked_count: documents.filter((item) => item.capture_status === "blocked").length,
  coverage_gap_count: states.reduce((sum, item) => sum + item.coverage_gaps.length, 0),
  independent_validation_required: true,
  compliance_activation_allowed: false,
  states,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({
  outputPath,
  stateCount: manifest.state_count,
  capturedCount: manifest.captured_count,
  blockedCount: manifest.blocked_count,
  coverageGapCount: manifest.coverage_gap_count,
}));
