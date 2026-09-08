import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";
import type { PageProvenance } from "@/lib/ocr-sidecar.mjs";
import { supplementalPageKind } from "@/lib/tic-supplemental-fields";

export type SupplementalTextCandidate = {
  key: string;
  value: string | number;
  page: number;
  line: string;
};

const WORKSHEET_SCALARS = [
  ["worksheet_property_code", "property code", "text"],
  ["worksheet_property_name", "property name", "text"],
  ["worksheet_unit_code", "unit code", "text"],
  ["worksheet_household_name", "household name", "text"],
  ["worksheet_tenant_code", "tenant code", "text"],
  ["worksheet_unit_size", "unit size", "text"],
  ["worksheet_certification_date", "certification date", "date"],
  ["worksheet_certification_type", "certification type", "text"],
  ["worksheet_certification_code", "certification code", "text"],
  ["worksheet_total_of_all_income_sources", "total of all income sources", "currency"],
  ["worksheet_total_asset_cash_value", "total asset cash value", "currency"],
  ["worksheet_total_actual_income", "total actual income", "currency"],
  ["worksheet_passbook_rate_percent", "passbook rate percent", "number"],
  ["worksheet_total_imputed_income", "total imputed income", "currency"],
  ["worksheet_greatest_asset_income", "greatest asset income", "currency"],
  ["worksheet_total_income", "total income", "currency"],
  ["worksheet_total_asset_income", "total asset income", "currency"],
  ["worksheet_total_annual_income", "total annual income", "currency"],
  ["worksheet_qualifying_income_limit_percent", "qualifying income limit percent", "number"],
  ["worksheet_qualifying_income_limit", "qualifying income limit", "currency"],
  ["worksheet_variance", "variance", "currency"],
  ["worksheet_total_reported_income", "total reported income", "currency"],
] as const;

type ScalarType = (typeof WORKSHEET_SCALARS)[number][2];
type Scalar = (typeof WORKSHEET_SCALARS)[number];

function compact(value: string) {
  return value.replace(/[\uF000-\uF8FF]/g, " ").replace(/[☐□▢◻◽]/g, " ").replace(/_{2,}/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(type: ScalarType, raw: string): string | number | null {
  const value = compact(raw.replace(/^\s*[:=\-–—]?\s*/, ""));
  if (!value) return null;
  if (type === "date") {
    const match = value.match(/\b(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
    return match?.[0] ?? null;
  }
  if (type === "currency" || type === "number") {
    const match = value.match(/(?:\(|-)?\$?\s*[\d,]+(?:\.\d+)?%?\)?/);
    if (!match?.[0]) return null;
    const token = match[0];
    const accounting = /^\(.*\)$/.test(token.trim());
    const parsed = Number(token.replace(/[()$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed * (accounting ? -1 : 1) : null;
  }
  if (value.length > 160) return null;
  return value;
}

function pageLines(text: string) {
  const pages = new Map<number, string[]>();
  let page = 1;
  for (const sourceLine of text.split(/\r?\n/)) {
    const marker = /^\s*(?:page|pg\.?)\s+(\d{1,3})\b/i.exec(sourceLine);
    if (marker?.[1]) page = Number(marker[1]);
    const values = pages.get(page) ?? [];
    values.push(sourceLine);
    pages.set(page, values);
  }
  return pages;
}

function labelsOnLine(lower: string) {
  const matches: Array<{ scalar: Scalar; start: number; end: number }> = [];
  for (const scalar of WORKSHEET_SCALARS) {
    const [, label] = scalar;
    let cursor = 0;
    while (cursor < lower.length) {
      const start = lower.indexOf(label, cursor);
      if (start < 0) break;
      matches.push({ scalar, start, end: start + label.length });
      cursor = start + 1;
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  // When labels overlap at the same printed position, only the longest exact
  // label is allowed (e.g. "Qualifying Income Limit Percent" before its prefix).
  return matches.filter((match, index) => !matches.slice(0, index).some((prior) => prior.start === match.start && prior.end >= match.end));
}

/**
 * Safe text fallback for recognized Annual Income Calculation Worksheet pages.
 * It only accepts a value on the SAME OCR/native-text line as an exact printed
 * worksheet label. Spatial/direct-cell evidence remains preferred by the caller.
 * Blank cells and values on another line are never inferred.
 */
export function extractSupplementalTextCandidates(text: string): SupplementalTextCandidate[] {
  const candidates: SupplementalTextCandidate[] = [];
  for (const [page, lines] of pageLines(text)) {
    const pageText = lines.join("\n");
    if (supplementalPageKind(pageText) !== "worksheet") continue;
    for (const line of lines) {
      const labels = labelsOnLine(line.toLowerCase());
      for (let index = 0; index < labels.length; index += 1) {
        const match = labels[index]!;
        const [key, , type] = match.scalar;
        const next = labels.find((candidate, candidateIndex) => candidateIndex > index && candidate.start >= match.end);
        const raw = line.slice(match.end, next?.start ?? line.length);
        const value = normalize(type, raw);
        if (value === null) continue;
        candidates.push({ key, value, page, line });
      }
    }
  }
  return candidates;
}

export function supplementalTextFacts(
  text: string,
  documentRef: string,
  pageProvenance?: Map<number, PageProvenance>,
): ExtractedFact[] {
  const byKey = new Map<string, SupplementalTextCandidate[]>();
  for (const candidate of extractSupplementalTextCandidates(text)) {
    const values = byKey.get(candidate.key) ?? [];
    values.push(candidate);
    byKey.set(candidate.key, values);
  }
  const facts: ExtractedFact[] = [];
  for (const [key, candidates] of byKey) {
    const distinct = new Set(candidates.map((candidate) => JSON.stringify(candidate.value)));
    if (distinct.size !== 1) continue;
    const candidate = candidates[0]!;
    const provenance = pageProvenance?.get(candidate.page);
    facts.push({
      field: key,
      value: candidate.value,
      sourceDocumentRef: documentRef,
      page: candidate.page,
      snippet: candidate.line.trim().slice(0, 300),
      confidence: Math.min(provenance?.confidence ?? 0.9, 0.9),
      humanVerified: false,
      requiredForDecision: false,
      provider: provenance?.provider ?? "deterministic-text",
    });
  }
  return facts;
}
