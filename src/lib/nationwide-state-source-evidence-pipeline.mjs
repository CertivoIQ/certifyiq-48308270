import { createHash } from "node:crypto";

export const STATE_SOURCE_EVIDENCE_CAPTURE_BUILD = "nationwide-state-source-evidence-2026.08.27.1";
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const MONTHS = Object.freeze({
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
});

function asDomains(value) {
  return (Array.isArray(value) ? value : [value])
    .map((domain) => String(domain ?? "").trim().toLowerCase())
    .filter(Boolean);
}

export function isOfficialSourceUrl(value, officialDomain) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return asDomains(officialDomain).some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function dateToIso(year, month, day) {
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    value.getUTCFullYear() !== Number(year) ||
    value.getUTCMonth() + 1 !== Number(month) ||
    value.getUTCDate() !== Number(day)
  ) return null;
  return value.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateText(value) {
  const candidate = String(value ?? "").trim();
  const named = candidate.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(20\d{2})$/i,
  );
  if (named) return dateToIso(named[3], MONTHS[named[1].toLowerCase()], named[2]);
  const iso = candidate.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) return dateToIso(iso[1], iso[2], iso[3]);
  const numeric = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (numeric) return dateToIso(numeric[3], numeric[1], numeric[2]);
  return null;
}

export function extractDeclaredEffectiveDate(value) {
  const text = normalizeText(value);
  const patterns = [
    /\beffective\s+(?:date|as\s+of|on|from)\s*[:\-]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*20\d{2}|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2})\b/ig,
    /\b(?:this\s+)?(?:manual|document|requirements|rules|plan)\s+(?:are\s+|is\s+)?effective\s*[:\-]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*20\d{2}|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2})\b/ig,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const effectiveDate = parseDateText(match[1]);
    if (effectiveDate) {
      return Object.freeze({
        effective_date: effectiveDate,
        effective_date_status: "DECLARED_DATE_EXTRACTED_PENDING_SUPERSESSION_RECONCILIATION",
        effective_date_evidence: match[0].slice(0, 500),
      });
    }
  }
  return Object.freeze({
    effective_date: null,
    effective_date_status: "NO_MACHINE_VERIFIABLE_EFFECTIVE_DATE",
    effective_date_evidence: null,
  });
}

function sourceIdentity(jurisdiction, source) {
  return createHash("sha256")
    .update(`${jurisdiction.state_code}|${jurisdiction.scope}|${source.type}|${source.url}`)
    .digest("hex");
}

function blockedRecord(jurisdiction, source, status, reasonCode, extra = {}) {
  return Object.freeze({
    state_code: jurisdiction.state_code,
    scope: jurisdiction.scope,
    agency: jurisdiction.agency,
    source_type: source.type,
    candidate_status: source.status,
    source_url: source.url,
    source_id: sourceIdentity(jurisdiction, source),
    source_evidence_status: status,
    reason_code: reasonCode,
    activation_status: "BLOCKED_PENDING_CONTENT_VALIDATION_AND_INDEPENDENT_APPROVAL",
    compliance_activation_allowed: false,
    ...extra,
  });
}

export function createCapturedSourceRecord({
  jurisdiction,
  source,
  finalUrl,
  httpStatus,
  contentType,
  declaredContentLength,
  body,
  retrievedAt,
  extractedText,
  fetchError,
} = {}) {
  if (!jurisdiction || !source || !isOfficialSourceUrl(source.url, jurisdiction.official_domain)) {
    return blockedRecord(jurisdiction ?? {}, source ?? {}, "CAPTURE_BLOCKED", "SOURCE_URL_NOT_OFFICIAL_ALLOWLISTED");
  }
  if (finalUrl && !isOfficialSourceUrl(finalUrl, jurisdiction.official_domain)) {
    return blockedRecord(jurisdiction, source, "CAPTURE_BLOCKED", "FINAL_URL_NOT_OFFICIAL_ALLOWLISTED", { final_url: finalUrl });
  }
  if (fetchError) {
    return blockedRecord(jurisdiction, source, "CAPTURE_FAILED", "SOURCE_RETRIEVAL_FAILED", { fetch_error: String(fetchError).slice(0, 500) });
  }
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus > 299) {
    return blockedRecord(jurisdiction, source, "CAPTURE_FAILED", "SOURCE_HTTP_STATUS_NOT_SUCCESS", { final_url: finalUrl ?? source.url, http_status: httpStatus ?? null });
  }
  const bytes = body instanceof Uint8Array ? body : Buffer.from(body ?? "");
  if (!bytes.byteLength || bytes.byteLength > MAX_SOURCE_BYTES) {
    return blockedRecord(jurisdiction, source, "CAPTURE_BLOCKED", "SOURCE_SIZE_INVALID", { final_url: finalUrl ?? source.url, content_length: bytes.byteLength });
  }
  const effectiveDate = extractDeclaredEffectiveDate(extractedText ?? Buffer.from(bytes).toString("utf8"));
  return Object.freeze({
    state_code: jurisdiction.state_code,
    scope: jurisdiction.scope,
    agency: jurisdiction.agency,
    source_type: source.type,
    candidate_status: source.status,
    source_url: source.url,
    source_id: sourceIdentity(jurisdiction, source),
    final_url: finalUrl ?? source.url,
    http_status: httpStatus,
    content_type: String(contentType ?? "").split(";", 1)[0].toLowerCase() || null,
    declared_content_length: Number.isFinite(Number(declaredContentLength)) ? Number(declaredContentLength) : null,
    content_length: bytes.byteLength,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    retrieved_at: new Date(retrievedAt).toISOString(),
    source_evidence_status: "CAPTURED_UNVALIDATED",
    reason_code: "EXACT_BYTES_CAPTURED_PENDING_CONTENT_AND_SUPERSESSION_VALIDATION",
    ...effectiveDate,
    activation_status: "BLOCKED_PENDING_CONTENT_VALIDATION_AND_INDEPENDENT_APPROVAL",
    compliance_activation_allowed: false,
    capture_build: STATE_SOURCE_EVIDENCE_CAPTURE_BUILD,
  });
}
