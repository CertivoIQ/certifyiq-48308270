declare module '@/lib/ocr-sidecar.mjs' {
  export const OCR_SIDECAR_VERSION: '2.0';
  export const OCR_SIDECAR_SUFFIX: string;
  export const OCR_PROVIDER: 'ocr-tesseract';
  export const TEXT_PROVIDER: 'deterministic-text';
  export const OCR_ENGINE: 'tesseract.js:eng';
  export const PAGE_TEXT_MIN_CHARS: number;
  export const MAX_PDF_PAGES: number;
  export const MAX_OCR_PAGES: number;
  export const OCR_TIME_BUDGET_MS: number;
  export const MAX_UPLOAD_BYTES: number;
  export const OCR_LIMIT_MESSAGE: string;

  export type OcrPageSource = 'text' | 'ocr';

  export interface OcrSidecarPage {
    page: number;
    source: OcrPageSource;
    engine: string | null;
    ocrConfidence: number | null;
    text: string;
  }

  export interface OcrSidecar {
    schemaVersion: '2.0';
    sourceFileName: string;
    sourceSha256: string;
    sourceByteSize: number;
    createdAt: string;
    pageCount: number;
    truncated: false;
    pages: OcrSidecarPage[];
  }

  export interface SidecarSourceIdentity {
    schemaVersion: '2.0';
    sourceFileName: string;
    sourceSha256: string;
    sourceByteSize: number;
    pageCount: number;
  }

  export interface ExpectedSidecarSource {
    fileName: string;
    sha256: string;
    byteSize: number;
  }

  export interface ComposedSidecar {
    text: string;
    pages: OcrSidecarPage[];
    ocrPageCount: number;
    textPageCount: number;
    skippedPageCount: number;
    provider: 'ocr-tesseract' | 'deterministic-text';
    truncated: false;
    sourceIdentity: SidecarSourceIdentity;
  }

  export interface PageProvenance {
    source: OcrPageSource;
    provider: 'ocr-tesseract' | 'deterministic-text';
    engine: string | null;
    confidence: number;
  }

  export function sidecarPathFor(storagePath: string): string;
  export function normalizePageText(text: unknown): string;
  export function pageNeedsOcr(text: unknown): boolean;
  export function validateSidecarSource(
    sidecar: unknown,
    expectedSource?: ExpectedSidecarSource,
  ): SidecarSourceIdentity;
  export function composeSidecarText(
    sidecar: unknown,
    expectedSource?: ExpectedSidecarSource,
  ): ComposedSidecar;
  export function provenanceIndex(
    pages: readonly OcrSidecarPage[],
  ): Map<number, PageProvenance>;
}
