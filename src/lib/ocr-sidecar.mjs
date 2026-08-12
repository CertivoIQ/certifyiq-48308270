/**
 * Shared OCR sidecar contract.
 *
 * Scanned certification PDFs are rasterised and OCR'd inside the customer's own
 * browser session (no document ever leaves our app/Supabase architecture). The
 * result is stored next to the original PDF as a sidecar JSON file so the
 * server-side review pipeline can consume OCR text through exactly the same
 * extraction -> evidence -> rule engine -> finding -> human review path used for
 * machine-readable PDFs.
 *
 * Page-level provenance is preserved: every page records whether its text came
 * from the embedded PDF text layer or from OCR, which engine produced it, and
 * the confidence the engine actually reported. Nothing is invented here: a page
 * whose OCR failed or reported no confidence is dropped rather than guessed at,
 * which makes the downstream determination UNABLE_TO_DETERMINE instead of a
 * fabricated compliance finding.
 */

export const OCR_SIDECAR_VERSION = '1.0';
export const OCR_SIDECAR_SUFFIX = '.certivoiq-ocr.json';
export const OCR_PROVIDER = 'ocr-tesseract';
export const TEXT_PROVIDER = 'deterministic-text';

/** A page with less real text than this is treated as scanned/image-only. */
export const PAGE_TEXT_MIN_CHARS = 40;
/** Safe limits so a very large PDF cannot lock up the browser or the server. */
export const MAX_PDF_PAGES = 200;
export const MAX_OCR_PAGES = 40;
export const OCR_TIME_BUDGET_MS = 150_000;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const OCR_LIMIT_MESSAGE =
  'This certification is too large to prepare automatically. Please split it into smaller documents (up to 40 scanned pages each) and upload them again.';

export function sidecarPathFor(storagePath) {
  return `${storagePath}${OCR_SIDECAR_SUFFIX}`;
}

export function normalizePageText(text) {
  return String(text ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** True when a page's embedded text layer is too thin to be a real text page. */
export function pageNeedsOcr(text) {
  return normalizePageText(text).replace(/\n/g, ' ').trim().length < PAGE_TEXT_MIN_CHARS;
}

function usablePage(page) {
  if (!page || typeof page !== 'object') return null;
  const pageNumber = Number(page.page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return null;
  const text = normalizePageText(page.text);
  if (!text) return null;
  if (page.source === 'text') {
    return { page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text };
  }
  if (page.source === 'ocr') {
    // Confidence must come from the OCR engine itself; never synthesised.
    const confidence = Number(page.ocrConfidence);
    if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) return null;
    const engine = typeof page.engine === 'string' && page.engine ? page.engine : null;
    if (!engine) return null;
    return { page: pageNumber, source: 'ocr', engine, ocrConfidence: confidence, text };
  }
  return null;
}

/**
 * Validate a sidecar and flatten it into the page-marked text format the
 * deterministic extractor already understands ("page N" followed by content).
 */
export function composeSidecarText(sidecar) {
  if (!sidecar || typeof sidecar !== 'object') throw new Error('The OCR sidecar for this certification is unreadable.');
  if (sidecar.schemaVersion !== OCR_SIDECAR_VERSION) {
    throw new Error('The OCR sidecar for this certification uses an unsupported format.');
  }
  const rawPages = Array.isArray(sidecar.pages) ? sidecar.pages : [];
  const pages = rawPages.map(usablePage).filter(Boolean).sort((a, b) => a.page - b.page);

  const text = pages.map((page) => `page ${page.page}\n${page.text}`).join('\n');
  const ocrPageCount = pages.filter((page) => page.source === 'ocr').length;

  return {
    text,
    pages,
    ocrPageCount,
    textPageCount: pages.length - ocrPageCount,
    skippedPageCount: rawPages.length - pages.length,
    provider: ocrPageCount > 0 ? OCR_PROVIDER : TEXT_PROVIDER,
    truncated: sidecar.truncated === true,
  };
}

/** page number -> provenance, used to stamp every extracted fact. */
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
