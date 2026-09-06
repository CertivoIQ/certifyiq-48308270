import {
  MAX_OCR_PAGES,
  MAX_PDF_PAGES,
  OCR_ENGINE,
  OCR_LIMIT_MESSAGE,
  OCR_SIDECAR_VERSION,
  OCR_TIME_BUDGET_MS,
  OCR_TIMEOUT_MESSAGE,
  normalizePageText,
  pageNeedsOcr,
  type OcrSidecar,
  type OcrSidecarPage,
} from '@/lib/ocr-sidecar.mjs';
import { ticPdfFormValueLinesByPage, type PdfFieldObjects } from '@/lib/tic-pdf-form-values';
import { extractTicSpatialValueLines } from '@/lib/tic-spatial-extraction.mjs';

/**
 * Browser-side certification document extraction.
 *
 * Runs entirely in the customer's session. PDF pages use the text layer first
 * and only pages without usable text are rasterised and OCR'd. PNG, JPEG, and
 * WEBP certifications are OCR'd directly with the bundled open-source engine.
 * No certification bytes are sent to an OCR service. Tesseract runtime assets
 * are pinned below so production bundlers do not have to guess the worker/core
 * locations.
 *
 * The output is an OCR sidecar (see ocr-sidecar.mjs) that the normal server-side
 * review pipeline consumes, so OCR text flows through the same evidence -> rule
 * engine -> finding -> reviewer path.
 *
 * Everything is dynamically imported so the PDF and OCR engines never enter the
 * SSR graph or the initial page bundle.
 */

const RENDER_SCALE = 3;
const TIC_RENDER_SCALE = 3.5;
const MAX_PARALLEL_OCR_WORKERS = 3;
const MAX_PARALLEL_TEXT_READERS = 6;
const TESSERACT_VERSION = '7.0.0';
const TESSERACT_CORE_VERSION = '7.0.0';
const TESSERACT_WORKER_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const TESSERACT_CORE_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_CORE_VERSION}`;
const TESSERACT_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_best';

const OCR_RUNTIME_FAILURE_MESSAGE =
  'OCR could not start for this scanned certification. Please retry the upload. If the problem continues, route the document for manual intake rather than reviewing incomplete evidence.';
const OCR_NO_TEXT_MESSAGE =
  'OCR completed but could not recover readable text from this scanned certification. Upload a clearer scan or route the document for manual intake.';

type SharedOcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;
type OcrSource = Parameters<SharedOcrWorker['recognize']>[0];
type OcrRecognition = Awaited<ReturnType<SharedOcrWorker['recognize']>>;
type OcrPageSegMode = NonNullable<Parameters<SharedOcrWorker['setParameters']>[0]['tessedit_pageseg_mode']>;

type OcrWorkerSlot = {
  worker: Promise<SharedOcrWorker>;
  tail: Promise<void>;
};

// Reuse one bounded pool for the page lifetime. Mass intake must not start
// three new OCR workers (and reload their language data) for every document.
const sharedOcrSlots: OcrWorkerSlot[] = [];
let nextOcrSlot = 0;

function describeOcrError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 500);
  if (typeof error === 'string' && error.trim()) return error.trim().slice(0, 500);
  return 'Unknown OCR runtime failure';
}

async function createPinnedOcrWorker(): Promise<SharedOcrWorker> {
  const { createWorker } = await import('tesseract.js');
  try {
    return await createWorker('eng', 1, {
      workerPath: TESSERACT_WORKER_PATH,
      corePath: TESSERACT_CORE_PATH,
      langPath: TESSERACT_LANG_PATH,
      workerBlobURL: true,
    });
  } catch (error) {
    throw new Error(`${OCR_RUNTIME_FAILURE_MESSAGE} (${describeOcrError(error)})`);
  }
}

async function ensureOcrWorkerSlots(count: number) {
  while (sharedOcrSlots.length < count) {
    const worker = createPinnedOcrWorker();
    sharedOcrSlots.push({ worker, tail: Promise.resolve() });
  }
}

async function recognizeWithSharedWorker(
  source: OcrSource,
  workerCount: number,
  pageSegMode?: OcrPageSegMode,
  includeBlocks = false,
) {
  await ensureOcrWorkerSlots(workerCount);
  const slot = sharedOcrSlots[nextOcrSlot % workerCount]!;
  nextOcrSlot += 1;
  const recognition = slot.tail.then(async () => {
    const worker = await slot.worker;
    if (pageSegMode) {
      await worker.setParameters({
        tessedit_pageseg_mode: pageSegMode,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
    }
    return worker.recognize(
      source,
      { rotateAuto: true },
      includeBlocks ? { text: true, blocks: true } : { text: true },
    );
  });
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
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser could not prepare the scanned certification for review.');
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
  return { canvas, context };
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
  let weightedTotal = 0;
  for (let value = 0; value < histogram.length; value += 1) weightedTotal += value * Number(histogram[value] ?? 0);
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let bestThreshold = 180;

  for (let value = 0; value < histogram.length; value += 1) {
    const count = Number(histogram[value] ?? 0);
    backgroundWeight += count;
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += value * count;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = value;
    }
  }

  return Math.max(90, Math.min(225, bestThreshold));
}

function createHighContrastCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, context } = createCanvas(source.width, source.height);
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  const pixels = image.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = Number(pixels[index + 3] ?? 255) / 255;
    const red = Number(pixels[index] ?? 255);
    const green = Number(pixels[index + 1] ?? 255);
    const blue = Number(pixels[index + 2] ?? 255);
    const luminance = Math.round((0.299 * red + 0.587 * green + 0.114 * blue) * alpha + 255 * (1 - alpha));
    const bin = Math.max(0, Math.min(255, luminance));
    histogram[bin] = (histogram[bin] ?? 0) + 1;
  }

  const threshold = otsuThreshold(histogram, Math.max(1, pixels.length / 4));
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = Number(pixels[index + 3] ?? 255) / 255;
    const red = Number(pixels[index] ?? 255);
    const green = Number(pixels[index + 1] ?? 255);
    const blue = Number(pixels[index + 2] ?? 255);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) * alpha + 255 * (1 - alpha);
    const value = luminance <= threshold ? 0 : 255;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function visualInkProfile(source: HTMLCanvasElement) {
  const sampleWidth = Math.min(256, source.width);
  const sampleHeight = Math.max(1, Math.round(source.height * (sampleWidth / Math.max(1, source.width))));
  const { canvas, context } = createCanvas(sampleWidth, sampleHeight);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let inkPixels = 0;
  let darkPixels = 0;
  const total = Math.max(1, pixels.length / 4);

  for (let index = 0; index < pixels.length; index += 4) {
    const red = Number(pixels[index] ?? 255);
    const green = Number(pixels[index + 1] ?? 255);
    const blue = Number(pixels[index + 2] ?? 255);
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    if (luminance < 235) inkPixels += 1;
    if (luminance < 190) darkPixels += 1;
  }

  return {
    inkRatio: inkPixels / total,
    darkRatio: darkPixels / total,
  };
}

function looksVisuallyBlank(source: HTMLCanvasElement) {
  const profile = visualInkProfile(source);
  return profile.darkRatio < 0.0005 && profile.inkRatio < 0.0025;
}

function normalizedRecognition(recognition: OcrRecognition) {
  const text = normalizePageText(recognition.data.text);
  const confidence = Number(recognition.data.confidence) / 100;
  const blocks = (recognition.data as typeof recognition.data & { blocks?: unknown }).blocks ?? [];
  return {
    text,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    blocks,
  };
}

function recognitionScore(candidate: { text: string; confidence: number }) {
  return candidate.text.replace(/\s/g, '').length * Math.max(0.01, candidate.confidence);
}

function recognitionIsStrong(candidate: { text: string; confidence: number }) {
  return candidate.text.replace(/\s/g, '').length >= 30 && candidate.confidence >= 0.15;
}

async function recognizeScannedCanvas(canvas: HTMLCanvasElement, workerCount: number, includeBlocks = false) {
  const { PSM } = await import('tesseract.js');
  const candidates: Array<{ text: string; confidence: number; blocks: unknown }> = [];

  const auto = normalizedRecognition(await recognizeWithSharedWorker(canvas, workerCount, PSM.AUTO, includeBlocks));
  candidates.push(auto);
  if (recognitionIsStrong(auto)) return auto;

  const contrastCanvas = createHighContrastCanvas(canvas);
  const sparse = normalizedRecognition(
    await recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SPARSE_TEXT, includeBlocks),
  );
  candidates.push(sparse);
  if (recognitionIsStrong(sparse)) {
    return recognitionScore(sparse) > recognitionScore(auto) ? sparse : auto;
  }

  const block = normalizedRecognition(
    await recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SINGLE_BLOCK, includeBlocks),
  );
  candidates.push(block);

  return candidates.reduce((best, candidate) =>
    recognitionScore(candidate) > recognitionScore(best) ? candidate : best,
  );
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
    let recognition: OcrRecognition;
    try {
      recognition = await recognizeWithSharedWorker(file, 1, undefined, true);
    } catch (error) {
      throw new Error(`${OCR_RUNTIME_FAILURE_MESSAGE} (${describeOcrError(error)})`);
    }
    reportProgress(onProgress, 'Validating extracted image text…', 92);
    const { text, confidence, blocks } = normalizedRecognition(recognition);
    if (!text || !Number.isFinite(confidence) || confidence <= 0) {
      throw new Error(
        'This certification image did not contain readable text. Upload a clearer scan or route it to manual review.',
      );
    }
    const spatialLines = /tenant income certification/i.test(text)
      ? extractTicSpatialValueLines(blocks)
      : [];
    const combinedImageText = normalizePageText([text, ...spatialLines].filter(Boolean).join('\n'));
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
            text: combinedImageText,
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
    const preparedTextByPage = new Map<number, string>();
    let nativeFormValuesByPage = new Map<number, string[]>();
    try {
      const fieldObjects = await pdf.getFieldObjects();
      nativeFormValuesByPage = ticPdfFormValueLinesByPage(fieldObjects as unknown as PdfFieldObjects | null);
    } catch {
      // Some flattened PDFs do not expose AcroForm fields. Visual OCR remains the fallback.
    }

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
        const nativeText = normalizePageText(
          content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
        );
        const formValueLines = nativeFormValuesByPage.get(pageNumber) ?? [];
        const text = normalizePageText([nativeText, ...formValueLines].filter(Boolean).join('\n'));
        preparedTextByPage.set(pageNumber, text);
        const isTicFormPage =
          pageNumber <= 3 &&
          /tenant income certification/i.test(nativeText) &&
          !/instructions for completing/i.test(nativeText);
        if (pageNeedsOcr(text) || isTicFormPage) needsOcr.push(pageNumber);
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
      `Starting ${workerCount} parallel OCR reader${workerCount === 1 ? '' : 's'} for ${needsOcr.length} scanned page${needsOcr.length === 1 ? '' : 's'}…`,
      42,
    );

    try {
      await ensureOcrWorkerSlots(workerCount);
    } catch (error) {
      throw new Error(`${OCR_RUNTIME_FAILURE_MESSAGE} (${describeOcrError(error)})`);
    }

    const startedAt = Date.now();
    let nextIndex = 0;
    let completedCount = 0;
    let fatalError: Error | null = null;
    const pageErrors: Array<{ page: number; message: string }> = [];
    const blankPages: number[] = [];

    async function runWorker() {
      while (!fatalError) {
        const ocrIndex = nextIndex;
        nextIndex += 1;
        if (ocrIndex >= needsOcr.length) return;

        if (Date.now() - startedAt > OCR_TIME_BUDGET_MS) {
          fatalError = new Error(OCR_TIMEOUT_MESSAGE);
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
          const preparedText = preparedTextByPage.get(pageNumber) ?? '';
          const isTicFormPage = pageNumber <= 3 && /tenant income certification/i.test(preparedText);
          const highResolutionFormCandidate = pageNumber <= 3;
          const viewport = page.getViewport({ scale: highResolutionFormCandidate ? TIC_RENDER_SCALE : RENDER_SCALE });
          const { canvas, context } = createCanvas(viewport.width, viewport.height);
          await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise;

          if (looksVisuallyBlank(canvas)) {
            blankPages.push(pageNumber);
          } else {
            const { text, confidence, blocks } = await recognizeScannedCanvas(
              canvas,
              workerCount,
              highResolutionFormCandidate,
            );
            if (text && Number.isFinite(confidence) && confidence > 0) {
              const ticDetected = isTicFormPage || /tenant income certification/i.test(`${preparedText} ${text}`);
              const spatialLines = ticDetected
                ? extractTicSpatialValueLines(blocks, canvas.width, canvas.height)
                : [];
              const combinedText = normalizePageText(
                [preparedTextByPage.get(pageNumber) ?? '', text, ...spatialLines].filter(Boolean).join('\n'),
              );
              pages.push({
                page: pageNumber,
                source: 'ocr',
                engine: OCR_ENGINE,
                ocrConfidence: Math.min(1, confidence),
                text: combinedText,
              });
            } else {
              pageErrors.push({
                page: pageNumber,
                message: 'OCR returned no usable text or confidence after AUTO, SPARSE_TEXT, and high-contrast single-block passes.',
              });
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message === OCR_LIMIT_MESSAGE) {
            fatalError = error;
            return;
          }
          pageErrors.push({ page: pageNumber, message: describeOcrError(error) });
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
    blankPages.sort((a, b) => a - b);
    pageErrors.sort((a, b) => a.page - b.page);

    if (pageErrors.length) {
      const firstFailure = pageErrors[0]!;
      throw new Error(
        `${OCR_NO_TEXT_MESSAGE} First nonblank failed page: ${firstFailure.page}. ${firstFailure.message}`,
      );
    }

    if (pages.length === 0) {
      const blankDetail = blankPages.length
        ? ` The PDF contains ${blankPages.length} visually blank page${blankPages.length === 1 ? '' : 's'} and no readable text pages.`
        : '';
      throw new Error(`${OCR_NO_TEXT_MESSAGE}${blankDetail}`);
    }

    const ocrPageCount = pages.filter((page) => page.source === 'ocr').length;
    reportProgress(onProgress, 'Finalizing certification text and provenance…', 99);

    const sidecar: OcrSidecar = {
      schemaVersion: OCR_SIDECAR_VERSION,
      sourceFileName: file.name,
      sourceSha256,
      sourceByteSize: file.size,
      createdAt: new Date().toISOString(),
      pageCount: pdf.numPages,
      truncated: false,
      pages,
    };

    reportProgress(onProgress, 'Certification preparation complete.', 100);
    return ocrPageCount > 0
      ? { kind: 'ocr', ocrPageCount, sourceSha256, sidecar }
      : { kind: 'machine-readable', ocrPageCount: 0, sourceSha256, sidecar };
  } finally {
    await pdf.cleanup();
  }
}
