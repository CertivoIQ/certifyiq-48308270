import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inventory = JSON.parse(await readFile(resolve("src/lib/nationwide-state-source-discovery.json"), "utf8"));
const outputPath = resolve(process.argv[2] ?? "artifacts/state-lihtc-gap-documents.json");
const MAX_BYTES = 40 * 1024 * 1024;
const CURRENT_YEAR = 2026;
const TARGETS = {
  LIHTC_QAP: new Set("AK AL AR CA CO CT GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NH NJ NV NY OH OK OR PA RI SC SD UT VT WA WI WV WY".split(" ")),
  INCOME_LIMITS: new Set("AK AZ HI MA MO MT NC NE NJ NY OH OK OR SC SD UT VA WA WI WV".split(" ")),
  RENT_LIMITS: new Set("AK AZ CO DE HI MA MO MT NC ND NE NH NJ NY OH OK OR RI SC SD UT VA VT WI WV".split(" ")),
  LIHTC_COMPLIANCE_MANUAL: new Set("AR CT KY LA MA ME MI NC ND NH NJ NM NY OK PA SC".split(" ")),
};
const ALL_STATES = new Set(Object.values(TARGETS).flatMap((s) => [...s]));
const ROLE_PATTERNS = {
  LIHTC_QAP: /\bqap\b|qualified\s+allocation\s+plan/i,
  INCOME_LIMITS: /(?:lihtc|tax\s*credit|housing\s*credit|mtsp).{0,70}income.{0,25}limit|income.{0,25}limit.{0,70}(?:lihtc|tax\s*credit|housing\s*credit|mtsp)|mtsp.{0,35}income/i,
  RENT_LIMITS: /(?:lihtc|tax\s*credit|housing\s*credit|mtsp).{0,70}rent.{0,25}limit|rent.{0,25}limit.{0,70}(?:lihtc|tax\s*credit|housing\s*credit|mtsp)|maximum\s+rent|mtsp.{0,35}rent/i,
  LIHTC_COMPLIANCE_MANUAL: /(?:lihtc|tax\s*credit|housing\s*credit).{0,90}(?:compliance|monitoring).{0,45}(?:manual|guide|handbook)|(?:compliance|monitoring).{0,45}(?:manual|guide|handbook).{0,90}(?:lihtc|tax\s*credit|housing\s*credit)/i,
};
const PAGE_HINT = /qap|qualified|lihtc|tax.credit|housing.credit|compliance|monitor|income|rent|limits|manual|forms|documents|resources/i;

function decode(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}
function label(value) {
  return decode(String(value ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function isOfficialPage(url, domains) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
function anchors(html, base) {
  const out = [];
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(re)) {
    const raw = decode(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!raw || /^(?:mailto|tel|javascript):/i.test(raw)) continue;
    try {
      const url = new URL(raw, base);
      url.hash = "";
      if (url.protocol === "https:") out.push({ url: url.href, label: label(match[4]) });
    } catch {}
  }
  return out;
}
function rolesFor(text, state) {
  const roles = [];
  for (const [role, re] of Object.entries(ROLE_PATTERNS)) {
    if (TARGETS[role].has(state) && re.test(text)) roles.push(role);
  }
  return roles;
}
function magic(bytes) {
  const head = Buffer.from(bytes.subarray(0, 8));
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (head.subarray(0, 2).toString("ascii") === "PK") return "zip_ooxml";
  if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "ole_compound";
  return null;
}
function score(candidate) {
  const haystack = `${candidate.label} ${decodeURIComponent(candidate.url)}`.toLowerCase();
  let value = 0;
  if (haystack.includes(String(CURRENT_YEAR))) value += 80;
  if (haystack.includes("2025")) value += 25;
  if (/final|adopted|approved|amended/.test(haystack)) value += 30;
  if (/current/.test(haystack)) value += 10;
  if (/draft|proposed|archive|prior|historical/.test(haystack)) value -= 100;
  if (/redline|changes|memo|faq|workshop|presentation/.test(haystack)) value -= 35;
  if (/\.pdf(?:$|[?#])/.test(haystack)) value += 15;
  return value;
}
async function fetchBytes(url, timeout = 18_000) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
    headers: {
      "user-agent": "Mozilla/5.0 CertivoIQ-State-Gap-Capture/1.0",
      "cache-control": "no-cache",
      accept: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,*/*;q=0.4",
    },
  });
  if (!response.ok) throw new Error(`http_status:${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_size");
  return {
    response,
    bytes,
    contentType: String(response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase(),
  };
}
async function discoverState(jurisdiction) {
  const domains = (Array.isArray(jurisdiction.official_domain) ? jurisdiction.official_domain : [jurisdiction.official_domain])
    .map((value) => String(value).toLowerCase());
  const pages = [...(jurisdiction.sources ?? []).map((source) => ({ url: source.url, hint: source.type, root: source.url }))];
  const pageSeen = new Set();
  const candidates = [];
  const failures = [];
  for (let wave = 0; wave < 2; wave += 1) {
    const current = pages.splice(0, pages.length).slice(0, wave === 0 ? 12 : 24);
    const results = await Promise.all(current.map(async (page) => {
      if (pageSeen.has(page.url)) return null;
      pageSeen.add(page.url);
      try {
        const result = await fetchBytes(page.url, 12_000);
        return { page, ...result };
      } catch (error) {
        failures.push({ state_code: jurisdiction.state_code, url: page.url, error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    }));
    for (const item of results.filter(Boolean)) {
      const { page, response, bytes, contentType } = item;
      if (!contentType.includes("html")) {
        const roles = rolesFor(`${page.hint} ${page.url}`, jurisdiction.state_code);
        if (roles.length) candidates.push({ url: response.url, label: page.hint, roles, discovery_url: page.root, authorization: "official_direct_source" });
        continue;
      }
      const html = Buffer.from(bytes).toString("utf8");
      for (const anchor of anchors(html, response.url)) {
        const text = `${anchor.label} ${decodeURIComponent(anchor.url)} ${page.hint}`;
        const roles = rolesFor(text, jurisdiction.state_code);
        if (roles.length) candidates.push({ ...anchor, roles, discovery_url: page.url, authorization: "link_on_official_authority_page" });
        if (wave === 0 && PAGE_HINT.test(text) && isOfficialPage(anchor.url, domains) && !pageSeen.has(anchor.url)) {
          pages.push({ url: anchor.url, hint: anchor.label, root: page.root });
        }
      }
    }
  }
  return {
    candidates: [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()].sort((left, right) => score(right) - score(left)),
    failures,
  };
}
async function captureCandidate(jurisdiction, candidate) {
  try {
    const { response, bytes, contentType } = await fetchBytes(candidate.url, 30_000);
    const documentMagic = magic(bytes);
    if (!documentMagic) throw new Error("not_supported_document");
    return {
      state_code: jurisdiction.state_code,
      agency: jurisdiction.agency,
      official_domain: jurisdiction.official_domain,
      document_title: candidate.label || candidate.roles.join(" / "),
      program_document_roles: candidate.roles,
      programs: ["LIHTC"],
      source_type: candidate.roles.join("_AND_"),
      source_url: candidate.url,
      final_url: response.url,
      discovery_url: candidate.discovery_url,
      attachment_authorization: candidate.authorization,
      content_type: contentType || null,
      document_magic: documentMagic,
      byte_size: bytes.byteLength,
      source_sha256: createHash("sha256").update(bytes).digest("hex"),
      retrieved_at: new Date().toISOString(),
      exact_bytes_captured: true,
      evidence_kind: "exact_document_bytes",
      validation_evidence_eligible: true,
      agent_verification_status: "captured_unvalidated",
      independent_validation_required: true,
      compliance_activation_allowed: false,
    };
  } catch (error) {
    return {
      state_code: jurisdiction.state_code,
      source_url: candidate.url,
      roles: candidate.roles,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const jurisdictions = (inventory.jurisdictions ?? []).filter((jurisdiction) => ALL_STATES.has(jurisdiction.state_code));
const documents = [];
const failures = [];
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= jurisdictions.length) return;
    const jurisdiction = jurisdictions[index];
    const discovery = await discoverState(jurisdiction);
    failures.push(...discovery.failures);
    const needed = new Set(Object.keys(TARGETS).filter((role) => TARGETS[role].has(jurisdiction.state_code)));
    const selected = [];
    for (const candidate of discovery.candidates) {
      if (!candidate.roles.some((role) => needed.has(role))) continue;
      const result = await captureCandidate(jurisdiction, candidate);
      if (result.source_sha256) {
        selected.push(result);
        result.program_document_roles.forEach((role) => needed.delete(role));
      } else {
        failures.push(result);
      }
      if (!needed.size) break;
    }
    documents.push(...selected);
    console.log(JSON.stringify({ state: jurisdiction.state_code, candidates: discovery.candidates.length, captured: selected.length, remaining: [...needed] }));
  }
}
await Promise.all(Array.from({ length: 10 }, () => worker()));
const coverage = jurisdictions.map((jurisdiction) => {
  const stateDocuments = documents.filter((document) => document.state_code === jurisdiction.state_code);
  const roles = [...new Set(stateDocuments.flatMap((document) => document.program_document_roles))];
  return {
    state_code: jurisdiction.state_code,
    roles,
    captured: stateDocuments.length,
    remaining: Object.keys(TARGETS).filter((role) => TARGETS[role].has(jurisdiction.state_code) && !roles.includes(role)),
  };
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ generated_at: new Date().toISOString(), documents, failures, coverage }, null, 2));
console.log(JSON.stringify({ documents: documents.length, states: coverage.length, remaining: coverage.filter((item) => item.remaining.length).length }, null, 2));
