import { inflateSync } from "node:zlib";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { ExtractedFact } from "@/lib/compliance-rule-engine.mjs";
import {
  composeSidecarText,
  provenanceIndex,
  sidecarPathFor,
  type OcrSidecar,
  type PageProvenance,
} from "@/lib/ocr-sidecar.mjs";

export { sidecarPathFor };
export type { PageProvenance };


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

export type ExtractionProviderName = "deterministic-text" | "lovable-ai" | "ocr-tesseract";

export const EXTRACTION_FIELDS = [
  "tenant_signature_date",
  "certification_effective_date",
  "household_annual_income",
  "applicable_lihtc_income_limit",
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
  applicable_lihtc_income_limit: ["applicable lihtc income limit", "applicable income limit", "60% income limit", "50% income limit"],
  household_net_assets: ["household net assets", "net family assets", "net assets"],
  hotma_asset_cap: ["hotma asset cap", "asset cap"],
  gross_rent: ["gross rent"],
  state_max_gross_rent: ["state maximum gross rent", "max gross rent", "state max gross rent"],
  utility_allowance_source: ["utility allowance source", "utility allowance"],
};

const NUMERIC_FIELDS = new Set<ExtractionField>([
  "household_annual_income",
  "applicable_lihtc_income_limit",
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

/**
 * Deterministic label parser. Same input always yields the same facts.
 *
 * `pageProvenance` is supplied when the text came from an OCR sidecar: each fact
 * is then stamped with the provider ("ocr-tesseract") and the confidence the OCR
 * engine actually reported for that page, so the audit trail records that the
 * evidence was OCR-derived.
 */
export function extractFactsFromText(
  text: string,
  documentRef: string,
  pageProvenance?: Map<number, PageProvenance>,
): ExtractionResult {
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
        const factPage = pageOfLine[index] ?? 1;
        const provenance = pageProvenance?.get(factPage);
        found = {
          field,
          value,
          sourceDocumentRef: documentRef,
          page: factPage,
          snippet: line.trim().slice(0, 300),
          confidence: provenance ? provenance.confidence : 0.99,
          humanVerified: false,
          requiredForDecision: true,
          provider: provenance?.provider ?? "deterministic-text",
        };
        break;
      }
    }
    if (found) facts.push(found);
    else missingFields.push(field);
  }

  const ocrDerived = facts.some((fact) => fact.provider === "ocr-tesseract");
  return { provider: ocrDerived ? "ocr-tesseract" : "deterministic-text", facts, missingFields };
}


function decodePdfString(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const codeUnits: number[] = [];
    for (let i = 2; i + 1 < bytes.length; i += 2) codeUnits.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
    return String.fromCharCode(...codeUnits);
  }
  return new TextDecoder("windows-1252").decode(bytes);
}

function decodeLiteralPdfString(source: string): string {
  const out: number[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char !== "\\") {
      out.push(source.charCodeAt(i) & 0xff);
      continue;
    }
    const next = source[++i] ?? "";
    const escapes: Record<string, number> = {
      n: 10,
      r: 13,
      t: 9,
      b: 8,
      f: 12,
      "(": 40,
      ")": 41,
      "\\": 92,
    };
    if (next in escapes) {
      out.push(escapes[next]!);
      continue;
    }
    if (/^[0-7]$/.test(next)) {
      let octal = next;
      for (let count = 0; count < 2 && /^[0-7]$/.test(source[i + 1] ?? ""); count += 1) octal += source[++i];
      out.push(parseInt(octal, 8));
      continue;
    }
    out.push(next.charCodeAt(0) & 0xff);
  }
  return decodePdfString(new Uint8Array(out));
}

function readPdfLiteralString(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== "(") return null;
  let depth = 1;
  let escaped = false;
  let end = start + 1;
  for (; end < source.length; end += 1) {
    const char = source[end]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  return { value: decodeLiteralPdfString(source.slice(start + 1, end)), end: end + 1 };
}

function readPdfHexString(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== "<" || source[start + 1] === "<") return null;
  const end = source.indexOf(">", start + 1);
  if (end === -1) return null;
  const hex = source.slice(start + 1, end).replace(/\s/g, "");
  const padded = hex.length % 2 ? `${hex}0` : hex;
  const bytes = new Uint8Array(Math.floor(padded.length / 2));
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16) || 0;
  return { value: decodePdfString(bytes), end: end + 1 };
}

function extractTextOperators(stream: Uint8Array): string {
  const source = new TextDecoder("windows-1252").decode(stream);
  let output = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "(") {
      const token = readPdfLiteralString(source, i);
      if (!token) break;
      let cursor = token.end;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      if (source.slice(cursor, cursor + 2) === "Tj") {
        output += `${token.value} `;
        i = cursor + 2;
        continue;
      }
      i = token.end;
      continue;
    }
    if (char === "<" && source[i + 1] !== "<") {
      const token = readPdfHexString(source, i);
      if (!token) break;
      let cursor = token.end;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      if (source.slice(cursor, cursor + 2) === "Tj") {
        output += `${token.value} `;
        i = cursor + 2;
        continue;
      }
      i = token.end;
      continue;
    }
    if (char === "[") {
      let cursor = i + 1;
      const parts: string[] = [];
      while (cursor < source.length && source[cursor] !== "]") {
        while (/\s/.test(source[cursor] ?? "")) cursor += 1;
        if (source[cursor] === "(") {
          const token = readPdfLiteralString(source, cursor);
          if (!token) break;
          parts.push(token.value);
          cursor = token.end;
        } else if (source[cursor] === "<" && source[cursor + 1] !== "<") {
          const token = readPdfHexString(source, cursor);
          if (!token) break;
          parts.push(token.value);
          cursor = token.end;
        } else {
          cursor += 1;
        }
      }
      cursor += 1;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      if (source.slice(cursor, cursor + 2) === "TJ") output += `${parts.join("")} `;
      i = cursor + 2;
      continue;
    }
    i += 1;
  }
  return output.replace(/[ \t]+/g, " ").trim();
}

function extractPdfStreams(bytes: ArrayBuffer): Uint8Array[] {
  const source = Buffer.from(bytes);
  const streams: Uint8Array[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const streamIndex = source.indexOf(Buffer.from("stream"), cursor);
    if (streamIndex === -1) break;
    const objectStart = source.lastIndexOf(Buffer.from("obj"), streamIndex);
    const dictionaryStart = objectStart === -1 ? Math.max(0, streamIndex - 2000) : objectStart;
    const dictionary = source.subarray(dictionaryStart, streamIndex).toString("latin1");
    let dataStart = streamIndex + 6;
    if (source[dataStart] === 13 && source[dataStart + 1] === 10) dataStart += 2;
    else if (source[dataStart] === 10 || source[dataStart] === 13) dataStart += 1;
    const endStream = source.indexOf(Buffer.from("endstream"), dataStart);
    if (endStream === -1) break;
    let data = source.subarray(dataStart, endStream);
    try {
      if (/\/FlateDecode\b/.test(dictionary)) data = inflateSync(data);
      streams.push(new Uint8Array(data));
    } catch {
      // Ignore malformed/non-text streams and continue with other page streams.
    }
    cursor = endStream + 9;
  }
  return streams;
}

/**
 * Dependency-free PDF text extraction. It handles the common machine-readable
 * PDF case (including Flate-compressed content streams) without changing the
 * production lockfile or consuming Lovable build credits.
 */
export async function extractTextFromPdf(bytes: ArrayBuffer): Promise<string> {
  const streams = extractPdfStreams(bytes);
  const pages = streams
    .map((stream, index) => {
      const text = extractTextOperators(stream);
      return text ? `page ${index + 1}\n${text}` : "";
    })
    .filter(Boolean);
  return pages.join("\n").trim();
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

export type OcrDocument = {
  text: string;
  provider: ExtractionProviderName;
  documentKind: "pdf-ocr";
  pageProvenance: Map<number, PageProvenance>;
  ocrPageCount: number;
  textPageCount: number;
  skippedPageCount: number;
  ocrEngines: string[];
  sidecarSchemaVersion: string;
  sourceSha256: string;
  sourceByteSize: number;
};

/**
 * Consume the OCR sidecar produced during upload. Page-level provenance is kept
 * so every fact can cite the source PDF, the page number, and the fact that the
 * page text came from OCR. Returns null when the sidecar carries no usable page
 * text, so the caller fails safe instead of producing findings without evidence.
 */
export function loadOcrDocument(
  sidecar: unknown,
  expectedSource: { fileName: string; sha256: string; byteSize: number },
): OcrDocument | null {
  const composed = composeSidecarText(sidecar as OcrSidecar, expectedSource);
  if (!composed.text.trim() || composed.ocrPageCount === 0) return null;
  return {
    text: composed.text,
    provider: "ocr-tesseract",
    documentKind: "pdf-ocr",
    pageProvenance: provenanceIndex(composed.pages),
    ocrPageCount: composed.ocrPageCount,
    textPageCount: composed.textPageCount,
    skippedPageCount: composed.skippedPageCount,
    ocrEngines: [...new Set(composed.pages.map((page) => page.engine).filter((engine): engine is string => !!engine))],
    sidecarSchemaVersion: composed.sourceIdentity.schemaVersion,
    sourceSha256: composed.sourceIdentity.sourceSha256,
    sourceByteSize: composed.sourceIdentity.sourceByteSize,
  };
}
