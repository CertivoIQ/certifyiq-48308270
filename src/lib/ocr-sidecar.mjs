/** Source-bound OCR sidecar contract for certification evidence. */
export const OCR_SIDECAR_VERSION = '2.0';
export const OCR_SIDECAR_SUFFIX = '.certivoiq-ocr.json';
export const OCR_PROVIDER = 'ocr-tesseract';
export const TEXT_PROVIDER = 'deterministic-text';
export const OCR_ENGINE = 'tesseract.js:eng';

export const PAGE_TEXT_MIN_CHARS = 40;
export const MAX_PDF_PAGES = 200;
export const MAX_OCR_PAGES = 50;
export const OCR_TIME_BUDGET_MS = 200_000;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const OCR_LIMIT_MESSAGE =
  'This certification is too large to prepare automatically. Please split it into smaller documents (up to 50 scanned pages each) and upload them again.';

export function sidecarPathFor(storagePath) {
  return `${storagePath}${OCR_SIDECAR_SUFFIX}`;
}

export function normalizePageText(text) {
  return String(text ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function pageNeedsOcr(text) {
  return normalizePageText(text).replace(/\n/g, ' ').trim().length < PAGE_TEXT_MIN_CHARS;
}

function invalid(message) {
  throw new Error(`The OCR sidecar for this certification ${message}`);
}

/**
 * Bind the sidecar to the exact uploaded PDF. Legacy/unbound sidecars are
 * rejected; they can never contribute compliance evidence.
 */
export function validateSidecarSource(sidecar, expectedSource) {
  if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) {
    invalid('is unreadable.');
  }
  if (sidecar.schemaVersion !== OCR_SIDECAR_VERSION) {
    invalid('uses an unsupported or unbound format.');
  }
  if (
    typeof sidecar.sourceFileName !== 'string' ||
    !sidecar.sourceFileName ||
    !SHA256_PATTERN.test(String(sidecar.sourceSha256 ?? '')) ||
    !Number.isSafeInteger(Number(sidecar.sourceByteSize)) ||
    Number(sidecar.sourceByteSize) < 1 ||
    Number(sidecar.sourceByteSize) > MAX_UPLOAD_BYTES ||
    !Number.isInteger(Number(sidecar.pageCount)) ||
    Number(sidecar.pageCount) < 1 ||
    Number(sidecar.pageCount) > MAX_PDF_PAGES ||
    Number.isNaN(Date.parse(String(sidecar.createdAt ?? ''))) ||
    sidecar.truncated !== false
  ) {
    invalid('has incomplete or invalid source identity.');
  }
  if (expectedSource) {
    if (
      sidecar.sourceFileName !== expectedSource.fileName ||
      sidecar.sourceSha256 !== expectedSource.sha256 ||
      Number(sidecar.sourceByteSize) !== Number(expectedSource.byteSize)
    ) {
      invalid('does not match the uploaded certification bytes.');
    }
  }
  return {
    schemaVersion: OCR_SIDECAR_VERSION,
    sourceFileName: sidecar.sourceFileName,
    sourceSha256: sidecar.sourceSha256,
    sourceByteSize: Number(sidecar.sourceByteSize),
    pageCount: Number(sidecar.pageCount),
  };
}

function usablePage(page, pageCount) {
  if (!page || typeof page !== 'object') return null;
  const pageNumber = Number(page.page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) return null;
  const text = normalizePageText(page.text);
  if (!text) return null;
  if (page.source === 'text') {
    return { page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text };
  }
  if (page.source === 'ocr') {
    const confidence = Number(page.ocrConfidence);
    if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) return null;
    if (page.engine !== OCR_ENGINE) return null;
    return { page: pageNumber, source: 'ocr', engine: OCR_ENGINE, ocrConfidence: confidence, text };
  }
  return null;
}

/** Validate, bind, and flatten a sidecar into page-marked text. */
export function composeSidecarText(sidecar, expectedSource) {
  const sourceIdentity = validateSidecarSource(sidecar, expectedSource);
  const rawPages = Array.isArray(sidecar.pages) ? sidecar.pages : [];
  if (rawPages.length > sourceIdentity.pageCount) {
    invalid('contains more page records than the source PDF.');
  }

  const pageNumbers = rawPages.map((page) => Number(page?.page));
  const validNumbers = pageNumbers.filter(Number.isInteger);
  if (new Set(validNumbers).size !== validNumbers.length) {
    invalid('contains duplicate page records.');
  }

  const pages = rawPages
    .map((page) => usablePage(page, sourceIdentity.pageCount))
    .filter(Boolean)
    .sort((a, b) => a.page - b.page);
  const ocrPageCount = pages.filter((page) => page.source === 'ocr').length;
  if (ocrPageCount > MAX_OCR_PAGES) invalid('exceeds the controlled OCR page limit.');

  return {
    text: pages.map((page) => `page ${page.page}\n${page.text}`).join('\n'),
    pages,
    ocrPageCount,
    textPageCount: pages.length - ocrPageCount,
    skippedPageCount: rawPages.length - pages.length,
    provider: ocrPageCount > 0 ? OCR_PROVIDER : TEXT_PROVIDER,
    truncated: false,
    sourceIdentity,
  };
}

export function provenanceIndex(pages) {
  const index = new Map();
  for (const page of pages ?? []) {
    index.set(page.page, {
      source: page.source,
      provider: page.source === 'ocr' ? OCR_PROVIDER : TEXT_PROVIDER,
      engine: page.engine ?? null,
      confidence: page.source === 'ocr' ? page.ocrConfidence : 0.99,
    });
  }
  return index;
}
