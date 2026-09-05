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

function normalizeNumeric(raw: string) {
  const match = raw.match(/-?\$?\s*[\d,]+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0].replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeYesNo(raw: string) {
  const value = raw.trim().toLowerCase();
  if (/^(?:yes|y|true|checked|x|☒|✓)\b/.test(value)) return "Yes";
  if (/^(?:no|n|false)\b/.test(value)) return "No";
  const yesMarked = /(?:☒|✓|\bx\b)\s*yes\b/i.test(raw) || /\byes\b\s*(?:☒|✓|\bx\b)/i.test(raw);
  const noMarked = /(?:☒|✓|\bx\b)\s*no\b/i.test(raw) || /\bno\b\s*(?:☒|✓|\bx\b)/i.test(raw);
  if (yesMarked && !noMarked) return "Yes";
  if (noMarked && !yesMarked) return "No";
  return raw.trim() || null;
}

function normalizeValue(definition: TicFieldDefinition, raw: string): string | number | null {
  const trimmed = raw.trim().replace(/^[:=\-–—\s]+/, "").trim();
  if (!trimmed) return null;
  if (definition.type === "currency" || definition.type === "number") return normalizeNumeric(trimmed);
  if (definition.type === "yes_no") return normalizeYesNo(trimmed);
  return trimmed.slice(0, 500);
}

function lineTailAfterAlias(line: string, alias: string) {
  const lower = line.toLowerCase();
  const start = lower.indexOf(alias);
  if (start < 0) return "";
  return line.slice(start + alias.length).replace(/^\s*[:=\-–—]?\s*/, "");
}

function nextCandidateLine(lines: string[], start: number) {
  for (let offset = 1; offset <= 2; offset += 1) {
    const candidate = (lines[start + offset] ?? "").trim();
    if (!candidate || /^\s*(?:page|pg\.?)\s+\d+/i.test(candidate)) continue;
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
 * Parse the comprehensive TIC registry from OCR/native text. Extraction is only
 * a proposal: missing values remain blank for pre-save review and correction.
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
        let raw = lineTailAfterAlias(line, alias.toLowerCase());
        if (!raw.trim()) raw = nextCandidateLine(lines, index);
        const value = normalizeValue(definition, raw);
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
