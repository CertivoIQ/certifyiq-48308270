import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "artifacts/tn-tx-release-critical-documents.json");
const MAX_BYTES = 25 * 1024 * 1024;
const THDA_ATTACHMENT_HOST = "dogvxws799i6n.cloudfront.net";

const STATE_HOSTS = {
  TN: new Set(["thda.org", "www.thda.org", THDA_ATTACHMENT_HOST]),
  TX: new Set(["tdhca.texas.gov", "www.tdhca.texas.gov"]),
};

const DIRECT_DOCUMENTS = [
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "2026 Qualified Allocation Plan",
    source_url: "https://thda.org/wp-content/uploads/2026/01/2026-QAP-01.06.2026-003.pdf",
    source_type: "TN_2026_LIHTC_QAP",
    document_roles: ["LIHTC_QAP"],
    programs: ["LIHTC"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "2026 Qualified Allocation Plan",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/multifamily/docs/26-QAP.pdf",
    source_type: "TX_2026_LIHTC_QAP",
    document_roles: ["LIHTC_QAP"],
    programs: ["LIHTC"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Compliance Monitoring Rule – Subchapter F",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/CM-SubCh-F-Searchable.pdf",
    source_type: "TX_LIHTC_COMPLIANCE_RULE_SUBCHAPTER_F",
    document_roles: ["LIHTC_COMPLIANCE_RULE"],
    programs: ["LIHTC"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Income Certification",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCert_1.pdf",
    source_type: "TX_HOTMA_INCOME_CERTIFICATION_FORM",
    document_roles: ["INCOME_CERTIFICATION_FORM"],
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Income Certification Instructions",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCertInst_2.pdf",
    source_type: "TX_HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS",
    document_roles: ["HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS"],
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Asset Certification of Net Family Assets",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-AssetCert-NetFamily-en_0.pdf",
    source_type: "TX_ASSET_CERTIFICATION_FORM",
    document_roles: ["ASSET_CERTIFICATION_FORM"],
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Employment Verification",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-EmployVer.pdf",
    source_type: "TX_HOTMA_EMPLOYMENT_VERIFICATION_FORM",
    document_roles: ["EMPLOYMENT_VERIFICATION_FORM"],
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Income Verification for Households with Section 8 Certificates",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/Sec8Ver_0.pdf",
    source_type: "TX_SECTION8_INCOME_VERIFICATION_FORM",
    document_roles: ["SECTION8_INCOME_VERIFICATION_FORM"],
    programs: ["LIHTC", "SECTION_8", "HCV", "PBV"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Housing Choice Voucher Administrative Plan",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/section-8/docs/22-HCVP-AdminPlan.pdf",
    source_type: "TX_HCV_PBV_ADMIN_PLAN",
    document_roles: ["HCV_ADMIN_PLAN", "PBV_ADMIN_CHAPTER"],
    programs: ["SECTION_8", "HCV", "PBV"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "2026 HCV Utility Allowance Schedules",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/section-8/docs/26-UtilityAllowances.pdf",
    source_type: "TX_2026_HCV_UTILITY_ALLOWANCE",
    document_roles: ["HCV_UTILITY_ALLOWANCE_SCHEDULE"],
    programs: ["SECTION_8", "HCV", "PBV"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "2027 HCV PHA Plan",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/section-8/docs/27-S8-PHA-Plan.pdf",
    source_type: "TX_2027_HCV_PHA_PLAN",
    document_roles: ["PHA_PLAN_CURRENT"],
    programs: ["SECTION_8", "HCV", "PBV", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Assets and HOTMA Changes",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-Assets-HOTMA-Changes.pdf",
    source_type: "TX_HOTMA_ASSET_GUIDANCE",
    document_roles: ["HOTMA_GUIDANCE"],
    programs: ["LIHTC", "HOTMA"],
  },
];

const TN_DISCOVERY = [
  {
    url: "https://thda.org/rental-housing-partn/housing-credit-compliance/",
    targets: [
      { pattern: /HOTMA Compliance Training/i, source_type: "TN_HOTMA_COMPLIANCE_GUIDANCE", document_roles: ["HOTMA_GUIDANCE"], programs: ["LIHTC", "HOTMA"], required: true },
      { pattern: /HO-0423/i, source_type: "TN_SECTION8_INCOME_VERIFICATION_FORM", document_roles: ["SECTION8_INCOME_VERIFICATION_FORM"], programs: ["LIHTC", "SECTION_8", "HCV"], required: true },
      { pattern: /^Employment Verification$/i, source_type: "TN_EMPLOYMENT_VERIFICATION_FORM", document_roles: ["EMPLOYMENT_VERIFICATION_FORM"], programs: ["LIHTC", "HOTMA"], required: true },
      { pattern: /Asset Self-Certification Worksheet/i, source_type: "TN_ASSET_SELF_CERTIFICATION_FORM", document_roles: ["ASSET_CERTIFICATION_FORM"], programs: ["LIHTC", "HOTMA"], required: true },
    ],
  },
  {
    url: "https://thda.org/rental-housing-partn/thomas-documents/",
    targets: [
      { pattern: /^THOMAS Compliance Guide$/i, source_type: "TN_THOMAS_COMPLIANCE_GUIDE", document_roles: ["LIHTC_COMPLIANCE_GUIDE"], programs: ["LIHTC"], required: true },
      { pattern: /^Utility Allowance Guidance$/i, source_type: "TN_LIHTC_UTILITY_ALLOWANCE_GUIDANCE", document_roles: ["UTILITY_ALLOWANCE_GUIDANCE"], programs: ["LIHTC"], required: true },
      { pattern: /2026 LIHTC Eligibility Certification/i, source_type: "TN_2026_LIHTC_ELIGIBILITY_CERTIFICATION", document_roles: ["LIHTC_ELIGIBILITY_CERTIFICATION_FORM"], programs: ["LIHTC"], required: false },
      { pattern: /Utility Allowance Certification and Utility Worksheet/i, source_type: "TN_UTILITY_ALLOWANCE_CERTIFICATION_FORM", document_roles: ["UTILITY_ALLOWANCE_FORM"], programs: ["LIHTC"], required: true },
    ],
  },
  {
    url: "https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/",
    targets: [
      { pattern: /2026 Emergency Rule Changes HOTMA.*NSPIRE/i, source_type: "TN_HCV_2026_HOTMA_NSPIRE_RULE_UPDATE", document_roles: ["HCV_HOTMA_NSPIRE_RULE_UPDATE"], programs: ["SECTION_8", "HCV", "PBV", "HOTMA"], required: true },
      { pattern: /2025 PBV.*Single Chapter Amendment/i, source_type: "TN_PBV_2025_ADMIN_PLAN_AMENDMENT", document_roles: ["PBV_ADMIN_CHAPTER", "PBV_ADMIN_PLAN_AMENDMENT"], programs: ["SECTION_8", "HCV", "PBV", "HOTMA"], required: true },
      { pattern: /HCV 2025 5-Year PHA Plan/i, source_type: "TN_2025_HCV_PHA_PLAN", document_roles: ["PHA_PLAN_CURRENT"], programs: ["SECTION_8", "HCV", "PBV"], required: true },
      { pattern: /Administrative Plan Effective June 2024/i, source_type: "TN_HCV_ADMIN_PLAN", document_roles: ["HCV_ADMIN_PLAN"], programs: ["SECTION_8", "HCV", "PBV"], required: true },
    ],
  },
  {
    url: "https://thda.org/rental-housing-partn/utility-allowances/",
    targets: [
      { pattern: /2026 Utility Allowance Methodology/i, source_type: "TN_2026_HCV_UTILITY_ALLOWANCE_METHODOLOGY", document_roles: ["HCV_UTILITY_ALLOWANCE_METHODOLOGY"], programs: ["SECTION_8", "HCV", "PBV"], required: true },
      { pattern: /Instructions for 2026 Utility Allowances/i, source_type: "TN_2026_HCV_UTILITY_ALLOWANCE_INSTRUCTIONS", document_roles: ["HCV_UTILITY_ALLOWANCE_INSTRUCTIONS"], programs: ["SECTION_8", "HCV", "PBV"], required: true },
    ],
  },
];

const REQUIREMENTS = {
  TN: {
    LIHTC: ["LIHTC_QAP", "LIHTC_COMPLIANCE_GUIDE", "EMPLOYMENT_VERIFICATION_FORM", "ASSET_CERTIFICATION_FORM", "UTILITY_ALLOWANCE_GUIDANCE", "UTILITY_ALLOWANCE_FORM"],
    HOTMA: ["HOTMA_GUIDANCE", "ASSET_CERTIFICATION_FORM", "HCV_HOTMA_NSPIRE_RULE_UPDATE"],
    SECTION_8: ["HCV_ADMIN_PLAN", "HCV_HOTMA_NSPIRE_RULE_UPDATE", "HCV_UTILITY_ALLOWANCE_METHODOLOGY"],
    HCV: ["HCV_ADMIN_PLAN", "HCV_HOTMA_NSPIRE_RULE_UPDATE", "HCV_UTILITY_ALLOWANCE_INSTRUCTIONS"],
    PBV: ["PBV_ADMIN_CHAPTER", "PBV_ADMIN_PLAN_AMENDMENT", "HCV_HOTMA_NSPIRE_RULE_UPDATE"],
  },
  TX: {
    LIHTC: ["LIHTC_QAP", "LIHTC_COMPLIANCE_RULE", "INCOME_CERTIFICATION_FORM", "ASSET_CERTIFICATION_FORM"],
    HOTMA: ["HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS", "INCOME_CERTIFICATION_FORM", "EMPLOYMENT_VERIFICATION_FORM"],
    SECTION_8: ["HCV_ADMIN_PLAN", "SECTION8_INCOME_VERIFICATION_FORM", "HCV_UTILITY_ALLOWANCE_SCHEDULE"],
    HCV: ["HCV_ADMIN_PLAN", "HCV_UTILITY_ALLOWANCE_SCHEDULE"],
    PBV: ["PBV_ADMIN_CHAPTER", "PHA_PLAN_CURRENT"],
  },
};

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(?:8211|x2013);|&ndash;/gi, "–")
    .replace(/&#(?:8212|x2014);|&mdash;/gi, "—")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function allowed(stateCode, url) {
  const parsed = new URL(url);
  return parsed.protocol === "https:" && STATE_HOSTS[stateCode].has(parsed.hostname.toLowerCase());
}

function linksFromHtml(html, baseUrl, stateCode) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const label = cleanLabel(match[4]);
    const raw = String(match[1] ?? match[2] ?? match[3] ?? "").replace(/&amp;/gi, "&").trim();
    try {
      const url = new URL(raw, baseUrl).toString();
      if (!allowed(stateCode, url) || seen.has(url)) continue;
      seen.add(url);
      links.push({ label, url });
    } catch {}
  }
  return links;
}

function magic(bytes) {
  const head = Buffer.from(bytes.subarray(0, 8));
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (head.subarray(0, 2).toString("ascii") === "PK") return "zip_ooxml";
  if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "ole_compound";
  return null;
}

async function fetchBytes(stateCode, url, accept = "application/pdf,application/octet-stream,*/*;q=0.8") {
  if (!allowed(stateCode, url)) throw new Error(`unapproved_source_host:${new URL(url).hostname}`);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
        headers: {
          "user-agent": "Mozilla/5.0 CertivoIQ-TN-TX-Document-Evidence/3.0",
          accept,
          "cache-control": "no-cache",
        },
      });
      if (!response.ok) throw new Error(`http_status:${response.status}`);
      if (!allowed(stateCode, response.url)) throw new Error(`redirected_to_unapproved_host:${new URL(response.url).hostname}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_document_size");
      return {
        bytes,
        final_url: response.url,
        content_type: String(response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase(),
        etag: response.headers.get("etag"),
        last_modified: response.headers.get("last-modified"),
        capture_transport: `fetch_attempt_${attempt}`,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function documentRecord(spec, response, discoveryUrl = null) {
  const documentMagic = magic(response.bytes);
  if (!documentMagic) throw new Error("response_is_not_a_supported_document");
  return {
    state_code: spec.state_code,
    agency: spec.agency,
    document_title: spec.title,
    source_type: spec.source_type,
    document_roles: spec.document_roles,
    programs: spec.programs,
    source_url: spec.source_url,
    final_url: response.final_url,
    discovery_url: discoveryUrl,
    content_type: response.content_type || null,
    byte_size: response.bytes.byteLength,
    source_sha256: createHash("sha256").update(response.bytes).digest("hex"),
    document_magic: documentMagic,
    retrieved_at: new Date().toISOString(),
    etag: response.etag,
    last_modified: response.last_modified,
    capture_transport: response.capture_transport,
    capture_status: "captured_unvalidated",
    evidence_kind: "exact_document_bytes",
    validation_evidence_eligible: true,
    exact_bytes_captured: true,
    independent_validation_required: true,
    compliance_activation_allowed: false,
  };
}

const documents = [];
const discoveryPages = [];
const failures = [];

for (const spec of DIRECT_DOCUMENTS) {
  try {
    documents.push(documentRecord(spec, await fetchBytes(spec.state_code, spec.source_url)));
  } catch (error) {
    failures.push({ state_code: spec.state_code, source_type: spec.source_type, source_url: spec.source_url, error: error instanceof Error ? error.message : String(error) });
  }
}

for (const source of TN_DISCOVERY) {
  let response;
  try {
    response = await fetchBytes("TN", source.url, "text/html,application/xhtml+xml,*/*;q=0.8");
  } catch (error) {
    failures.push({ state_code: "TN", source_url: source.url, error: error instanceof Error ? error.message : String(error) });
    continue;
  }
  const html = Buffer.from(response.bytes).toString("utf8");
  discoveryPages.push({
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    discovery_url: source.url,
    final_url: response.final_url,
    byte_size: response.bytes.byteLength,
    source_sha256: createHash("sha256").update(response.bytes).digest("hex"),
    retrieved_at: new Date().toISOString(),
    evidence_kind: "discovery_page_only",
    validation_evidence_eligible: false,
    compliance_activation_allowed: false,
  });
  const links = linksFromHtml(html, response.final_url, "TN");
  for (const target of source.targets) {
    const link = links.find((candidate) => target.pattern.test(candidate.label));
    if (!link) {
      if (target.required) failures.push({ state_code: "TN", source_type: target.source_type, source_url: source.url, error: "required_document_link_not_found" });
      continue;
    }
    try {
      const spec = {
        state_code: "TN",
        agency: "Tennessee Housing Development Agency",
        title: link.label,
        source_url: link.url,
        source_type: target.source_type,
        document_roles: target.document_roles,
        programs: target.programs,
      };
      documents.push(documentRecord(spec, await fetchBytes("TN", link.url), source.url));
    } catch (error) {
      failures.push({ state_code: "TN", source_type: target.source_type, source_url: link.url, discovery_url: source.url, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

const unique = new Map();
for (const doc of documents) {
  const key = `${doc.state_code}|${doc.source_type}|${doc.source_sha256}`;
  if (!unique.has(key)) unique.set(key, doc);
}
const finalDocuments = [...unique.values()];

const coverage = [];
for (const [stateCode, programs] of Object.entries(REQUIREMENTS)) {
  for (const [program, requiredRoles] of Object.entries(programs)) {
    const relevant = finalDocuments.filter((doc) => doc.state_code === stateCode && doc.programs.includes(program));
    const roles = new Set(relevant.flatMap((doc) => doc.document_roles));
    const missing = requiredRoles.filter((role) => !roles.has(role));
    coverage.push({
      state_code: stateCode,
      program,
      documents: relevant.length,
      document_roles: [...roles].sort(),
      gaps: missing,
      document_level_validation_ready: missing.length === 0,
      compliance_activation_allowed: false,
    });
  }
}

const requiredFailures = failures.filter((failure) =>
  failure.error === "required_document_link_not_found" ||
  String(failure.source_type ?? "").startsWith("TN_")
);
const coverageGaps = coverage.filter((item) => !item.document_level_validation_ready);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  evidence_policy: "Only exact downloadable document bytes satisfy TN/TX state validation. THDA CloudFront attachments are accepted only from the exact distribution host currently linked by official THDA pages. HTML pages remain discovery-only.",
  thda_attachment_host: THDA_ATTACHMENT_HOST,
  documents: finalDocuments,
  discovery_pages: discoveryPages,
  failures,
  coverage,
}, null, 2));

console.log(JSON.stringify({
  outputPath,
  documents: finalDocuments.length,
  failures: failures.length,
  coverage_gaps: coverageGaps.map((item) => `${item.state_code}:${item.program}`),
  required_failures: requiredFailures.length,
}, null, 2));

if (coverageGaps.length || requiredFailures.length) process.exitCode = 2;
