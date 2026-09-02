import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const outputPath = resolve(process.argv[2] ?? "artifacts/tn-tx-release-critical-documents.json");
const MAX_BYTES = 25 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const authorities = {
  TN: {
    agency: "Tennessee Housing Development Agency",
    allowedHosts: ["thda.org", "www.thda.org", "huduser.gov", "www.huduser.gov"],
    pages: [
      {
        url: "https://thda.org/rental-housing-partn/thomas-documents/",
        families: ["COMPLIANCE_GUIDEBOOK", "UTILITY_ALLOWANCE"],
        follow: [/THOMAS Compliance Guide/i, /Utility Allowance Guidance/i, /Utility Allowance Instructions/i],
      },
      {
        url: "https://thda.org/rental-housing-partn/housing-credit-compliance/",
        families: ["COMPLIANCE_FORMS", "INCOME_LIMITS", "UTILITY_ALLOWANCE"],
        follow: [/HUD Income Limits/i, /Utility Allowances? by County/i, /Employment Verification/i, /Asset Self-Certification/i],
      },
      {
        url: "https://thda.org/rental-housing-partn/lihtc-program/",
        families: ["RENT_LIMITS"],
        follow: [],
      },
      {
        url: "https://thda.org/rental-housing-partn/utility-allowances/",
        families: ["UTILITY_ALLOWANCE"],
        follow: [/2026 Utility Allowance Methodology/i, /Instructions for 2026 Utility Allowances/i],
      },
    ],
  },
  TX: {
    agency: "Texas Department of Housing and Community Affairs",
    allowedHosts: ["tdhca.texas.gov", "www.tdhca.texas.gov", "hrc-ic.tdhca.state.tx.us"],
    pages: [
      {
        url: "https://www.tdhca.texas.gov/compliance-manuals-and-rules",
        families: ["COMPLIANCE_GUIDEBOOK"],
        follow: [/Subchapter F \(Searchable PDF\)/i, /LIHTC Newsletter # 45/i],
      },
      {
        url: "https://www.tdhca.texas.gov/income-and-rent-limits",
        families: ["INCOME_LIMITS", "RENT_LIMITS"],
        follow: [/Instructions on How To Use the Department Income and Rent Tool/i, /2026 811 PRA Income Limits/i],
      },
      {
        url: "https://www.tdhca.texas.gov/compliance-utility-allowance-information",
        families: ["UTILITY_ALLOWANCE"],
        follow: [/Utility Allowance Questionnaire$/i, /Frequently Asked Questions/i, /Actual Use Technical Guide/i],
      },
      {
        url: "https://www.tdhca.texas.gov/compliance-forms",
        families: ["COMPLIANCE_FORMS"],
        follow: [],
      },
    ],
  },
};

function allowed(host, allowedHosts) {
  const value = host.toLowerCase();
  return allowedHosts.some((item) => value === item || value.endsWith("." + item));
}

function validateFinalUrl(url, allowedHosts) {
  const final = new URL(url);
  if (final.protocol !== "https:" || !allowed(final.hostname, allowedHosts)) {
    throw new Error(`redirected_to_unapproved_host:${final.hostname}`);
  }
}

async function curlExact(url, allowedHosts) {
  const tempDirectory = await mkdtemp(join(tmpdir(), "certivoiq-tn-tx-"));
  const output = join(tempDirectory, "response.bin");
  try {
    const { stdout } = await execFileAsync("curl", [
      "--location",
      "--fail",
      "--silent",
      "--show-error",
      "--compressed",
      "--max-time", "30",
      "--proto", "=https",
      "--user-agent", "Mozilla/5.0 CertivoIQ-TN-TX-Controlled-Capture/1.0",
      "--header", "Accept: application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.5",
      "--header", "Accept-Language: en-US,en;q=0.9",
      "--output", output,
      "--write-out", "%{url_effective}\n%{http_code}\n%{content_type}",
      url,
    ], { maxBuffer: 1024 * 1024 });
    const [finalUrl, statusText, contentType = ""] = stdout.trim().split("\n");
    validateFinalUrl(finalUrl, allowedHosts);
    const status = Number(statusText);
    if (!Number.isInteger(status) || status < 200 || status > 299) throw new Error(`http_status:${statusText}`);
    const file = await readFile(output);
    const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_document_size");
    return {
      bytes,
      finalUrl,
      contentType: contentType.split(";", 1)[0].toLowerCase(),
      etag: null,
      lastModified: null,
      transport: "curl_fallback",
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function fetchExact(url, allowedHosts) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 CertivoIQ-TN-TX-Controlled-Capture/1.0",
          accept: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`http_status:${response.status}`);
      validateFinalUrl(response.url, allowedHosts);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_document_size");
      return {
        bytes,
        finalUrl: response.url,
        contentType: String(response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        transport: `fetch_attempt_${attempt}`,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(900 * attempt);
    }
  }
  try {
    return await curlExact(url, allowedHosts);
  } catch (curlError) {
    throw new Error(`${lastError instanceof Error ? lastError.message : String(lastError)}; curl:${curlError instanceof Error ? curlError.message : String(curlError)}`);
  }
}

function linksFromHtml(html, baseUrl, allowedHosts, patterns) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const label = String(match[4] ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    if (!patterns.some((pattern) => pattern.test(label))) continue;
    const raw = String(match[1] ?? match[2] ?? match[3] ?? "").replace(/&amp;/gi, "&").trim();
    try {
      const target = new URL(raw, baseUrl);
      target.hash = "";
      if (target.protocol !== "https:" || !allowed(target.hostname, allowedHosts) || seen.has(target.href)) continue;
      seen.add(target.href);
      out.push({ label, url: target.href });
    } catch {}
  }
  return out;
}

function record(stateCode, agency, title, families, sourceUrl, parentUrl, response) {
  return {
    state_code: stateCode,
    agency,
    document_title: title,
    document_families: families,
    source_url: sourceUrl,
    final_url: response.finalUrl,
    discovery_url: parentUrl ?? sourceUrl,
    content_type: response.contentType || null,
    byte_size: response.bytes.byteLength,
    source_sha256: createHash("sha256").update(response.bytes).digest("hex"),
    retrieved_at: new Date().toISOString(),
    etag: response.etag,
    last_modified: response.lastModified,
    capture_transport: response.transport,
    capture_status: "captured_unvalidated",
    exact_bytes_captured: true,
    independent_validation_required: true,
    compliance_activation_allowed: false,
  };
}

const documents = [];
const failures = [];
for (const [stateCode, authority] of Object.entries(authorities)) {
  for (const page of authority.pages) {
    try {
      const pageResponse = await fetchExact(page.url, authority.allowedHosts);
      documents.push(record(stateCode, authority.agency, new URL(page.url).pathname, page.families, page.url, null, pageResponse));
      if (!page.follow.length || !/text\/html|application\/xhtml\+xml/.test(pageResponse.contentType)) continue;
      const html = Buffer.from(pageResponse.bytes).toString("utf8");
      const links = linksFromHtml(html, pageResponse.finalUrl, authority.allowedHosts, page.follow);
      for (const link of links) {
        try {
          const linked = await fetchExact(link.url, authority.allowedHosts);
          documents.push(record(stateCode, authority.agency, link.label, page.families, link.url, page.url, linked));
        } catch (error) {
          failures.push({ state_code: stateCode, source_url: link.url, discovery_url: page.url, error: error instanceof Error ? error.message : String(error) });
        }
      }
    } catch (error) {
      failures.push({ state_code: stateCode, source_url: page.url, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

const required = ["COMPLIANCE_GUIDEBOOK", "INCOME_LIMITS", "RENT_LIMITS", "UTILITY_ALLOWANCE", "COMPLIANCE_FORMS"];
const coverage = Object.keys(authorities).map((stateCode) => {
  const found = new Set(documents.filter((doc) => doc.state_code === stateCode).flatMap((doc) => doc.document_families));
  return { state_code: stateCode, found: required.filter((family) => found.has(family)), gaps: required.filter((family) => !found.has(family)) };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ generated_at: new Date().toISOString(), documents, failures, coverage }, null, 2));
console.log(JSON.stringify({ outputPath, documents: documents.length, failures: failures.length, coverage }));
if (coverage.some((item) => item.gaps.length)) process.exitCode = 2;
