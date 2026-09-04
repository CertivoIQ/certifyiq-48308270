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
 * Browser-side certification document extraction.
 *
 * Runs entirely in the customer's session. PDF pages use the text layer first
 * and only pages without usable text are rasterised and OCR'd. PNG, JPEG, and
 * WEBP certifications are OCR'd directly with
 * the bundled open-source engine. No document bytes are sent to any external
 * OCR service. The output is an OCR sidecar (see ocr-sidecar.mjs) that the
 * normal server-side review pipeline consumes, so OCR text flows through the
 * same evidence -> rule engine -> finding -> human review path.
 *
 * Everything is dynamically imported so the PDF and OCR engines never enter the
 * SSR graph or the initial page bundle.
 */

const RENDER_SCALE = 2;
const MAX_PARALLEL_OCR_WORKERS = 3;
const MAX_PARALLEL_TEXT_READERS = 6;

type SharedOcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;
type OcrSource = Parameters<SharedOcrWorker['recognize']>[0];

type OcrWorkerSlot = {
  worker: Promise<SharedOcrWorker>;
  tail: Promise<void>;
};

// Reuse one bounded pool for the page lifetime. Mass intake must not start
// three new OCR workers (and reload their language data) for every document.
const sharedOcrSlots: OcrWorkerSlot[] = [];
let nextOcrSlot = 0;

async function ensureOcrWorkerSlots(count: number) {
  while (sharedOcrSlots.length < count) {
    const worker = import('tesseract.js').then(({ createWorker }) => createWorker('eng'));
    sharedOcrSlots.push({ worker, tail: Promise.resolve() });
  }
}

async function recognizeWithSharedWorker(source: OcrSource, workerCount: number) {
  await ensureOcrWorkerSlots(workerCount);
  const slot = sharedOcrSlots[nextOcrSlot % workerCount]!;
  nextOcrSlot += 1;
  const recognition = slot.tail.then(async () => (await slot.worker).recognize(source));
  slot.tail = recognition.then(() => undefined, () => undefined);
  return recognition;
}

function parallelOcrWorkerCount(pageCount: number): number {
  if (pageCount <= 1) return 1;
  const cores = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : 4;
  const deviceMemory = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
    : Number.NaN;

  let workers = cores >= 8 ? 3 : cores >= 4 ? 2 : 1;
  if (Number.isFinite(deviceMemory) && deviceMemory < 4) workers = 1;
  return Math.max(1, Math.min(MAX_PARALLEL_OCR_WORKERS, workers, pageCount));
}

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

export function isOcrSupportedFile(file: File): boolean {
  return isPdfFile(file) || isImageFile(file);
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
  | { kind: 'machine-readable'; sidecar: OcrSidecar; ocrPageCount: 0; sourceSha256: string }
  | { kind: 'ocr'; sidecar: OcrSidecar; ocrPageCount: number; sourceSha256: string };

export type PreparationProgressCallback = (message: string, percent: number) => void;

function reportProgress(
  callback: PreparationProgressCallback | undefined,
  message: string,
  percent: number,
) {
  callback?.(message, Math.max(0, Math.min(100, Math.round(percent))));
}

/**
 * Returns a source-bound sidecar for every supported certification so review
 * can validate the original bytes once without parsing the PDF a second time.
 */
export async function prepareCertificationForReview(
  file: File,
  onProgress?: PreparationProgressCallback,
): Promise<PrepareResult> {
  if (!isOcrSupportedFile(file)) {
    throw new Error('Only PDF, PNG, JPEG, and WEBP certification documents can be extracted.');
  }

  reportProgress(onProgress, 'Reading certification bytes…', 2);
  const sourceBuffer = await file.arrayBuffer();
  reportProgress(onProgress, 'Verifying certification integrity…', 5);
  const sourceSha256 = await sha256Hex(sourceBuffer);

  if (isImageFile(file)) {
    reportProgress(onProgress, 'Preparing certification image for review…', 10);
    reportProgress(onProgress, 'Reading certification image text…', 35);
    const { data } = await recognizeWithSharedWorker(file, 1);
    reportProgress(onProgress, 'Validating extracted image text…', 92);
    const text = normalizePageText(data.text);
    const confidence = Number(data.confidence) / 100;
    if (!text || !Number.isFinite(confidence) || confidence <= 0) {
      throw new Error(
        'This certification image did not contain readable text. Upload a clearer scan or route it to manual review.',
      );
    }
    reportProgress(onProgress, 'Certification image preparation complete.', 100);
    return {
      kind: 'ocr',
      ocrPageCount: 1,
      sourceSha256,
      sidecar: {
        schemaVersion: OCR_SIDECAR_VERSION,
        sourceFileName: file.name,
        sourceSha256,
        sourceByteSize: file.size,
        createdAt: new Date().toISOString(),
        pageCount: 1,
        truncated: false,
        pages: [
          {
            page: 1,
            source: 'ocr',
            engine: OCR_ENGINE,
            ocrConfidence: Math.min(1, confidence),
            text,
          },
        ],
      },
    };
  }

  reportProgress(onProgress, 'Opening PDF…', 8);
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const bytes = new Uint8Array(sourceBuffer);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(OCR_LIMIT_MESSAGE);

    const pages: OcrSidecarPage[] = [];
    const needsOcr: number[] = [];

    let nextTextPage = 1;
    let completedTextPages = 0;
    const textReaderCount = Math.min(
      pdf.numPages,
      MAX_PARALLEL_TEXT_READERS,
      Math.max(1, typeof navigator === 'undefined' ? 4 : Math.floor(navigator.hardwareConcurrency || 4)),
    );
    async function readTextPages() {
      while (nextTextPage <= pdf.numPages) {
        const pageNumber = nextTextPage;
        nextTextPage += 1;
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = normalizePageText(
          content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
        );
        if (pageNeedsOcr(text)) needsOcr.push(pageNumber);
        else pages.push({ page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text });
        completedTextPages += 1;
        reportProgress(
          onProgress,
          `Reading PDF text: ${completedTextPages} of ${pdf.numPages} pages complete…`,
          10 + (completedTextPages / pdf.numPages) * 30,
        );
      }
    }
    await Promise.all(Array.from({ length: textReaderCount }, () => readTextPages()));
    pages.sort((a, b) => a.page - b.page);
    needsOcr.sort((a, b) => a - b);

    if (!needsOcr.length) {
      reportProgress(onProgress, 'PDF text detected; preparation complete.', 100);
      return {
        kind: 'machine-readable',
        ocrPageCount: 0,
        sourceSha256,
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
    }
    if (needsOcr.length > MAX_OCR_PAGES) throw new Error(OCR_LIMIT_MESSAGE);

    const workerCount = parallelOcrWorkerCount(needsOcr.length);
    reportProgress(
      onProgress,
      `Starting ${workerCount} parallel text reader${workerCount === 1 ? '' : 's'} for ${needsOcr.length} scanned page${needsOcr.length === 1 ? '' : 's'}…`,
      42,
    );

    await ensureOcrWorkerSlots(workerCount);
    const startedAt = Date.now();
    let nextIndex = 0;
    let completedCount = 0;
    let fatalError: Error | null = null;

    async function runWorker() {
      while (!fatalError) {
        const ocrIndex = nextIndex;
        nextIndex += 1;
        if (ocrIndex >= needsOcr.length) return;

        if (Date.now() - startedAt > OCR_TIME_BUDGET_MS) {
          fatalError = new Error(OCR_LIMIT_MESSAGE);
          return;
        }

        const pageNumber = needsOcr[ocrIndex]!;
        reportProgress(
          onProgress,
          `Reading scanned pages in parallel: ${completedCount} of ${needsOcr.length} complete (PDF page ${pageNumber} in progress)…`,
          42 + (completedCount / needsOcr.length) * 55,
        );

        try {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const { canvas, context } = createCanvas(viewport.width, viewport.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const { data } = await recognizeWithSharedWorker(canvas, workerCount);
          const text = normalizePageText(data.text);
          const confidence = Number(data.confidence) / 100;
          // A page whose OCR produced no text, or no engine-reported
          // confidence, is dropped: the rule engine then reports
          // "unable to determine" rather than acting on invented evidence.
          if (text && Number.isFinite(confidence) && confidence > 0) {
            pages.push({
              page: pageNumber,
              source: 'ocr',
              engine: OCR_ENGINE,
              ocrConfidence: Math.min(1, confidence),
              text,
            });
          }
        } catch (error) {
          if (error instanceof Error && error.message === OCR_LIMIT_MESSAGE) {
            fatalError = error;
            return;
          }
          // Page-level OCR failure fails safe: the page contributes no evidence.
        }

        completedCount += 1;
        reportProgress(
          onProgress,
          `Completed ${completedCount} of ${needsOcr.length} scanned pages.`,
          42 + (completedCount / needsOcr.length) * 55,
        );
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    if (fatalError) throw fatalError;

    pages.sort((a, b) => a.page - b.page);
    const ocrPageCount = pages.filter((page) => page.source === 'ocr').length;
    reportProgress(onProgress, 'Finalizing certification text and provenance…', 99);

    const result: PrepareResult = {
      kind: 'ocr',
      ocrPageCount,
      sourceSha256,
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
    reportProgress(onProgress, 'Certification preparation complete.', 100);
    return result;
  } finally {
    await pdf.cleanup();
  }
}

