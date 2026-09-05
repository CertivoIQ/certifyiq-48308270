import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";
import type { PageProvenance } from "@/lib/ocr-sidecar.mjs";
import {
  TIC_FIELD_DEFINITIONS,
  TIC_FIELD_KEYS,
  type TicFieldDefinition,
} from "@/lib/tic-field-registry";

export type TicExtractionResult = {
  provider: "deterministic-text" | "ocr-tesseract";
  facts: ExtractedFact[];
  missingFields: string[];
};

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
  const numeric = cleaned.match(/\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:\d{2}|\d{4})\b/);
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
  const cleaned = boundedTail(raw);
  if (!cleaned) return null;
  if (cleaned.length > 160) return null;
  if (/^(?:page|part)\b/i.test(cleaned)) return null;
  if ((cleaned.match(/:/g) ?? []).length > 1) return null;
  if (/^(?:yes|no)\s+(?:yes|no)$/i.test(cleaned)) return null;
  return cleaned.slice(0, 500);
}

function normalizeValue(definition: TicFieldDefinition, raw: string): string | number | null {
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
  const text = lines.join(" ");
  const marked = [
    ["Initial Certification", /(?:☒|✓|\bx\b)\s*initial certification|initial certification\s*(?:☒|✓|\bx\b)/i],
    ["Recertification", /(?:☒|✓|\bx\b)\s*recertification|recertification\s*(?:☒|✓|\bx\b)/i],
    ["Other", /(?:☒|✓|\bx\b)\s*other\b|\bother\b\s*(?:☒|✓|\bx\b)/i],
  ] as const;
  return marked.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/**
 * Parse the TIC registry from OCR/native text. Extraction is only a proposal.
 * Blank form lines stay blank; nearby labels are never promoted into field data.
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

  const facts: ExtractedFact[] = [];
  const found = new Set<string>();

  const explicitCertificationType = certificationTypeFact(lines);
  if (explicitCertificationType) {
    const definition = TIC_FIELD_DEFINITIONS.find((entry) => entry.key === "certification_type")!;
    const index = lines.findIndex((line) => line.toLowerCase().includes(explicitCertificationType.toLowerCase()));
    const page = index >= 0 ? pageOfLine[index] ?? 1 : 1;
    const provenance = pageProvenance?.get(page);
    facts.push({
      field: definition.key,
      value: explicitCertificationType,
      sourceDocumentRef: documentRef,
      page,
      snippet: index >= 0 ? lines[index]!.trim().slice(0, 300) : explicitCertificationType,
      confidence: provenance?.confidence ?? 0.99,
      humanVerified: false,
      requiredForDecision: false,
      provider: provenance?.provider ?? "deterministic-text",
    });
    found.add(definition.key);
  }

  for (const definition of TIC_FIELD_DEFINITIONS) {
    if (found.has(definition.key) || !definition.aliases.length) continue;
    let extracted: ExtractedFact | null = null;
    for (let index = 0; index < lines.length && !extracted; index += 1) {
      const line = lines[index] ?? "";
      const lower = line.toLowerCase();
      for (const alias of definition.aliases) {
        if (!lower.includes(alias.toLowerCase())) continue;
        let raw = lineTailAfterAlias(line, alias);
        let value = normalizeValue(definition, raw);
        if (value === null && !raw.trim()) {
          raw = nextCandidateLine(lines, index);
          value = normalizeValue(definition, raw);
        }
        if (value === null) continue;
        const page = pageOfLine[index] ?? 1;
        const provenance = pageProvenance?.get(page);
        extracted = {
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
        break;
      }
    }
    if (extracted) {
      facts.push(extracted);
      found.add(definition.key);
    }
  }

  const missingFields = TIC_FIELD_KEYS.filter((key) => !found.has(key));
  const provider = facts.some((fact) => fact.provider === "ocr-tesseract")
    ? "ocr-tesseract"
    : "deterministic-text";
  return { provider, facts, missingFields };
}
