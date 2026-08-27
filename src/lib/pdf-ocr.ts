import {
  MAX_OCR_PAGES,
  MAX_PDF_PAGES,
  OCR_ENGINE,
  OCR_LIMIT_MESSAGE,
  OCR_SIDECAR_VERSION,
  OCR_TIME_BUDGET_MS,
  normalizePageText,
  pageNeedsOcr,
  type OcrSidecar,
  type OcrSidecarPage,
} from '@/lib/ocr-sidecar.mjs';

/**
 * Browser-side certification preparation.
 *
 * Runs entirely in the customer's session: pages are read with the PDF text
 * layer first and only pages without usable text are rasterised and OCR'd with
 * the bundled open-source engine. No document bytes are sent to any external
 * OCR service. The output is an OCR sidecar (see ocr-sidecar.mjs) that the
 * normal server-side review pipeline consumes, so OCR text flows through the
 * same evidence -> rule engine -> finding -> authorized compliance review path.
 *
 * Everything is dynamically imported so the PDF and OCR engines never enter the
 * SSR graph or the initial page bundle.
 */

const RENDER_SCALE = 2;

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function isPdfFile(file: File): boolean {
  return /application\/pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return /^image\/(png|jpeg|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

/** Creates a source-bound single-page OCR sidecar for an uploaded image. */
export async function prepareImageForReview(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PrepareResult> {
  if (!isImageFile(file)) throw new Error('Only PNG, JPEG, and WEBP certification images are supported.');
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) throw new Error(OCR_LIMIT_MESSAGE);
  onProgress?.('Preparing certification image for review…');

  const sourceBuffer = await file.arrayBuffer();
  const sourceSha256 = await sha256Hex(sourceBuffer);
  const { createWorker } = await import('tesseract.js');
  const ocrWorker = await createWorker('eng');
  const startedAt = Date.now();
  try {
    const { data } = await ocrWorker.recognize(file);
    if (Date.now() - startedAt > OCR_TIME_BUDGET_MS) throw new Error(OCR_LIMIT_MESSAGE);
    const text = normalizePageText(data.text);
    const confidence = Number(data.confidence) / 100;
    if (!text || !Number.isFinite(confidence) || confidence <= 0) {
      throw new Error('No reviewable text could be extracted from this image. Upload a clearer image or a machine-readable PDF.');
    }
    return {
      kind: 'ocr',
      ocrPageCount: 1,
      sidecar: {
        schemaVersion: OCR_SIDECAR_VERSION,
        sourceFileName: file.name,
        sourceSha256,
        sourceByteSize: file.size,
        createdAt: new Date().toISOString(),
        pageCount: 1,
        truncated: false,
        pages: [{
          page: 1,
          source: 'ocr',
          engine: OCR_ENGINE,
          ocrConfidence: Math.min(1, confidence),
          text,
        }],
      },
    };
  } finally {
    await ocrWorker.terminate().catch(() => undefined);
  }
}

type RenderTarget = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };

function createCanvas(width: number, height: number): RenderTarget {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the scanned certification for review.');
  return { canvas, context };
}

export type PrepareResult =
  | { kind: 'machine-readable'; sidecar: null; ocrPageCount: 0 }
  | { kind: 'ocr'; sidecar: OcrSidecar; ocrPageCount: number };

/**
 * Returns a sidecar only when at least one page needed OCR. A fully
 * machine-readable PDF is left untouched so the existing server-side text path
 * stays exactly as-is.
 */
export async function prepareCertificationForReview(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PrepareResult> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const sourceBuffer = await file.arrayBuffer();
  const sourceSha256 = await sha256Hex(sourceBuffer);
  const bytes = new Uint8Array(sourceBuffer);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(OCR_LIMIT_MESSAGE);

    const pages: OcrSidecarPage[] = [];
    const needsOcr: number[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizePageText(
        content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
      );
      if (pageNeedsOcr(text)) needsOcr.push(pageNumber);
      else pages.push({ page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text });
    }

    if (!needsOcr.length) return { kind: 'machine-readable', sidecar: null, ocrPageCount: 0 };
    if (needsOcr.length > MAX_OCR_PAGES) throw new Error(OCR_LIMIT_MESSAGE);

    onProgress?.('Preparing certification for review…');

    const { createWorker } = await import('tesseract.js');
    const ocrWorker = await createWorker('eng');
    const startedAt = Date.now();
    try {
      for (const pageNumber of needsOcr) {
        if (Date.now() - startedAt > OCR_TIME_BUDGET_MS) throw new Error(OCR_LIMIT_MESSAGE);
        try {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const { canvas, context } = createCanvas(viewport.width, viewport.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const { data } = await ocrWorker.recognize(canvas);
          const text = normalizePageText(data.text);
          const confidence = Number(data.confidence) / 100;
          // A page whose OCR produced no text, or no engine-reported
          // confidence, is dropped: the rule engine then reports
          // "unable to determine" rather than acting on invented evidence.
          if (!text || !Number.isFinite(confidence) || confidence <= 0) continue;
          pages.push({
            page: pageNumber,
            source: 'ocr',
            engine: OCR_ENGINE,
            ocrConfidence: Math.min(1, confidence),
            text,
          });
        } catch (error) {
          if (error instanceof Error && error.message === OCR_LIMIT_MESSAGE) throw error;
          // Page-level OCR failure fails safe: the page contributes no evidence.
        }
      }
    } finally {
      await ocrWorker.terminate().catch(() => undefined);
    }

    pages.sort((a, b) => a.page - b.page);
    const ocrPageCount = pages.filter((page) => page.source === 'ocr').length;

    return {
      kind: 'ocr',
      ocrPageCount,
      sidecar: {
        schemaVersion: OCR_SIDECAR_VERSION,
        sourceFileName: file.name,
        sourceSha256,
        sourceByteSize: file.size,
        createdAt: new Date().toISOString(),
        pageCount: pdf.numPages,
        truncated: false,
        pages,
      },
    };
  } finally {
    await pdf.cleanup();
  }
}
