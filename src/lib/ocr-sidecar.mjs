/** Source-bound OCR sidecar contract for certification evidence. */
export const OCR_SIDECAR_VERSION = '2.0';
export const OCR_SIDECAR_SUFFIX = '.certivoiq-ocr.json';
export const OCR_PROVIDER = 'ocr-tesseract';
export const TEXT_PROVIDER = 'deterministic-text';
export const OCR_ENGINE = 'tesseract.js:eng';
export const VISION_ENGINE = 'groq-vision:qwen/qwen3.6-27b';
export const VISION_PROVIDER = 'ocr-groq-vision';

export const PAGE_TEXT_MIN_CHARS = 40;
export const MAX_PDF_PAGES = 200;
export const MAX_OCR_PAGES = 50;
export const OCR_TIME_BUDGET_MS = 240_000;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const OCR_LIMIT_MESSAGE =
  'This certification contains more scanned pages than CertivoIQ can OCR in one intake. Up to 50 scanned pages can be prepared automatically.';
export const OCR_TIMEOUT_MESSAGE =
  'OCR processing did not finish within the browser processing window. The certification is within the upload-size limit; this is a processing-time limit, not a file-size error. Please retry the upload. If it repeats, route the packet for manual intake rather than reviewing incomplete evidence.';

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

/** Physical page numbers only; duplicates and partial-range guesses are rejected. */
export function preparationPageNumbers(input, pageCount) {
  const pages = input === undefined ? Array.from({length: pageCount}, (_, i) => i + 1) : input;
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PDF_PAGES || !Array.isArray(pages) || !pages.length || pages.some(p => !Number.isInteger(p) || p < 1 || p > pageCount) || new Set(pages).size !== pages.length) throw new Error('Choose valid, unique original pages for extraction.');
  return [...pages].sort((a,b) => a-b);
}

/** Selected-page sidecars may never stand in for evidence that was not prepared. */
export function assertSidecarPageCoverage(sidecar, requiredPages) {
  const identity = validateSidecarSource(sidecar);
  const required = preparationPageNumbers(requiredPages, identity.pageCount);
  // Older sidecars were produced by the mandatory whole-packet pipeline.
  if (sidecar.preparedPageNumbers === undefined) return;
  const prepared = new Set(preparationPageNumbers(sidecar.preparedPageNumbers, identity.pageCount));
  const missing = required.find(page => !prepared.has(page));
  if (missing !== undefined) throw new Error(`Page ${missing} has not completed extraction. Prepare the current page selection before saving or reviewing.`);
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
  if (sidecar.preparedPageNumbers !== undefined) preparationPageNumbers(sidecar.preparedPageNumbers, Number(sidecar.pageCount));
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
    if (page.engine !== OCR_ENGINE && page.engine !== VISION_ENGINE) return null;
    if (page.engine === VISION_ENGINE && !text.includes('__CERTIVOIQ_TIC_CELL_MODE__: strict')) return null;
    return { page: pageNumber, source: 'ocr', engine: page.engine, ocrConfidence: page.engine === VISION_ENGINE ? Math.min(0.7, confidence) : confidence, text };
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

  if (sidecar.preparedPageNumbers !== undefined && rawPages.some(page => !sidecar.preparedPageNumbers.includes(Number(page?.page)))) invalid('contains text outside its prepared page scope.');
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
    skippedPageCount: Math.max(0, sourceIdentity.pageCount - pages.length),
    provider: pages.some(page => page.engine === VISION_ENGINE) ? VISION_PROVIDER : ocrPageCount > 0 ? OCR_PROVIDER : TEXT_PROVIDER,
    truncated: false,
    sourceIdentity,
  };
}

export function provenanceIndex(pages) {
  const index = new Map();
  for (const page of pages ?? []) {
    index.set(page.page, {
      source: page.source,
      provider: page.engine === VISION_ENGINE ? VISION_PROVIDER : page.source === 'ocr' ? OCR_PROVIDER : TEXT_PROVIDER,
      engine: page.engine ?? null,
      confidence: page.engine === VISION_ENGINE ? Math.min(0.7, Number(page.ocrConfidence)) : page.source === 'ocr' ? page.ocrConfidence : 0.99,
    });
  }
  return index;
}
