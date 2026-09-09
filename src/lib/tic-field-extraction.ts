import { findTicLabels } from "@/lib/tic-label-matching.mjs";
import { supplementalPageKind } from "@/lib/tic-supplemental-fields";
import { supplementalTextFacts } from "@/lib/tic-supplemental-text-extraction";
// TIC_CELL_REPAIR_V1
import { selectedCertificationType, strictMappedValue } from "@/lib/tic-document-layout.mjs";
import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";
import type { PageProvenance } from "@/lib/ocr-sidecar.mjs";
import {
  TIC_FIELD_BY_KEY,
  TIC_FIELD_DEFINITIONS,
  TIC_FIELD_KEYS,
  type TicFieldDefinition,
} from "@/lib/tic-field-registry";

export type TicExtractionResult = {
  provider: "deterministic-text" | "ocr-tesseract";
  facts: ExtractedFact[];
  missingFields: string[];
};

export const DIRECT_TIC_FIELD_PREFIX = "__CERTIVOIQ_TIC_FIELD__";

const FORM_BOUNDARIES = [
  "effective date", "move-in date", "move in date", "current date", "initial certification", "recertification",
  "property name", "county", "tc#", "tc #", "bin#", "bin #", "address", "unit number", "# bedrooms",
  "part i", "part ii", "part iii", "part iv", "part v", "part vi", "part vii", "part viii", "part ix",
  "household composition", "gross annual income", "income from assets", "total household income",
  "determination of income eligibility", "tenant paid rent", "rental assistance type", "rent assistance",
  "utility allowance", "other non-optional charges", "gross rent for unit", "unit meets rent restriction at",
  "maximum rent limit", "are all occupants full-time students", "student explanation", "program type",
  "signature of owner", "signature date", "total income", "total of nnpp", "total income from assets",
] as const;

function stripBlankArtifacts(raw: string) {
  return raw
    .replace(/[\uF000-\uF8FF]/g, " ")
    .replace(/[☐□▢◻◽]/g, " ")
    .replace(/_{2,}/g, " ")
    .replace(/\.{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function earliestBoundaryIndex(raw: string) {
  const lower = raw.toLowerCase();
  let earliest = -1;
  for (const boundary of FORM_BOUNDARIES) {
    const index = lower.indexOf(boundary);
    if (index >= 0 && (earliest < 0 || index < earliest)) earliest = index;
  }
  return earliest;
}

function boundedTail(raw: string) {
  const cleaned = stripBlankArtifacts(raw.replace(/^[:=\-–—\s]+/, ""));
  if (!cleaned) return "";
  const boundary = earliestBoundaryIndex(cleaned);
  return stripBlankArtifacts(boundary >= 0 ? cleaned.slice(0, boundary) : cleaned);
}

function normalizeNumeric(raw: string) {
  const cleaned = boundedTail(raw);
  if (!cleaned || (/[A-Za-z]{3,}/.test(cleaned) && cleaned.length > 40)) return null;
  const match = cleaned.match(/-?\$?\s*[\d,]+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0].replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(raw: string) {
  const cleaned = boundedTail(raw);
  if (!cleaned) return null;
  const numeric = cleaned.match(/\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:\d{2}|\d{4})\b/);
  if (numeric?.[0]) return numeric[0];
  const iso = cleaned.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso?.[0]) return iso[0];
  const written = cleaned.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/i);
  return written?.[0] ?? null;
}

function normalizeYesNo(raw: string) {
  const cleaned = stripBlankArtifacts(raw);
  if (!cleaned) return null;
  const yesMarked = /(?:☒|✓|\bx\b)\s*yes\b/i.test(raw) || /\byes\b\s*(?:☒|✓|\bx\b)/i.test(raw);
  const noMarked = /(?:☒|✓|\bx\b)\s*no\b/i.test(raw) || /\bno\b\s*(?:☒|✓|\bx\b)/i.test(raw);
  if (yesMarked && !noMarked) return "Yes";
  if (noMarked && !yesMarked) return "No";
  if (/^(?:yes|y|true)$/i.test(cleaned)) return "Yes";
  if (/^(?:no|n|false)$/i.test(cleaned)) return "No";
  return null;
}

function normalizeText(raw: string) {
  // Printed label spans already bound the value; words inside a name are data.
  const cleaned = stripBlankArtifacts(raw.replace(/^[:=\-–—\s]+/, ""));
  if (!cleaned) return null;
  if (cleaned.length > 160) return null;
  if (/^(?:page|part)\b/i.test(cleaned)) return null;
  if ((cleaned.match(/:/g) ?? []).length > 1) return null;
  if (/^(?:yes|no)\s+(?:yes|no)$/i.test(cleaned)) return null;
  return cleaned.slice(0, 500);
}

function normalizeValue(definition: TicFieldDefinition, raw: string): string | number | null {
  if (definition.key === 'household_income_restriction_percent' || definition.key === 'unit_rent_restriction_percent') {
    const choices = [...raw.matchAll(/\b(\d{1,3})\s*%/g)];
    if (choices.length > 1) {
      const marked = [...raw.matchAll(/(?:☒|✓|✔|\[x\])\s*(\d{1,3})\s*%/gi)];
      return marked.length === 1 ? Number(marked[0]![1]) : null;
    }
  }
  if (definition.type === "date") return normalizeDate(raw);
  if (definition.type === "currency" || definition.type === "number") return normalizeNumeric(raw);
  if (definition.type === "yes_no") return normalizeYesNo(raw);
  return normalizeText(raw);
}

function lineTailAfterAlias(line: string, alias: string) {
  const lower = line.toLowerCase();
  const start = lower.indexOf(alias.toLowerCase());
  if (start < 0) return "";
  return line.slice(start + alias.length).replace(/^\s*[:=\-–—]?\s*/, "");
}

function looksLikeAnotherFieldLabel(candidate: string) {
  const cleaned = stripBlankArtifacts(candidate).toLowerCase();
  if (!cleaned) return true;
  if (/^(?:page|part)\b/.test(cleaned)) return true;
  return FORM_BOUNDARIES.some((boundary) => cleaned.startsWith(boundary));
}

function nextCandidateLine(lines: string[], start: number) {
  for (let offset = 1; offset <= 2; offset += 1) {
    const candidate = (lines[start + offset] ?? "").trim();
    if (!candidate || /^\s*(?:page|pg\.?)\s+\d+/i.test(candidate)) continue;
    if (looksLikeAnotherFieldLabel(candidate)) continue;
    return candidate;
  }
  return "";
}

function certificationTypeFact(lines: string[]) {
  return selectedCertificationType(lines.join("\n"));
}

function factFromValue(
  definition: TicFieldDefinition,
  value: string | number,
  documentRef: string,
  line: string,
  page: number,
  provenance?: PageProvenance,
): ExtractedFact {
  return {
    field: definition.key,
    value,
    sourceDocumentRef: documentRef,
    page,
    snippet: line.trim().slice(0, 300),
    confidence: provenance?.confidence ?? 0.99,
    humanVerified: false,
    requiredForDecision: false,
    provider: provenance?.provider ?? "deterministic-text",
  };
}

/**
 * Parse the TIC registry from OCR/native text. Extraction is only a proposal.
 * Exact source-field mappings emitted by the native/spatial readers always win
 * over loose OCR aliases. Blank form lines stay blank and neighboring labels
 * are never promoted into field data. On strict-cell pages, a direct same-line
 * label/value fallback remains allowed for fields the spatial reader did not emit;
 * next-line inference stays disabled so strict evidence boundaries are preserved.
 */
export function extractTicFieldsFromText(
  text: string,
  documentRef: string,
  pageProvenance?: Map<number, PageProvenance>,
): TicExtractionResult {
  const lines = text.split(/\r?\n/);
  let currentPage = 1;
  const pageOfLine = lines.map((line) => {
    const marker = /^\s*(?:page|pg\.?)\s+(\d{1,3})\b/i.exec(line);
    if (marker?.[1]) currentPage = Number(marker[1]);
    return currentPage;
  });

  const supplementalPages = new Set<number>();
  for (const page of new Set(pageOfLine)) {
    if (supplementalPageKind(lines.filter((_, i) => pageOfLine[i] === page).join("\n"))) supplementalPages.add(page);
  }
  const strictCellPages = new Set(lines.flatMap((line, i) => line === "__CERTIVOIQ_TIC_CELL_MODE__: strict" ? [pageOfLine[i]] : []));
  const facts: ExtractedFact[] = [];
  const found = new Set<string>();
  const directCandidates = new Map<string, Set<string>>();
  const conflictingDirectFields = new Set<string>();
  const cellMetadata = new Map<string, { confidence: number; coordinates: string; method: string }>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const blocked = /^__CERTIVOIQ_TIC_UNRESOLVED__\s+([a-z0-9_]+):/.exec(line);
    if (blocked?.[1] && TIC_FIELD_BY_KEY.has(blocked[1])) conflictingDirectFields.add(blocked[1]);
    const meta = /^__CERTIVOIQ_TIC_CELL__\s+([a-z0-9_]+):\s*(.{1,1000})$/.exec(line);
    if (!meta?.[1] || !meta[2] || !TIC_FIELD_BY_KEY.has(meta[1])) continue;
    try {
      const value = JSON.parse(meta[2]);
      const b = value.bbox;
      if (!b || ![b.x0,b.y0,b.x1,b.y1,value.confidence].every(Number.isFinite) ||
          b.x0 < 0 || b.y0 < 0 || b.x1 <= b.x0 || b.y1 <= b.y0 || b.x1 > 20000 || b.y1 > 20000 ||
          value.confidence < 0 || value.confidence > 1 || !['isolated-cell','bounded-page-word','checkbox-interior'].includes(value.method)) continue;
      cellMetadata.set(`${pageOfLine[index]}:${meta[1]}`, { confidence:value.confidence, coordinates:`${b.x0},${b.y0},${b.x1},${b.y1}`, method:value.method });
    } catch { /* Malformed metadata never verifies a value. */ }
  }
  for (const line of lines) {
    const match = /^__CERTIVOIQ_TIC_FIELD__\s+([a-z0-9_]+)\s*:\s*(.*)$/i.exec(line.trim());
    if (!match) continue;
    const definition = TIC_FIELD_BY_KEY.get(match[1]!);
    if (!definition) continue;
    const value = strictMappedValue(definition.type, match[2], definition.key);
    if (value === null) { conflictingDirectFields.add(definition.key); continue; }
    const values = directCandidates.get(definition.key) ?? new Set<string>();
    values.add(JSON.stringify(value));
    directCandidates.set(definition.key, values);
    if (values.size > 1) conflictingDirectFields.add(definition.key);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const direct = new RegExp(`^${DIRECT_TIC_FIELD_PREFIX}\\s+([a-z0-9_]+)\\s*:\\s*(.*)$`, "i").exec(line.trim());
    if (!direct?.[1] || found.has(direct[1]) || conflictingDirectFields.has(direct[1])) continue;
    const definition = TIC_FIELD_BY_KEY.get(direct[1]);
    if (!definition) continue;
    const value = strictMappedValue(definition.type, direct[2] ?? "", definition.key);
    if (value === null) continue;
    const page = pageOfLine[index] ?? 1;
    facts.push(factFromValue(definition, value, documentRef, line, page, pageProvenance?.get(page)));
    found.add(definition.key);
  }

  if (!found.has("certification_type") && !conflictingDirectFields.has("certification_type")) {
    const explicitCertificationType = certificationTypeFact(lines);
    if (explicitCertificationType) {
      const definition = TIC_FIELD_BY_KEY.get("certification_type")!;
      const index = lines.findIndex((line) => line.toLowerCase().includes(explicitCertificationType.toLowerCase()));
      const page = index >= 0 ? pageOfLine[index] ?? 1 : 1;
      facts.push(factFromValue(
        definition,
        explicitCertificationType,
        documentRef,
        index >= 0 ? lines[index]! : explicitCertificationType,
        page,
        pageProvenance?.get(page),
      ));
      found.add(definition.key);
    }
  }

  // Recognized supplemental worksheet pages get a conservative same-line text
  // fallback for scalar cells the spatial reader did not emit. Direct/spatial
  // facts and unresolved/conflicting markers always win. A strict cell page uses
  // only its image-backed proposals, including when a worksheet number was withheld.
  for (const supplementalFact of supplementalTextFacts(text, documentRef, pageProvenance)) {
    if (strictCellPages.has(supplementalFact.page) || found.has(supplementalFact.field) || conflictingDirectFields.has(supplementalFact.field)) continue;
    facts.push(supplementalFact);
    found.add(supplementalFact.field);
  }

  const labelDefinitions = TIC_FIELD_DEFINITIONS.filter(definition =>
    !definition.key.startsWith('worksheet_') && !definition.key.startsWith('application_') &&
    !definition.key.startsWith('source_present_') && definition.aliases.length);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const page = pageOfLine[index] ?? 1;
    if (line.startsWith("__CERTIVOIQ_") || supplementalPages.has(page) || strictCellPages.has(page)) continue;
    const labels = findTicLabels(line, labelDefinitions);
    for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
      const hit = labels[labelIndex]!;
      if (hit.ambiguous || found.has(hit.key) || conflictingDirectFields.has(hit.key) || hit.key === "certification_type") continue;
      const definition = TIC_FIELD_BY_KEY.get(hit.key)!;
      const next = labels.find((candidate, i) => i > labelIndex && candidate.start >= hit.end);
      let raw = line.slice(hit.end, next?.start ?? line.length).replace(/^\s*[:=\-–—]?\s*/, "");
      let value = normalizeValue(definition, raw);
      if (value === null && !raw.trim() && !next && !strictCellPages.has(page)) {
        raw = nextCandidateLine(lines, index);
        value = normalizeValue(definition, raw);
      }
      if (value === null) continue;
      facts.push(factFromValue(definition, value, documentRef, line, page, pageProvenance?.get(page)));
      found.add(definition.key);
    }
  }

  for (const fact of facts) {
    const cell = cellMetadata.get(`${fact.page}:${fact.field}`);
    if (!cell) continue;
    fact.confidence = Math.min(fact.confidence, cell.confidence);
    fact.snippet = `Source cell [${cell.coordinates}] (${cell.method}); ${fact.snippet ?? ''}`.slice(0, 300);
  }
  const missingFields = TIC_FIELD_KEYS.filter((key) => !found.has(key));
  const provider = facts.some((fact) => fact.provider === "ocr-tesseract")
    ? "ocr-tesseract"
    : "deterministic-text";
  return { provider, facts, missingFields };
}
