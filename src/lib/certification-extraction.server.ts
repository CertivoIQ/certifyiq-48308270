import { generateText } from "ai";
import pdfParse from "pdf-parse";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";

/**
 * Extraction provider boundary — server only.
 *
 * Extraction proposes facts with a citation (document ref, page, snippet) and a
 * confidence. It never decides compliance; the deterministic rule engine does.
 * Providers:
 *  - `deterministic-text`: parses labelled values out of text/CSV exports and
 *    machine-readable PDFs. Fully reproducible, used for tests and fixtures.
 *  - `lovable-ai`: Lovable AI Gateway extraction for extracted document text,
 *    verified against the source text so a hallucinated value cannot become a fact.
 */

export type ExtractionProviderName = "deterministic-text" | "lovable-ai";

export const EXTRACTION_FIELDS = [
  "tenant_signature_date",
  "certification_effective_date",
  "household_annual_income",
  "income_limit_60_pct",
  "household_net_assets",
  "hotma_asset_cap",
  "gross_rent",
  "state_max_gross_rent",
  "utility_allowance_source",
] as const;

export type ExtractionField = (typeof EXTRACTION_FIELDS)[number];

const FIELD_LABELS: Record<ExtractionField, string[]> = {
  tenant_signature_date: ["tenant signature date", "signature date", "signed on"],
  certification_effective_date: ["certification effective date", "effective date"],
  household_annual_income: ["household annual income", "annual income", "total household income"],
  income_limit_60_pct: ["60% income limit", "income limit 60", "applicable income limit"],
  household_net_assets: ["household net assets", "net family assets", "net assets"],
  hotma_asset_cap: ["hotma asset cap", "asset cap"],
  gross_rent: ["gross rent"],
  state_max_gross_rent: ["state maximum gross rent", "max gross rent", "state max gross rent"],
  utility_allowance_source: ["utility allowance source", "utility allowance"],
};

const NUMERIC_FIELDS = new Set<ExtractionField>([
  "household_annual_income",
  "income_limit_60_pct",
  "household_net_assets",
  "hotma_asset_cap",
  "gross_rent",
  "state_max_gross_rent",
]);

export type ExtractionResult = {
  provider: ExtractionProviderName;
  facts: ExtractedFact[];
  /** Fields the provider could not find, so the engine can block a guess. */
  missingFields: ExtractionField[];
};

function normalizeValue(field: ExtractionField, raw: string): string | number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!NUMERIC_FIELDS.has(field)) return trimmed;
  const numeric = Number(trimmed.replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

/** Deterministic label parser. Same input always yields the same facts. */
export function extractFactsFromText(text: string, documentRef: string): ExtractionResult {
  const lines = text.split(/\r?\n/);
  const facts: ExtractedFact[] = [];
  const missingFields: ExtractionField[] = [];
  let page = 1;

  const pageOfLine: number[] = lines.map((line) => {
    const marker = /^\s*(?:page|pg\.?)\s+(\d{1,3})\b/i.exec(line);
    if (marker?.[1]) page = Number(marker[1]);
    return page;
  });

  for (const field of EXTRACTION_FIELDS) {
    let found: ExtractedFact | null = null;
    for (let index = 0; index < lines.length && !found; index += 1) {
      const line = lines[index] ?? "";
      const lower = line.toLowerCase();
      for (const label of FIELD_LABELS[field]) {
        if (!lower.includes(label)) continue;
        const separatorIndex = line.indexOf(":", lower.indexOf(label));
        if (separatorIndex === -1) continue;
        const value = normalizeValue(field, line.slice(separatorIndex + 1));
        if (value === null) continue;
        found = {
          field,
          value,
          sourceDocumentRef: documentRef,
          page: pageOfLine[index] ?? 1,
          snippet: line.trim().slice(0, 300),
          confidence: 0.99,
          humanVerified: false,
          requiredForDecision: true,
          provider: "deterministic-text",
        };
        break;
      }
    }
    if (found) facts.push(found);
    else missingFields.push(field);
  }

  return { provider: "deterministic-text", facts, missingFields };
}

/**
 * Extract machine-readable text from a PDF while preserving explicit page
 * markers so evidence citations continue to point to the correct page.
 */
export async function extractTextFromPdf(bytes: ArrayBuffer): Promise<string> {
  const buffer = Buffer.from(bytes);
  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean);
      return `page ${pageData.pageIndex + 1}\n${strings.join(" ")}\n`;
    },
  });

  return parsed.text.trim();
}

/**
 * Normalized document-to-text boundary used by the review server function.
 * PDFs are now first-class inputs. Image-only/scanned PDFs intentionally return
 * an actionable error rather than producing ungrounded compliance facts.
 */
export async function extractDocumentText(
  bytes: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; provider: ExtractionProviderName; documentKind: "pdf" | "text" }> {
  const isPdf = /application\/pdf/i.test(mimeType) || /\.pdf$/i.test(fileName);
  if (isPdf) {
    const text = await extractTextFromPdf(bytes);
    if (!text) {
      throw new Error(
        "This PDF appears to be image-only or scanned and contains no machine-readable text. OCR extraction is required before this certification can be reviewed.",
      );
    }
    return { text, provider: "deterministic-text", documentKind: "pdf" };
  }

  return {
    text: new TextDecoder().decode(bytes),
    provider: "deterministic-text",
    documentKind: "text",
  };
}

/**
 * AI extraction for extracted document text. Every returned value must appear
 * in the source text, otherwise it is discarded rather than trusted.
 */
export async function extractFactsWithAi(
  text: string,
  documentRef: string,
  apiKey: string,
): Promise<ExtractionResult> {
  const provider = createLovableAiGatewayProvider(apiKey);
  const prompt = [
    "Extract the following fields from this affordable-housing certification document.",
    "Return ONLY compact JSON: an array of objects {field, value, page, snippet}.",
    "snippet must be copied verbatim from the document. Omit fields you cannot find.",
    `fields: ${EXTRACTION_FIELDS.join(", ")}`,
    "---",
    text.slice(0, 12000),
  ].join("\n");

  const { text: raw } = await generateText({
    model: provider.chatModel("google/gemini-3.6-flash"),
    prompt,
    maxOutputTokens: 1200,
  });

  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]");
  let parsed: Array<{ field?: string; value?: unknown; page?: number; snippet?: string }> = [];
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as typeof parsed;
    } catch {
      parsed = [];
    }
  }

  const haystack = text.toLowerCase();
  const facts: ExtractedFact[] = [];
  for (const candidate of parsed) {
    const field = candidate.field as ExtractionField | undefined;
    if (!field || !EXTRACTION_FIELDS.includes(field)) continue;
    const value = normalizeValue(field, String(candidate.value ?? ""));
    if (value === null) continue;
    const snippet = typeof candidate.snippet === "string" ? candidate.snippet.trim() : "";
    if (!snippet || !haystack.includes(snippet.toLowerCase().slice(0, 40))) continue;
    facts.push({
      field,
      value,
      sourceDocumentRef: documentRef,
      page: Number.isFinite(candidate.page) ? Number(candidate.page) : 1,
      snippet: snippet.slice(0, 300),
      confidence: 0.9,
      humanVerified: false,
      requiredForDecision: true,
      provider: "lovable-ai",
    });
  }

  const seen = new Set(facts.map((fact) => fact.field));
  return {
    provider: "lovable-ai",
    facts,
    missingFields: EXTRACTION_FIELDS.filter((field) => !seen.has(field)),
  };
}

const TEXT_MIME = /^(text\/|application\/(json|csv))/i;

export function isTextExtractable(mimeType: string, fileName: string): boolean {
  return TEXT_MIME.test(mimeType) || /\.(txt|csv|json|md|pdf)$/i.test(fileName) || /application\/pdf/i.test(mimeType);
}
