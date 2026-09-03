import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const outputPath = resolve(process.argv[2] ?? "artifacts/tn-tx-release-critical-documents.json");
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_DISCOVERY_DEPTH = 1;
const execFileAsync = promisify(execFile);
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const DOCUMENT_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const DIRECT_DOCUMENTS = [
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "2026 Qualified Allocation Plan",
    source_url: "https://thda.org/wp-content/uploads/2026/01/2026-QAP-01.06.2026-003.pdf",
    source_type: "TN_2026_LIHTC_QAP",
    document_role: "LIHTC_QAP",
    programs: ["LIHTC"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "THOMAS Compliance Guide",
    source_url: "https://thda.org/pdf/THOMAS-Compliance-Guide_2021-10-27-140216_jeey.pdf",
    source_type: "TN_THOMAS_COMPLIANCE_GUIDE",
    document_role: "LIHTC_COMPLIANCE_GUIDE",
    programs: ["LIHTC"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "HOTMA Compliance Training",
    source_url: "https://thda.org/pdf/HOTMA-Training-2025.pdf",
    source_type: "TN_HOTMA_COMPLIANCE_GUIDANCE",
    document_role: "HOTMA_GUIDANCE",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "Employment Verification HO-0422",
    source_url: "https://thda.org/pdf/HO-0422-Employment-Verification_200626_154435.pdf",
    source_type: "TN_EMPLOYMENT_VERIFICATION_FORM",
    document_role: "EMPLOYMENT_VERIFICATION_FORM",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "Asset Self-Certification HO-0485",
    source_url: "https://thda.org/documents/TN-Asset-Self-Certification-2025.pdf",
    source_type: "TN_ASSET_SELF_CERTIFICATION_FORM",
    document_role: "ASSET_CERTIFICATION_FORM",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "Housing Choice Voucher Administrative Plan",
    source_url: "https://thda.org/pdf/2024-Administrative-Plan.pdf",
    source_type: "TN_HCV_ADMIN_PLAN",
    document_role: "HCV_ADMIN_PLAN",
    programs: ["SECTION_8", "HCV"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "THDA Administrative Plan – PBV Chapter",
    source_url: "https://thda.org/images/PBV-Chapter-Admin-Plan.pdf",
    source_type: "TN_PBV_ADMIN_PLAN_CHAPTER",
    document_role: "PBV_ADMIN_CHAPTER",
    programs: ["SECTION_8", "HCV", "PBV", "HOTMA"],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    title: "Utility Allowance Guidance",
    source_url: "https://thda.org/pdf/Utility-Allowance-Guidance.pdf",
    source_type: "TN_LIHTC_UTILITY_ALLOWANCE_GUIDANCE",
    document_role: "UTILITY_ALLOWANCE_GUIDANCE",
    programs: ["LIHTC"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "2026 Qualified Allocation Plan",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/multifamily/docs/26-QAP.pdf",
    source_type: "TX_2026_LIHTC_QAP",
    document_role: "LIHTC_QAP",
    programs: ["LIHTC"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Compliance Monitoring Rule – Subchapter F",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/CM-SubCh-F-Searchable.pdf",
    source_type: "TX_LIHTC_COMPLIANCE_RULE_SUBCHAPTER_F",
    document_role: "LIHTC_COMPLIANCE_RULE",
    programs: ["LIHTC"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Income Certification",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCert_1.pdf",
    source_type: "TX_HOTMA_INCOME_CERTIFICATION_FORM",
    document_role: "INCOME_CERTIFICATION_FORM",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Income Certification Instructions",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-IncomeCertInst_2.pdf",
    source_type: "TX_HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS",
    document_role: "HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Asset Certification of Net Family Assets",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-AssetCert-NetFamily-en_0.pdf",
    source_type: "TX_ASSET_CERTIFICATION_FORM",
    document_role: "ASSET_CERTIFICATION_FORM",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Employment Verification",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/HOTMA-EmployVer.pdf",
    source_type: "TX_HOTMA_EMPLOYMENT_VERIFICATION_FORM",
    document_role: "EMPLOYMENT_VERIFICATION_FORM",
    programs: ["LIHTC", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Income Verification for Households with Section 8 Certificates",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/Sec8Ver_0.pdf",
    source_type: "TX_SECTION8_INCOME_VERIFICATION_FORM",
    document_role: "SECTION8_INCOME_VERIFICATION_FORM",
    programs: ["LIHTC", "SECTION_8", "HCV", "PBV"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Housing Choice Voucher Administrative Plan",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/section-8/docs/22-HCVP-AdminPlan.pdf",
    source_type: "TX_HCV_PBV_ADMIN_PLAN",
    document_role: "HCV_PBV_ADMIN_PLAN",
    programs: ["SECTION_8", "HCV", "PBV"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "2026 HCV Utility Allowance Schedules",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/section-8/docs/26-UtilityAllowances.pdf",
    source_type: "TX_2026_HCV_UTILITY_ALLOWANCE",
    document_role: "HCV_UTILITY_ALLOWANCE_SCHEDULE",
    programs: ["SECTION_8", "HCV", "PBV"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "2027 HCV PHA Plan",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/section-8/docs/27-S8-PHA-Plan.pdf",
    source_type: "TX_2027_HCV_PHA_PLAN",
    document_role: "PHA_PLAN_CURRENT",
    programs: ["SECTION_8", "HCV", "PBV", "HOTMA"],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    title: "Assets and HOTMA Changes",
    source_url: "https://www.tdhca.texas.gov/sites/default/files/pmcdocs/24-Assets-HOTMA-Changes.pdf",
    source_type: "TX_HOTMA_ASSET_GUIDANCE",
    document_role: "HOTMA_GUIDANCE",
    programs: ["LIHTC", "HOTMA"],
  },
];

const DISCOVERY_SOURCES = [
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    allowed_hosts: ["thda.org", "www.thda.org"],
    url: "https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/",
    targets: [
      { pattern: /2026 Emergency Rule Changes HOTMA.*NSPIRE/i, source_type: "TN_HCV_2026_HOTMA_NSPIRE_RULE_UPDATE", document_role: "HCV_HOTMA_NSPIRE_RULE_UPDATE", programs: ["SECTION_8", "HCV", "PBV", "HOTMA"], required: true },
      { pattern: /2025 PBV.*Single Chapter Amendment/i, source_type: "TN_PBV_2025_ADMIN_PLAN_AMENDMENT", document_role: "PBV_ADMIN_PLAN_AMENDMENT", programs: ["SECTION_8", "HCV", "PBV", "HOTMA"], required: true },
      { pattern: /HCV 2025 5-Year PHA Plan/i, source_type: "TN_2025_HCV_PHA_PLAN", document_role: "PHA_PLAN_CURRENT", programs: ["SECTION_8", "HCV", "PBV"], required: false },
      { pattern: /Administrative Plan Effective June 2024/i, source_type: "TN_HCV_ADMIN_PLAN", document_role: "HCV_ADMIN_PLAN", programs: ["SECTION_8", "HCV"], required: false },
    ],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    allowed_hosts: ["thda.org", "www.thda.org"],
    url: "https://thda.org/rental-housing-partn/housing-credit-compliance/",
    targets: [
      { pattern: /HO-0423/i, source_type: "TN_SECTION8_INCOME_VERIFICATION_FORM", document_role: "SECTION8_INCOME_VERIFICATION_FORM", programs: ["LIHTC", "SECTION_8", "HCV"], required: false },
      { pattern: /Employment Verification/i, source_type: "TN_EMPLOYMENT_VERIFICATION_FORM", document_role: "EMPLOYMENT_VERIFICATION_FORM", programs: ["LIHTC", "HOTMA"], required: false },
      { pattern: /Asset Self-Certification/i, source_type: "TN_ASSET_SELF_CERTIFICATION_FORM", document_role: "ASSET_CERTIFICATION_FORM", programs: ["LIHTC", "HOTMA"], required: false },
      { pattern: /HOTMA Compliance Training/i, source_type: "TN_HOTMA_COMPLIANCE_GUIDANCE", document_role: "HOTMA_GUIDANCE", programs: ["LIHTC", "HOTMA"], required: false },
    ],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    allowed_hosts: ["thda.org", "www.thda.org"],
    url: "https://thda.org/rental-housing-partn/thomas-documents/",
    targets: [
      { pattern: /THOMAS Compliance Guide/i, source_type: "TN_THOMAS_COMPLIANCE_GUIDE", document_role: "LIHTC_COMPLIANCE_GUIDE", programs: ["LIHTC"], required: false },
      { pattern: /Utility Allowance Guidance/i, source_type: "TN_LIHTC_UTILITY_ALLOWANCE_GUIDANCE", document_role: "UTILITY_ALLOWANCE_GUIDANCE", programs: ["LIHTC"], required: false },
      { pattern: /Utility Allowance Instructions/i, source_type: "TN_LIHTC_UTILITY_ALLOWANCE_INSTRUCTIONS", document_role: "UTILITY_ALLOWANCE_INSTRUCTIONS", programs: ["LIHTC"], required: false },
      { pattern: /2026 LIHTC Eligibility Certification/i, source_type: "TN_2026_LIHTC_ELIGIBILITY_CERTIFICATION", document_role: "LIHTC_ELIGIBILITY_CERTIFICATION_FORM", programs: ["LIHTC"], required: false },
      { pattern: /Utility Allowance Certification and Utility Worksheet/i, source_type: "TN_UTILITY_ALLOWANCE_CERTIFICATION_FORM", document_role: "UTILITY_ALLOWANCE_FORM", programs: ["LIHTC"], required: false },
    ],
  },
  {
    state_code: "TN",
    agency: "Tennessee Housing Development Agency",
    allowed_hosts: ["thda.org", "www.thda.org"],
    url: "https://thda.org/rental-housing-partn/utility-allowances/",
    targets: [
      { pattern: /2026 Utility Allowance Methodology/i, source_type: "TN_2026_HCV_UTILITY_ALLOWANCE_METHODOLOGY", document_role: "HCV_UTILITY_ALLOWANCE_METHODOLOGY", programs: ["SECTION_8", "HCV", "PBV"], required: false },
      { pattern: /Instructions for 2026 Utility Allowances/i, source_type: "TN_2026_HCV_UTILITY_ALLOWANCE_INSTRUCTIONS", document_role: "HCV_UTILITY_ALLOWANCE_INSTRUCTIONS", programs: ["SECTION_8", "HCV", "PBV"], required: false },
    ],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    allowed_hosts: ["tdhca.texas.gov", "www.tdhca.texas.gov"],
    url: "https://www.tdhca.texas.gov/compliance-manuals-and-rules",
    targets: [
      { pattern: /Subchapter F.*Searchable PDF/i, source_type: "TX_LIHTC_COMPLIANCE_RULE_SUBCHAPTER_F", document_role: "LIHTC_COMPLIANCE_RULE", programs: ["LIHTC"], required: false },
      { pattern: /LIHTC Newsletter #\s*45/i, source_type: "TX_LIHTC_NEWSLETTER_45", document_role: "LIHTC_UTILITY_GROSS_RENT_GUIDANCE", programs: ["LIHTC"], required: false },
    ],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    allowed_hosts: ["tdhca.texas.gov", "www.tdhca.texas.gov"],
    url: "https://www.tdhca.texas.gov/compliance-forms",
    targets: [
      { pattern: /^Income Verification for Households with Section 8 Certificates/i, source_type: "TX_SECTION8_INCOME_VERIFICATION_FORM", document_role: "SECTION8_INCOME_VERIFICATION_FORM", programs: ["LIHTC", "SECTION_8", "HCV", "PBV"], required: false },
      { pattern: /^Asset Certification of Net Family Assets/i, source_type: "TX_ASSET_CERTIFICATION_FORM", document_role: "ASSET_CERTIFICATION_FORM", programs: ["LIHTC", "HOTMA"], required: false },
      { pattern: /^Employment Verification/i, source_type: "TX_HOTMA_EMPLOYMENT_VERIFICATION_FORM", document_role: "EMPLOYMENT_VERIFICATION_FORM", programs: ["LIHTC", "HOTMA"], required: false },
      { pattern: /^Income Certification$/i, source_type: "TX_HOTMA_INCOME_CERTIFICATION_FORM", document_role: "INCOME_CERTIFICATION_FORM", programs: ["LIHTC", "HOTMA"], required: false },
      { pattern: /^Income Certification Instructions/i, source_type: "TX_HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS", document_role: "HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS", programs: ["LIHTC", "HOTMA"], required: false },
    ],
  },
  {
    state_code: "TX",
    agency: "Texas Department of Housing and Community Affairs",
    allowed_hosts: ["tdhca.texas.gov", "www.tdhca.texas.gov"],
    url: "https://www.tdhca.texas.gov/section-8-resources",
    targets: [
      { pattern: /^2022 Administrative Plan$/i, source_type: "TX_HCV_PBV_ADMIN_PLAN", document_role: "HCV_PBV_ADMIN_PLAN", programs: ["SECTION_8", "HCV", "PBV"], required: false },
      { pattern: /Schedules effective 1-1-2026/i, source_type: "TX_2026_HCV_UTILITY_ALLOWANCE", document_role: "HCV_UTILITY_ALLOWANCE_SCHEDULE", programs: ["SECTION_8", "HCV", "PBV"], required: false },
      { pattern: /2025 Annual PHA Plan Draft/i, source_type: "TX_2025_HCV_PHA_PLAN", document_role: "PHA_PLAN_CURRENT", programs: ["SECTION_8", "HCV", "PBV"], required: false },
    ],
  },
];

const PROGRAM_REQUIREMENTS = {
  TN: {
    LIHTC: [
      { name: "QAP", one_of: ["LIHTC_QAP"] },
      { name: "compliance guide", one_of: ["LIHTC_COMPLIANCE_GUIDE"] },
      { name: "income/employment form", one_of: ["EMPLOYMENT_VERIFICATION_FORM", "LIHTC_ELIGIBILITY_CERTIFICATION_FORM"] },
      { name: "asset certification form", one_of: ["ASSET_CERTIFICATION_FORM"] },
    ],
    HOTMA: [
      { name: "HOTMA guidance", one_of: ["HOTMA_GUIDANCE", "HCV_HOTMA_NSPIRE_RULE_UPDATE"] },
      { name: "HOTMA-era asset form", one_of: ["ASSET_CERTIFICATION_FORM"] },
    ],
    SECTION_8: [
      { name: "HCV administrative plan", one_of: ["HCV_ADMIN_PLAN"] },
      { name: "current HOTMA/NSPIRE amendment", one_of: ["HCV_HOTMA_NSPIRE_RULE_UPDATE"] },
    ],
    HCV: [
      { name: "HCV administrative plan", one_of: ["HCV_ADMIN_PLAN"] },
      { name: "current HOTMA/NSPIRE amendment", one_of: ["HCV_HOTMA_NSPIRE_RULE_UPDATE"] },
    ],
    PBV: [
      { name: "PBV administrative chapter", one_of: ["PBV_ADMIN_CHAPTER"] },
      { name: "current PBV amendment", one_of: ["PBV_ADMIN_PLAN_AMENDMENT"] },
    ],
  },
  TX: {
    LIHTC: [
      { name: "QAP", one_of: ["LIHTC_QAP"] },
      { name: "compliance rule", one_of: ["LIHTC_COMPLIANCE_RULE"] },
      { name: "income certification form", one_of: ["INCOME_CERTIFICATION_FORM"] },
      { name: "asset certification form", one_of: ["ASSET_CERTIFICATION_FORM"] },
    ],
    HOTMA: [
      { name: "HOTMA income instructions", one_of: ["HOTMA_INCOME_CERTIFICATION_INSTRUCTIONS"] },
      { name: "HOTMA income form", one_of: ["INCOME_CERTIFICATION_FORM"] },
      { name: "HOTMA employment form", one_of: ["EMPLOYMENT_VERIFICATION_FORM"] },
    ],
    SECTION_8: [
      { name: "HCV administrative plan", one_of: ["HCV_PBV_ADMIN_PLAN"] },
      { name: "Section 8 income verification form", one_of: ["SECTION8_INCOME_VERIFICATION_FORM"] },
      { name: "2026 utility allowance schedule", one_of: ["HCV_UTILITY_ALLOWANCE_SCHEDULE"] },
    ],
    HCV: [
      { name: "HCV administrative plan", one_of: ["HCV_PBV_ADMIN_PLAN"] },
      { name: "2026 utility allowance schedule", one_of: ["HCV_UTILITY_ALLOWANCE_SCHEDULE"] },
    ],
    PBV: [
      { name: "PBV policies within HCV administrative plan", one_of: ["HCV_PBV_ADMIN_PLAN"] },
      { name: "current PHA plan confirming PBV activity", one_of: ["PHA_PLAN_CURRENT"] },
    ],
  },
};

function allowed(host, allowedHosts) {
  const value = host.toLowerCase();
  return allowedHosts.some((item) => value === item || value.endsWith(`.${item}`));
}

function allowedHostsForState(stateCode) {
  return stateCode === "TN"
    ? ["thda.org", "www.thda.org"]
    : ["tdhca.texas.gov", "www.tdhca.texas.gov"];
}

function validateFinalUrl(url, allowedHosts) {
  const final = new URL(url);
  if (final.protocol !== "https:" || !allowed(final.hostname, allowedHosts)) {
    throw new Error(`redirected_to_unapproved_host:${final.hostname}`);
  }
}

function normalizeContentType(value) {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function isHtmlContentType(contentType) {
  return contentType === "text/html" || contentType === "application/xhtml+xml";
}

function documentMagic(bytes) {
  const head = Buffer.from(bytes.subarray(0, 8));
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (head.subarray(0, 2).toString("ascii") === "PK") return "zip_ooxml";
  if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "ole_compound";
  return null;
}

function isDocumentResponse(response) {
  if (isHtmlContentType(response.contentType)) return false;
  if (DOCUMENT_CONTENT_TYPES.has(response.contentType)) return true;
  return documentMagic(response.bytes) !== null;
}

async function curlExact(url, allowedHosts) {
  const tempDirectory = await mkdtemp(join(tmpdir(), "certivoiq-tn-tx-"));
  const output = join(tempDirectory, "response.bin");
  try {
    const { stdout } = await execFileAsync("curl", [
      "--location", "--fail", "--silent", "--show-error", "--compressed",
      "--max-time", "40", "--proto", "=https",
      "--user-agent", "Mozilla/5.0 CertivoIQ-TN-TX-Document-Evidence/2.0",
      "--header", "Accept: application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.5",
      "--header", "Accept-Language: en-US,en;q=0.9",
      "--output", output,
      "--write-out", "%{url_effective}\n%{http_code}\n%{content_type}",
      url,
    ], { maxBuffer: 1024 * 1024 });
    const [finalUrl, statusText, rawContentType = ""] = stdout.trim().split("\n");
    validateFinalUrl(finalUrl, allowedHosts);
    const status = Number(statusText);
    if (!Number.isInteger(status) || status < 200 || status > 299) throw new Error(`http_status:${statusText}`);
    const file = await readFile(output);
    const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_document_size");
    return {
      bytes,
      finalUrl,
      contentType: normalizeContentType(rawContentType),
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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 CertivoIQ-TN-TX-Document-Evidence/2.0",
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
        contentType: normalizeContentType(response.headers.get("content-type")),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        transport: `fetch_attempt_${attempt}`,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(800 * attempt);
    }
  }
  try {
    return await curlExact(url, allowedHosts);
  } catch (curlError) {
    throw new Error(`${lastError instanceof Error ? lastError.message : String(lastError)}; curl:${curlError instanceof Error ? curlError.message : String(curlError)}`);
  }
}

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linksFromHtml(html, baseUrl, allowedHosts) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const label = cleanLabel(match[4]);
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function documentRecord(spec, response, discoveryUrl = null) {
  return {
    state_code: spec.state_code,
    agency: spec.agency,
    document_title: spec.title,
    source_type: spec.source_type,
    document_role: spec.document_role,
    programs: spec.programs,
    source_url: spec.source_url,
    final_url: response.finalUrl,
    discovery_url: discoveryUrl,
    content_type: response.contentType || null,
    byte_size: response.bytes.byteLength,
    source_sha256: sha256(response.bytes),
    document_magic: documentMagic(response.bytes),
    retrieved_at: new Date().toISOString(),
    etag: response.etag,
    last_modified: response.lastModified,
    capture_transport: response.transport,
    capture_status: "captured_unvalidated",
    evidence_kind: "exact_document_bytes",
    validation_evidence_eligible: true,
    exact_bytes_captured: true,
    independent_validation_required: true,
    compliance_activation_allowed: false,
  };
}

function discoveryRecord(source, response) {
  return {
    state_code: source.state_code,
    agency: source.agency,
    discovery_url: source.url,
    final_url: response.finalUrl,
    content_type: response.contentType || null,
    byte_size: response.bytes.byteLength,
    source_sha256: sha256(response.bytes),
    retrieved_at: new Date().toISOString(),
    capture_transport: response.transport,
    evidence_kind: "discovery_page_only",
    validation_evidence_eligible: false,
    compliance_activation_allowed: false,
  };
}

async function captureDocument(spec, discoveryUrl, failures) {
  const allowedHosts = allowedHostsForState(spec.state_code);
  try {
    const response = await fetchExact(spec.source_url, allowedHosts);
    if (!isDocumentResponse(response)) {
      failures.push({ state_code: spec.state_code, source_url: spec.source_url, discovery_url: discoveryUrl, source_type: spec.source_type, error: "matched_resource_is_not_a_downloadable_document" });
      return null;
    }
    return documentRecord(spec, response, discoveryUrl);
  } catch (error) {
    failures.push({ state_code: spec.state_code, source_url: spec.source_url, discovery_url: discoveryUrl, source_type: spec.source_type, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function discoverTargetDocument(source, target, link, failures, depth = 0) {
  try {
    const response = await fetchExact(link.url, source.allowed_hosts);
    if (isDocumentResponse(response)) {
      return documentRecord({
        state_code: source.state_code,
        agency: source.agency,
        title: link.label || target.source_type,
        source_url: link.url,
        source_type: target.source_type,
        document_role: target.document_role,
        programs: target.programs,
      }, response, source.url);
    }
    if (!isHtmlContentType(response.contentType) || depth >= MAX_DISCOVERY_DEPTH) {
      failures.push({ state_code: source.state_code, source_url: link.url, discovery_url: source.url, source_type: target.source_type, error: "matched_resource_did_not_resolve_to_document" });
      return null;
    }
    const nestedLinks = linksFromHtml(Buffer.from(response.bytes).toString("utf8"), response.finalUrl, source.allowed_hosts);
    for (const nested of nestedLinks) {
      if (!target.pattern.test(nested.label)) continue;
      const found = await discoverTargetDocument(source, target, nested, failures, depth + 1);
      if (found) return found;
    }
    failures.push({ state_code: source.state_code, source_url: link.url, discovery_url: source.url, source_type: target.source_type, error: "nested_document_not_found" });
    return null;
  } catch (error) {
    failures.push({ state_code: source.state_code, source_url: link.url, discovery_url: source.url, source_type: target.source_type, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function dedupeDocuments(documents) {
  const byIdentity = new Map();
  for (const document of documents) {
    const key = `${document.state_code}|${document.source_type}|${document.source_sha256}`;
    if (!byIdentity.has(key)) byIdentity.set(key, document);
  }
  return [...byIdentity.values()];
}

function buildCoverage(documents) {
  const coverage = [];
  for (const [stateCode, programRequirements] of Object.entries(PROGRAM_REQUIREMENTS)) {
    for (const [program, requirements] of Object.entries(programRequirements)) {
      const stateProgramDocs = documents.filter((doc) => doc.state_code === stateCode && doc.programs.includes(program));
      const roles = new Set(stateProgramDocs.map((doc) => doc.document_role));
      const missing = requirements
        .filter((requirement) => !requirement.one_of.some((role) => roles.has(role)))
        .map((requirement) => ({ requirement: requirement.name, accepted_roles: requirement.one_of }));
      coverage.push({
        state_code: stateCode,
        program,
        documents: stateProgramDocs.length,
        document_roles: [...roles].sort(),
        gaps: missing,
        document_level_validation_ready: missing.length === 0,
        compliance_activation_allowed: false,
      });
    }
  }
  return coverage;
}

const documents = [];
const discoveryPages = [];
const failures = [];

for (const spec of DIRECT_DOCUMENTS) {
  const captured = await captureDocument(spec, null, failures);
  if (captured) documents.push(captured);
}

for (const source of DISCOVERY_SOURCES) {
  let response;
  try {
    response = await fetchExact(source.url, source.allowed_hosts);
  } catch (error) {
    failures.push({ state_code: source.state_code, source_url: source.url, error: error instanceof Error ? error.message : String(error) });
    continue;
  }
  if (!isHtmlContentType(response.contentType)) {
    failures.push({ state_code: source.state_code, source_url: source.url, error: "discovery_source_is_not_html" });
    continue;
  }
  discoveryPages.push(discoveryRecord(source, response));
  const links = linksFromHtml(Buffer.from(response.bytes).toString("utf8"), response.finalUrl, source.allowed_hosts);
  for (const target of source.targets) {
    const matches = links.filter((link) => target.pattern.test(link.label));
    if (!matches.length) {
      if (target.required) failures.push({ state_code: source.state_code, source_url: source.url, source_type: target.source_type, error: "required_document_link_not_found" });
      continue;
    }
    let captured = null;
    for (const link of matches) {
      captured = await discoverTargetDocument(source, target, link, failures);
      if (captured) break;
    }
    if (captured) documents.push(captured);
  }
}

const finalDocuments = dedupeDocuments(documents);
const coverage = buildCoverage(finalDocuments);
const coverageGaps = coverage.filter((item) => !item.document_level_validation_ready);
const requiredDiscoveryFailures = failures.filter((failure) =>
  failure.error === "required_document_link_not_found" ||
  ["TN_HCV_2026_HOTMA_NSPIRE_RULE_UPDATE", "TN_PBV_2025_ADMIN_PLAN_AMENDMENT"].includes(failure.source_type),
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  evidence_policy: "Only downloadable document bytes are validation evidence. HTML landing pages are discovery evidence only and cannot satisfy a compliance document requirement.",
  documents: finalDocuments,
  discovery_pages: discoveryPages,
  failures,
  coverage,
}, null, 2));

console.log(JSON.stringify({
  outputPath,
  documents: finalDocuments.length,
  discovery_pages: discoveryPages.length,
  failures: failures.length,
  coverage_gaps: coverageGaps.map((item) => `${item.state_code}:${item.program}`),
  required_discovery_failures: requiredDiscoveryFailures.length,
}, null, 2));

if (coverageGaps.length || requiredDiscoveryFailures.length) process.exitCode = 2;
