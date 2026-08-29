export const REQUIRED_STATE_DOCUMENT_FAMILIES = Object.freeze([
  "COMPLIANCE_RULE_CHANGES",
  "COMPLIANCE_GUIDEBOOK",
  "INCOME_LIMITS",
  "RENT_LIMITS",
  "UTILITY_ALLOWANCE",
  "COMPLIANCE_FORMS",
  "COMPLIANCE_TRAINING",
]);

const FAMILY_PATTERNS = Object.freeze({
  COMPLIANCE_RULE_CHANGES: [
    /compliance[-_\s]+(?:rule|procedure)/i,
    /rule[-_\s]+changes?/i,
    /monitoring\s+rule/i,
    /chapter\s+\d+[\w.-]*\s+compliance/i,
  ],
  COMPLIANCE_GUIDEBOOK: [
    /compliance[-_\s]+(?:manual|guidebook|handbook|guide)/i,
    /property\s+management\s+manual/i,
    /asset\s+management\s+manual/i,
    /monitoring\s+manual/i,
  ],
  INCOME_LIMITS: [
    /income(?:[-_\s]+and[-_\s]+rent)?[-_\s]+limits?/i,
    /maximum\s+income/i,
    /mtsp[^a-z0-9]+income/i,
  ],
  RENT_LIMITS: [
    /(?:income[-_\s]+and[-_\s]+)?rent[-_\s]+limits?/i,
    /maximum\s+rents?/i,
    /gross\s+rent/i,
  ],
  UTILITY_ALLOWANCE: [
    /utility[-_\s]+allowance/i,
    /utility\s+schedule/i,
    /energy\s+consumption\s+model/i,
  ],
  COMPLIANCE_FORMS: [
    /compliance[-_\s]+forms?/i,
    /tenant\s+income\s+certification/i,
    /\btic[-_\s.]/i,
    /employment\s+verification/i,
    /student\s+verification/i,
    /asset\s+certification/i,
    /owner(?:'s)?\s+certification/i,
  ],
  COMPLIANCE_TRAINING: [
    /compliance[-_\s]+training/i,
    /compliance[-_\s]+workshop/i,
    /compliance[-_\s]+webinar/i,
    /training\s+(?:presentation|manual|materials?)/i,
  ],
});

const FAMILY_NEGATIVE_PATTERNS = Object.freeze({
  COMPLIANCE_RULE_CHANGES: [/archive/i, /proposed/i, /notice\s+of\s+rulemaking/i],
  COMPLIANCE_GUIDEBOOK: [/application/i, /qualified\s+allocation|\bqap\b/i],
  INCOME_LIMITS: [/homeownership/i, /single.family/i],
  RENT_LIMITS: [/homeownership/i, /single.family/i],
  UTILITY_ALLOWANCE: [],
  COMPLIANCE_FORMS: [/application/i],
  COMPLIANCE_TRAINING: [],
});

export function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#x2F;/gi, "/");
}

export function normalizeLabel(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function extractOfficialLinks(html, baseUrl, allowedDomains) {
  const domains = (Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains])
    .map((value) => String(value ?? "").toLowerCase())
    .filter(Boolean);
  const links = [];
  const seen = new Set();
  const pattern = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html ?? "").matchAll(pattern)) {
    const rawHref = decodeHtml(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || /^(?:mailto|tel|javascript):/i.test(rawHref)) continue;
    try {
      const url = new URL(rawHref, baseUrl);
      url.hash = "";
      const host = url.hostname.toLowerCase();
      const allowed = url.protocol === "https:" && domains.some((domain) => host === domain || host.endsWith("." + domain));
      if (!allowed || seen.has(url.href)) continue;
      seen.add(url.href);
      links.push(Object.freeze({ url: url.href, label: normalizeLabel(match[4]) }));
    } catch {
      // Invalid links are ignored and never enter the capture queue.
    }
  }
  return links;
}

function yearFrom(value) {
  const years = [...String(value ?? "").matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years.length ? Math.max(...years) : null;
}

export function classifyDocument({ label, url, sourceType = "" }) {
  const haystack = String(label ?? "") + " " + String(url ?? "") + " " + String(sourceType);
  const families = [];
  for (const family of REQUIRED_STATE_DOCUMENT_FAMILIES) {
    const positive = FAMILY_PATTERNS[family].reduce((score, pattern) => score + (pattern.test(haystack) ? 2 : 0), 0);
    const negative = FAMILY_NEGATIVE_PATTERNS[family].reduce((score, pattern) => score + (pattern.test(haystack) ? 3 : 0), 0);
    const score = positive - negative;
    if (score > 0) families.push({ family, score });
  }
  return Object.freeze({
    families: families.sort((left, right) => right.score - left.score).map((item) => item.family),
    score: families.length ? Math.max(...families.map((item) => item.score)) : 0,
    declared_year: yearFrom(haystack),
  });
}

export function selectCurrentDocuments(documents, { currentYear = new Date().getUTCFullYear(), perFamilyLimit = 20 } = {}) {
  const byFamily = new Map(REQUIRED_STATE_DOCUMENT_FAMILIES.map((family) => [family, []]));
  for (const document of documents) {
    for (const family of document.families ?? []) byFamily.get(family)?.push(document);
  }

  const selectedUrls = new Set();
  for (const candidates of byFamily.values()) {
    const newestYear = candidates.reduce((latest, item) => Math.max(latest, item.declared_year ?? 0), 0);
    const current = candidates.filter((item) =>
      !newestYear || !item.declared_year || item.declared_year === newestYear ||
      (newestYear < currentYear && item.declared_year === currentYear - 1)
    );
    current
      .sort((left, right) =>
        (right.declared_year ?? 0) - (left.declared_year ?? 0) ||
        (right.score ?? 0) - (left.score ?? 0) ||
        String(left.url).localeCompare(String(right.url))
      )
      .slice(0, perFamilyLimit)
      .forEach((item) => selectedUrls.add(item.url));
  }

  return [...new Map(
    documents.filter((item) => selectedUrls.has(item.url)).map((item) => [item.url, item]),
  ).values()];
}

export function coverageGaps(stateCode, documents) {
  const found = new Set(documents.flatMap((document) => document.families ?? []));
  return REQUIRED_STATE_DOCUMENT_FAMILIES
    .filter((family) => !found.has(family))
    .map((family) => Object.freeze({
      state_code: stateCode,
      document_family: family,
      status: "NOT_PUBLISHED_OR_NOT_DISCOVERED_REQUIRES_HUMAN_REVIEW",
      compliance_activation_allowed: false,
    }));
}
