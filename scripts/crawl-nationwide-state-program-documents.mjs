import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inventoryPath = resolve("src/lib/nationwide-state-source-discovery.json");
const outputPath = resolve(process.argv[2] ?? "artifacts/nationwide-state-program-documents.json");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PAGES_PER_JURISDICTION = 50;
const MAX_DOCUMENTS_PER_JURISDICTION = 120;

const STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]);

const PROGRAM_PATTERNS = [
  { role: "LIHTC_QAP", programs: ["LIHTC"], re: /\bqap\b|qualified\s+allocation\s+plan/i },
  { role: "LIHTC_COMPLIANCE_MANUAL", programs: ["LIHTC"], re: /(?:lihtc|tax\s*credit|housing\s*credit)?.{0,45}(?:compliance|monitoring).{0,25}(?:manual|guide|plan)|(?:compliance|monitoring).{0,25}(?:manual|guide|plan).{0,45}(?:lihtc|tax\s*credit|housing\s*credit)/i },
  { role: "HOTMA_GUIDANCE", programs: ["LIHTC","HOTMA"], re: /\bhotma\b|housing\s+opportunity\s+through\s+modernization/i },
  { role: "NSPIRE_GUIDANCE", programs: ["SECTION_8","HCV","PBV"], re: /\bnspire\b/i },
  { role: "HCV_ADMIN_PLAN", programs: ["SECTION_8","HCV"], re: /(?:housing\s+choice\s+voucher|\bhcv\b).{0,50}(?:administrative|admin).{0,20}plan|(?:administrative|admin).{0,20}plan.{0,50}(?:housing\s+choice\s+voucher|\bhcv\b)/i },
  { role: "PBV_POLICY", programs: ["SECTION_8","HCV","PBV"], re: /project[-\s]+based\s+voucher|\bpbv\b/i },
  { role: "PHA_PLAN", programs: ["SECTION_8","HCV","PBV"], re: /\bpha\s+plan\b|\b(?:5|five)[-\s]+year\s+(?:pha\s+)?plan\b/i },
  { role: "HCV_UTILITY_ALLOWANCE", programs: ["SECTION_8","HCV","PBV"], re: /(?:housing\s+choice\s+voucher|\bhcv\b|section\s*8).{0,60}utility\s+allowance|utility\s+allowance.{0,60}(?:housing\s+choice\s+voucher|\bhcv\b|section\s*8)/i },
  { role: "SECTION8_HCV_FORM", programs: ["SECTION_8","HCV"], re: /(?:housing\s+choice\s+voucher|\bhcv\b|section\s*8).{0,60}(?:verification|certification|form|worksheet)|(?:verification|certification|form|worksheet).{0,60}(?:housing\s+choice\s+voucher|\bhcv\b|section\s*8)/i },
  { role: "LIHTC_INCOME_RENT_LIMITS", programs: ["LIHTC"], re: /(?:income|rent).{0,25}limits|limits.{0,25}(?:income|rent)/i },
  { role: "UTILITY_ALLOWANCE", programs: ["LIHTC"], re: /utility\s+allowance/i },
  { role: "COMPLIANCE_FORM", programs: ["LIHTC","HOTMA"], re: /tenant\s+income\s+certification|employment\s+verification|asset\s+(?:self[-\s]*)?certification|owner.{0,20}certification/i },
];

const PAGE_DISCOVERY_RE = /qap|qualified[-_/ ]allocation|compliance|monitor|hotma|nspire|housing[-_/ ]choice|\bhcv\b|section[-_/ ]?8|project[-_/ ]based|\bpbv\b|pha[-_/ ]plan|administrative[-_/ ]plan|utility[-_/ ]allowance|income[-_/ ]limit|rent[-_/ ]limit|forms?|documents?|property[-_/ ]manager/i;

function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(?:8211|x2013);|&ndash;/gi, "–")
    .replace(/&#(?:8212|x2014);|&mdash;/gi, "—")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rolesFor(label, url, sourceType = "") {
  const haystack = `${label} ${decodeURIComponent(url)} ${sourceType}`;
  const roles = [];
  const programs = new Set();
  for (const pattern of PROGRAM_PATTERNS) {
    if (!pattern.re.test(haystack)) continue;
    roles.push(pattern.role);
    for (const program of pattern.programs) programs.add(program);
  }
  return { roles: [...new Set(roles)], programs: [...programs] };
}

function approvedHost(hostname, officialDomain) {
  const host = hostname.toLowerCase();
  const domain = officialDomain.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

function magic(bytes) {
  const head = Buffer.from(bytes.subarray(0, 8));
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (head.subarray(0, 2).toString("ascii") === "PK") return "zip_ooxml";
  if (head.equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))) return "ole_compound";
  return null;
}

function isHtml(contentType) {
  return contentType === "text/html" || contentType === "application/xhtml+xml";
}

async function fetchBytes(url, officialDomain, accept = "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,application/xhtml+xml,*/*;q=0.5") {
  const initial = new URL(url);
  if (initial.protocol !== "https:" || !approvedHost(initial.hostname, officialDomain)) throw new Error(`unapproved_initial_host:${initial.hostname}`);
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "user-agent": "Mozilla/5.0 CertivoIQ-Nationwide-Program-Document-Capture/1.0",
          accept,
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
        },
      });
      if (!response.ok) throw new Error(`http_status:${response.status}`);
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || !approvedHost(finalUrl.hostname, officialDomain)) throw new Error(`redirected_to_unapproved_host:${finalUrl.hostname}`);
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
    }
  }
  throw lastError;
}

function linksFromHtml(html, baseUrl, officialDomain) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const raw = String(match[1] ?? match[2] ?? match[3] ?? "").replace(/&amp;/gi, "&").trim();
    try {
      const target = new URL(raw, baseUrl);
      target.hash = "";
      if (target.protocol !== "https:" || !approvedHost(target.hostname, officialDomain) || seen.has(target.href)) continue;
      seen.add(target.href);
      out.push({ label: clean(match[4]), url: target.href });
    } catch {}
  }
  return out;
}

function urlsFromSitemap(xml, baseUrl, officialDomain) {
  const urls = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    try {
      const url = new URL(String(match[1]).replace(/&amp;/gi, "&"), baseUrl);
      if (url.protocol === "https:" && approvedHost(url.hostname, officialDomain)) urls.push(url.href);
    } catch {}
  }
  return urls;
}

async function sitemapPages(jurisdiction) {
  const roots = new Set();
  for (const source of jurisdiction.sources ?? []) {
    try { roots.add(new URL(source.url).origin); } catch {}
  }
  roots.add(`https://${jurisdiction.official_domain}`);
  const pages = new Set();
  const sitemapQueue = [];
  for (const root of roots) {
    sitemapQueue.push(`${root}/sitemap.xml`, `${root}/sitemap_index.xml`);
  }
  const visited = new Set();
  while (sitemapQueue.length && visited.size < 8) {
    const sitemapUrl = sitemapQueue.shift();
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    try {
      const response = await fetchBytes(sitemapUrl, jurisdiction.official_domain, "application/xml,text/xml,text/plain,*/*;q=0.5");
      const xml = Buffer.from(response.bytes).toString("utf8");
      for (const url of urlsFromSitemap(xml, response.finalUrl, jurisdiction.official_domain)) {
        if (/\.xml(?:$|\?)/i.test(url) && sitemapQueue.length < 20) sitemapQueue.push(url);
        else if (PAGE_DISCOVERY_RE.test(url)) pages.add(url);
        if (pages.size >= MAX_PAGES_PER_JURISDICTION) break;
      }
    } catch {}
    if (pages.size >= MAX_PAGES_PER_JURISDICTION) break;
  }
  return [...pages];
}

async function captureDocument(jurisdiction, candidate, failures) {
  try {
    const response = await fetchBytes(candidate.url, jurisdiction.official_domain);
    const documentMagic = magic(response.bytes);
    if (isHtml(response.contentType) || !documentMagic) throw new Error("candidate_resolved_to_non_document");
    return {
      state_code: jurisdiction.state_code,
      agency: jurisdiction.agency,
      official_domain: jurisdiction.official_domain,
      document_title: candidate.label || candidate.sourceType || new URL(candidate.url).pathname.split("/").pop(),
      source_type: candidate.sourceType || candidate.roles.join("_"),
      program_document_roles: candidate.roles,
      programs: candidate.programs,
      source_url: candidate.url,
      final_url: response.finalUrl,
      discovery_url: candidate.discoveryUrl ?? null,
      content_type: response.contentType || null,
      document_magic: documentMagic,
      byte_size: response.bytes.byteLength,
      source_sha256: createHash("sha256").update(response.bytes).digest("hex"),
      retrieved_at: new Date().toISOString(),
      etag: response.etag,
      last_modified: response.lastModified,
      capture_transport: response.transport,
      evidence_kind: "exact_document_bytes",
      exact_bytes_captured: true,
      validation_evidence_eligible: true,
      agent_verification_status: "captured_unvalidated",
      independent_validation_required: true,
      compliance_activation_allowed: false,
    };
  } catch (error) {
    failures.push({ state_code: jurisdiction.state_code, url: candidate.url, discovery_url: candidate.discoveryUrl ?? null, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function crawlJurisdiction(jurisdiction) {
  const candidates = new Map();
  const failures = [];
  const discoveryPages = new Set((jurisdiction.sources ?? []).map((source) => source.url));
  for (const page of await sitemapPages(jurisdiction)) discoveryPages.add(page);

  for (const source of jurisdiction.sources ?? []) {
    const classification = rolesFor(source.type, source.url, source.type);
    if (classification.roles.length) candidates.set(source.url, { label: source.type, url: source.url, sourceType: source.type, ...classification });
  }

  for (const pageUrl of [...discoveryPages].slice(0, MAX_PAGES_PER_JURISDICTION)) {
    if (candidates.size >= MAX_DOCUMENTS_PER_JURISDICTION) break;
    try {
      const response = await fetchBytes(pageUrl, jurisdiction.official_domain, "text/html,application/xhtml+xml,application/pdf,application/octet-stream,*/*;q=0.5");
      if (!isHtml(response.contentType)) {
        const classification = rolesFor(pageUrl, pageUrl);
        if (classification.roles.length) candidates.set(pageUrl, { label: pageUrl, url: pageUrl, discoveryUrl: null, ...classification });
        continue;
      }
      const html = Buffer.from(response.bytes).toString("utf8");
      for (const link of linksFromHtml(html, response.finalUrl, jurisdiction.official_domain)) {
        const classification = rolesFor(link.label, link.url);
        if (!classification.roles.length) continue;
        candidates.set(link.url, { ...link, discoveryUrl: pageUrl, ...classification });
        if (candidates.size >= MAX_DOCUMENTS_PER_JURISDICTION) break;
      }
    } catch (error) {
      failures.push({ state_code: jurisdiction.state_code, url: pageUrl, discovery_page_error: true, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const documents = [];
  for (const candidate of [...candidates.values()].slice(0, MAX_DOCUMENTS_PER_JURISDICTION)) {
    const captured = await captureDocument(jurisdiction, candidate, failures);
    if (captured) documents.push(captured);
  }
  const unique = new Map();
  for (const document of documents) {
    const key = `${document.source_sha256}|${document.source_url}`;
    if (!unique.has(key)) unique.set(key, document);
  }
  return { state_code: jurisdiction.state_code, agency: jurisdiction.agency, documents: [...unique.values()], failures };
}

const jurisdictions = (inventory.jurisdictions ?? []).filter((jurisdiction) => STATE_CODES.has(jurisdiction.state_code));
const results = [];
for (let index = 0; index < jurisdictions.length; index += 4) {
  results.push(...await Promise.all(jurisdictions.slice(index, index + 4).map(crawlJurisdiction)));
}

const documents = results.flatMap((result) => result.documents);
const failures = results.flatMap((result) => result.failures);
const coverage = results.map((result) => ({
  state_code: result.state_code,
  exact_program_documents: result.documents.length,
  roles: [...new Set(result.documents.flatMap((document) => document.program_document_roles))].sort(),
  programs: [...new Set(result.documents.flatMap((document) => document.programs))].sort(),
}));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  evidence_policy: "Only exact downloadable document bytes are captured. Program roles are optional state-agency evidence: HCV/PBV documents are not treated as universally state-required because many programs are administered by local PHAs.",
  documents,
  failures,
  coverage,
}, null, 2));

console.log(JSON.stringify({
  outputPath,
  jurisdictions: results.length,
  exact_program_documents: documents.length,
  states_with_program_documents: coverage.filter((item) => item.exact_program_documents > 0).length,
  states_without_program_documents: coverage.filter((item) => item.exact_program_documents === 0).map((item) => item.state_code),
  failures: failures.length,
}, null, 2));
