import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "artifacts/found-state-compliance-manuals.json");
const MAX_BYTES = 25 * 1024 * 1024;
const DOCUMENTS = [
  {
    state_code: "LA",
    agency: "Louisiana Housing Corporation",
    title: "2026 LIHTC Manual",
    source_url: "https://www.lhc.la.gov/hubfs/Document%20Libraries/Housing%20Development/Funding%20Opportunities/LIHTC/LIHTC_Manual_2026.pdf",
    allowed_hosts: ["www.lhc.la.gov", "lhc.la.gov"],
  },
  {
    state_code: "NC",
    agency: "North Carolina Housing Finance Agency",
    title: "2026 Rental Investment Compliance Manual",
    source_url: "https://www.nchfa.com/sites/default/files/2026-06/ComplianceManual-RentalAssetManagement.pdf",
    allowed_hosts: ["www.nchfa.com", "nchfa.com", "new.nchfa.com"],
  },
  {
    state_code: "SC",
    agency: "South Carolina State Housing Finance and Development Authority",
    title: "LIHTC Compliance Manual revised February 12, 2026",
    source_url: "https://schousing.sc.gov/sites/schousing/files/Documents/Development/Manuals%20and%20Forms/LIHTC%20Compliance%20Manual%20-%20Revised%202.12.2026.pdf",
    allowed_hosts: ["schousing.sc.gov"],
  },
  {
    state_code: "OK",
    agency: "Oklahoma Housing Finance Agency",
    title: "Compliance Manual revised September 2024",
    source_url: "https://www.ohfa.org/wp-content/uploads/2024/09/2024-Compliance-Manual-revised-Sept-2024.pdf",
    allowed_hosts: ["www.ohfa.org", "ohfa.org"],
  },
];

function allowed(spec, url) {
  const parsed = new URL(url);
  return parsed.protocol === "https:" &&
    spec.allowed_hosts.includes(parsed.hostname.toLowerCase());
}

function assertPdf(bytes) {
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new Error("response_is_not_pdf");
  }
}

async function capture(spec) {
  if (!allowed(spec, spec.source_url)) throw new Error("unapproved_source_host");
  const response = await fetch(spec.source_url, {
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "user-agent": "Mozilla/5.0 CertivoIQ-Official-Manual-Capture/1.0",
      accept: "application/pdf",
      "cache-control": "no-cache",
    },
  });
  if (!response.ok) throw new Error("http_status:" + response.status);
  if (!allowed(spec, response.url)) throw new Error("redirected_to_unapproved_host");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    throw new Error("invalid_document_size");
  }
  assertPdf(bytes);
  return {
    state_code: spec.state_code,
    agency: spec.agency,
    document_title: spec.title,
    program: "LIHTC",
    source_type: "LIHTC_COMPLIANCE_MANUAL",
    document_families: ["LIHTC_CONTROLLING_AUTHORITY", "COMPLIANCE_GUIDEBOOK"],
    source_url: spec.source_url,
    final_url: response.url,
    content_type: String(response.headers.get("content-type") ?? "").split(";", 1)[0],
    byte_size: bytes.byteLength,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    retrieved_at: new Date().toISOString(),
    etag: response.headers.get("etag"),
    last_modified: response.headers.get("last-modified"),
    capture_status: "captured_unvalidated",
    exact_bytes_captured: true,
    independent_validation_required: true,
    compliance_activation_allowed: false,
  };
}

const documents = [];
const failures = [];
for (const spec of DOCUMENTS) {
  try {
    documents.push(await capture(spec));
  } catch (error) {
    failures.push({
      state_code: spec.state_code,
      source_url: spec.source_url,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  evidence_policy: "Only exact PDF bytes from the allowlisted official publisher host are admitted. Every capture remains pending independent validation and cannot activate a state pack.",
  documents,
  failures,
}, null, 2) + "\n");

console.log(JSON.stringify({ outputPath, documents: documents.length, failures }, null, 2));
if (failures.length) process.exitCode = 2;
