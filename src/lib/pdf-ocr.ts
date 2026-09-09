import {
  MAX_OCR_PAGES,
  MAX_PDF_PAGES,
  OCR_ENGINE,
  OCR_LIMIT_MESSAGE,
  OCR_SIDECAR_VERSION,
  OCR_TIMEOUT_MESSAGE,
  normalizePageText,
  pageNeedsOcr,
  preparationPageNumbers,
  type OcrSidecar,
  type OcrSidecarPage,
} from '@/lib/ocr-sidecar.mjs';
import { ocrTimeBudgetMs } from '@/lib/ocr-time-budget.mjs';
import { assertRenderedPdfImages, pdfImageDecodeOptions } from '@/lib/pdf-render-integrity.mjs';
import { ticPdfFormValueLinesByPage, type PdfFieldObjects } from '@/lib/tic-pdf-form-values';
import { createOcrWorkerPool, OcrRuntimeError } from '@/lib/ocr-worker-pool';
import { extractTicSpatialValueLines } from '@/lib/tic-spatial-extraction.mjs';
import { nativePdfLayout, isTicContent } from '@/lib/tic-document-layout.mjs';
import { planTicCells, cellSheetLayout, finishTicCells, mergeCellProposals, confirmWorksheetNumbers } from '@/lib/tic-ruled-cell-extraction.mjs';

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
// The WASM LSTM build uses the integer model. The float "best" model can abort
// with a missing DotProductSSE function on SIMD-capable browsers.
const TESSERACT_LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int';
// Tesseract caches by language, not URL. Keep old float models out of this cache.
const TESSERACT_CACHE_PATH = 'certivoiq-eng-best-int-1.0.0';

const OCR_RUNTIME_FAILURE_MESSAGE =
  'OCR could not start for this scanned certification. Please retry the upload. If the problem continues, route the document for manual intake rather than reviewing incomplete evidence.';
const OCR_NO_TEXT_MESSAGE =
  'OCR completed but could not recover readable text from this scanned certification. Upload a clearer scan or route the document for manual intake.';

type SharedOcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;
type OcrSource = Parameters<SharedOcrWorker['recognize']>[0];
type OcrRecognition = Awaited<ReturnType<SharedOcrWorker['recognize']>>;
type OcrPageSegMode = NonNullable<Parameters<SharedOcrWorker['setParameters']>[0]['tessedit_pageseg_mode']>;

// Reuse one bounded pool for the page lifetime. Mass intake must not start
// three new OCR workers (and reload their language data) for every document.
const preparedPageCache = new WeakMap<File, Map<number, OcrSidecarPage | null>>();
const sharedOcrPool = createOcrWorkerPool(createPinnedOcrWorker, worker => worker.terminate());

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
      cachePath: TESSERACT_CACHE_PATH,
      workerBlobURL: true,
    });
  } catch (error) {
    throw new Error(`${OCR_RUNTIME_FAILURE_MESSAGE} (${describeOcrError(error)})`);
  }
}

async function recognizeWithSharedWorker(
  source: OcrSource,
  workerCount: number,
  pageSegMode?: OcrPageSegMode,
  includeBlocks = false,
) {
  return sharedOcrPool.run(workerCount, async worker => {
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
  const needsFormLayoutRetry = /rental\s+application|annual\s+income\s+calculation\s+worksheet|adult\s+household\s+member/i.test(auto.text);
  if (recognitionIsStrong(auto) && !needsFormLayoutRetry) return auto;

  const contrastCanvas = createHighContrastCanvas(canvas);
  const sparse = normalizedRecognition(
    await recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SPARSE_TEXT, includeBlocks),
  );
  candidates.push(sparse);
  if (needsFormLayoutRetry && isTicContent(sparse.text) && !isTicContent(auto.text)) return sparse;
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

/** One bounded contact-sheet pass for recognized TICs. Original pixels remain unchanged. */
async function recognizeTicCells(canvas: HTMLCanvasElement, blocks: unknown, workerCount: number) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [] as string[];
  const plan = planTicCells(context.getImageData(0, 0, canvas.width, canvas.height), blocks);
  const sheet = cellSheetLayout(plan);
  if (!sheet.tiles.length) return finishTicCells(plan, sheet, []).lines;
  if (sheet.width * sheet.height > 9_000_000) throw new Error('TIC cell review exceeds the safe image budget.');
  const target = createCanvas(sheet.width, sheet.height);
  try {
    for (const tile of sheet.tiles) {
      const b = tile.bbox;
      // A neutral prefix helps the OCR engine retain isolated one-character cells.
      // It is not source evidence and is explicitly excluded by finishTicCells.
      target.context.fillStyle = '#000000';
      target.context.font = '28px sans-serif';
      target.context.fillText('Value:', 24, tile.y + tile.height - 4);
      target.context.drawImage(canvas, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0,
        tile.x, tile.y, tile.width, tile.height);
    }
    const { PSM } = await import('tesseract.js');
    const result = await recognizeWithSharedWorker(target.canvas, workerCount, PSM.SPARSE_TEXT, true);
    const extracted = finishTicCells(plan, sheet, (result.data as typeof result.data & { blocks?: unknown }).blocks ?? []);
    const confirmed = new Map<string, string>();
    // A worksheet money/rate cell needs agreement with an independent crop read.
    // This catches plausible digit errors that currency formatting alone cannot detect.
    async function confirmTile(tile: (typeof sheet.tiles)[number]) {
      if (!tile.key.startsWith('worksheet_') || !['currency','number'].includes(tile.type) || !extracted.values[tile.key]) return;
      const cell = plan.cells.find(candidate => candidate.key === tile.key)!;
      const b = cell.bbox;
      const scale = Math.min(3, 70 / Math.max(14, b.y1 - b.y0), 1000 / (b.x1 - b.x0));
      const width = Math.ceil((b.x1 - b.x0) * scale), height = Math.ceil((b.y1 - b.y0) * scale);
      const isolated = createCanvas(width + 196, height + 48);
      try {
        isolated.context.imageSmoothingEnabled = false;
        isolated.context.fillStyle = '#000000';
        isolated.context.font = '28px sans-serif';
        isolated.context.fillText('Value:', 24, height + 20);
        isolated.context.drawImage(canvas,b.x0,b.y0,b.x1-b.x0,b.y1-b.y0,148,24,width,height);
        const second = await recognizeWithSharedWorker(isolated.canvas,workerCount,PSM.SINGLE_LINE,true);
        const check = finishTicCells(
          {...plan,cells:[cell],groups:[],blocked:[],checkboxes:null,supplementalValues:{}},
          {width:isolated.canvas.width,height:isolated.canvas.height,tiles:[{...tile,x:148,y:24,width,height,scale}]},
          (second.data as typeof second.data & {blocks?:unknown}).blocks ?? [],
        );
        if (check.values[tile.key] === extracted.values[tile.key]) confirmed.set(tile.key, check.values[tile.key]!);
      } finally { isolated.canvas.width = 1; isolated.canvas.height = 1; }
    }
    for (let index = 0; index < sheet.tiles.length; index += workerCount) {
      await Promise.all(sheet.tiles.slice(index, index + workerCount).map(confirmTile));
    }
    return confirmWorksheetNumbers(extracted, plan, confirmed);
  } finally { target.canvas.width = 1; target.canvas.height = 1; }
}

function removeRedactedNativeValues(text: string, cellLines: readonly string[]) {
  const blocked = new Set(cellLines.map(line => /^__CERTIVOIQ_TIC_UNRESOLVED__\s+([a-z0-9_]+):/.exec(line)?.[1]).filter(Boolean));
  return text.split(/\r?\n/).filter(line => !blocked.has(/^__CERTIVOIQ_TIC_FIELD__\s+([a-z0-9_]+):/.exec(line)?.[1])).join('\n');
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
  options: { pageNumbers?: readonly number[] } = {},
): Promise<PrepareResult> {
  if (!isOcrSupportedFile(file)) {
    throw new Error('Only PDF, PNG, JPEG, and WEBP certification documents can be extracted.');
  }

  reportProgress(onProgress, 'Reading certification bytes…', 2);
  const sourceBuffer = await file.arrayBuffer();
  reportProgress(onProgress, 'Verifying certification integrity…', 5);
  const sourceSha256 = await sha256Hex(sourceBuffer);

  if (isImageFile(file)) {
    preparationPageNumbers(options.pageNumbers, 1);
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
    const spatialLines = isTicContent(text)
      ? extractTicSpatialValueLines(blocks)
      : [];
    let cellLines: string[] = [];
    if (isTicContent(text)) {
      const bitmap = await createImageBitmap(file);
      const source = createCanvas(bitmap.width, bitmap.height);
      try { source.context.drawImage(bitmap, 0, 0); cellLines = await recognizeTicCells(source.canvas, blocks, 1); }
      finally { bitmap.close(); source.canvas.width = 1; source.canvas.height = 1; }
    }
    const combinedImageText = normalizePageText([text, ...mergeCellProposals(spatialLines, cellLines)].filter(Boolean).join('\n'));
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
        preparedPageNumbers: [1],
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
  const pdf = await pdfjs.getDocument({ data: bytes, ...pdfImageDecodeOptions(pdfjs.version, window.location.origin) }).promise;

  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(OCR_LIMIT_MESSAGE);

    const requestedPages = preparationPageNumbers(options.pageNumbers, pdf.numPages);
    const requested = new Set(requestedPages);
    const cache = preparedPageCache.get(file) ?? new Map<number, OcrSidecarPage | null>();
    preparedPageCache.set(file, cache);
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
        if (!requested.has(pageNumber)) continue;
        if (cache.has(pageNumber)) {
          const cached = cache.get(pageNumber);
          if (cached) pages.push(cached);
          completedTextPages += 1;
          continue;
        }
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const nativeViewport = page.getViewport({ scale: 1 });
        const layout = nativePdfLayout(content.items, nativeViewport);
        const nativeText = normalizePageText(layout.text || content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        const formValueLines = nativeFormValuesByPage.get(pageNumber) ?? [];
        const nativeSpatialLines = isTicContent(nativeText) ? extractTicSpatialValueLines(layout.blocks, nativeViewport.width, nativeViewport.height) : [];
        const formKeys = new Set(formValueLines.map(line => line.split(/\s+/)[1]));
        const spatialValues = nativeSpatialLines.filter((line: string) => !formKeys.has(line.split(/\s+/)[1]));
        const text = normalizePageText([nativeText, ...formValueLines, ...spatialValues].filter(Boolean).join('\n'));
        preparedTextByPage.set(pageNumber, text);
        // A partially read TIC still needs spatial OCR; a complete native household row does not.
        const hasHousehold = /__CERTIVOIQ_TIC_FIELD__ household_member_1_last_name:/.test(text) && /__CERTIVOIQ_TIC_FIELD__ household_member_1_first_name_middle_initial:/.test(text);
        const isTicFormPage = isTicContent(nativeText) && !hasHousehold && /household\s+composition/i.test(nativeText);
        if (pageNeedsOcr(text) || isTicFormPage) needsOcr.push(pageNumber);
        else pages.push({ page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text });
        completedTextPages += 1;
        reportProgress(
          onProgress,
          `Reading PDF text: ${completedTextPages} of ${requestedPages.length} selected pages complete…`,
          10 + (completedTextPages / requestedPages.length) * 30,
        );
      }
    }
    await Promise.all(Array.from({ length: textReaderCount }, () => readTextPages()));
    pages.sort((a, b) => a.page - b.page);
    needsOcr.sort((a, b) => a - b);

    if (needsOcr.length + pages.filter(page => page.source === 'ocr').length > MAX_OCR_PAGES) throw new Error(OCR_LIMIT_MESSAGE);
    if (!needsOcr.length) {
      if (!pages.length) throw new Error(OCR_NO_TEXT_MESSAGE);
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
          preparedPageNumbers: requestedPages,
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

    const startedAt = Date.now();
    const timeBudgetMs = ocrTimeBudgetMs(needsOcr.length, workerCount);
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

        if (Date.now() - startedAt > timeBudgetMs) {
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
          const isTicFormPage = isTicContent(preparedText);
          const highResolutionFormCandidate = isTicFormPage || pageNumber <= 3;
          const viewport = page.getViewport({ scale: highResolutionFormCandidate ? TIC_RENDER_SCALE : RENDER_SCALE });
          const { canvas, context } = createCanvas(viewport.width, viewport.height);
          try {
          await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise;
          await assertRenderedPdfImages(page, pdfjs.OPS);

          if (looksVisuallyBlank(canvas)) {
            blankPages.push(pageNumber);
            cache.set(pageNumber, null);
          } else {
            const { text, confidence, blocks } = await recognizeScannedCanvas(
              canvas,
              workerCount,
              true,
            );
            if (text && Number.isFinite(confidence) && confidence > 0) {
              const ticDetected = isTicFormPage || isTicContent(text);
              const spatialLines = ticDetected
                ? extractTicSpatialValueLines(blocks, canvas.width, canvas.height)
                : [];
              const cellLines = ticDetected ? await recognizeTicCells(canvas, blocks, workerCount) : [];
              const exactKeys = new Set((nativeFormValuesByPage.get(pageNumber) ?? []).map(line => line.split(/\s+/)[1]));
              const fallbackValues = mergeCellProposals(spatialLines, cellLines).filter((line: string) =>
                line.startsWith('__CERTIVOIQ_TIC_UNRESOLVED__') || !exactKeys.has(line.split(/\s+/)[1]));
              const combinedText = normalizePageText(
                [removeRedactedNativeValues(preparedTextByPage.get(pageNumber) ?? '', cellLines), text, ...fallbackValues].filter(Boolean).join('\n'),
              );
              const preparedPage: OcrSidecarPage = {
                page: pageNumber,
                source: 'ocr',
                engine: OCR_ENGINE,
                ocrConfidence: Math.min(1, confidence),
                text: combinedText,
              };
              pages.push(preparedPage);
              cache.set(pageNumber, preparedPage);
            } else {
              pageErrors.push({
                page: pageNumber,
                message: 'OCR returned no usable text or confidence after AUTO, SPARSE_TEXT, and high-contrast single-block passes.',
              });
            }
          }
          } finally { canvas.width = 1; canvas.height = 1; }
        } catch (error) {
          if (error instanceof OcrRuntimeError) {
            fatalError = new Error(`${error.message} Failed PDF page: ${pageNumber}.`);
            return;
          }
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
      preparedPageNumbers: requestedPages,
      truncated: false,
      pages,
    };

    reportProgress(onProgress, 'Certification preparation complete.', 100);
    return ocrPageCount > 0
      ? { kind: 'ocr', ocrPageCount, sourceSha256, sidecar }
      : { kind: 'machine-readable', ocrPageCount: 0, sourceSha256, sidecar };
  } finally {
    await pdf.cleanup();
    await pdf.loadingTask.destroy();
  }
}


export type PacketInspection = { sourceSha256: string; pageCount: number; pages: Array<{page: number; text: string}> };

/** Open the original packet without waiting for OCR. Header suggestions are a separate task. */
export async function inspectCertificationPacket(file: File, onProgress?: PreparationProgressCallback): Promise<PacketInspection> {
  if (!isOcrSupportedFile(file)) throw new Error('Only PDF, PNG, JPEG, and WEBP certification documents can be extracted.');
  reportProgress(onProgress, 'Opening the uploaded packet…', 5);
  const buffer = await file.arrayBuffer();
  const sourceSha256 = await sha256Hex(buffer);
  if (isImageFile(file)) return {sourceSha256, pageCount: 1, pages: [{page: 1, text: ''}]};
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({data: new Uint8Array(buffer), ...pdfImageDecodeOptions(pdfjs.version, window.location.origin)}).promise;
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('Certification packets support up to 200 original pages.');
    const pages: PacketInspection['pages'] = Array.from({length: pdf.numPages}, (_, i) => ({page: i + 1, text: ''}));
    let next = 0, completed = 0;
    async function read() {
      while (next < pages.length) {
        const index = next++;
        const page = await pdf.getPage(index + 1);
        const content = await page.getTextContent();
        pages[index]!.text = normalizePageText(nativePdfLayout(content.items, page.getViewport({scale: 1})).text);
        completed++;
        reportProgress(onProgress, 'Opening packet pages…', 5 + completed / pages.length * 95);
      }
    }
    await Promise.all(Array.from({length: Math.min(MAX_PARALLEL_TEXT_READERS, pdf.numPages)}, () => read()));
    return {sourceSha256, pageCount: pdf.numPages, pages};
  } finally {await pdf.loadingTask.destroy();}
}

/** Small header reads suggest document roles only. They never become certification evidence. */
export async function identifyCertificationPageLabels(
  file: File,
  inspection: PacketInspection,
  onPage: (page: {page: number; text: string}) => void,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;
  const targets = inspection.pages.filter(page => pageNeedsOcr(page.text));
  if (!targets.length) return;
  const workerCount = parallelOcrWorkerCount(targets.length);
  const {PSM} = await import('tesseract.js');
  const pdfjs = isPdfFile(file) ? await import('pdfjs-dist') : null;
  if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = pdfjs ? await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), ...pdfImageDecodeOptions(pdfjs.version, window.location.origin)}).promise : null;
  let next = 0;
  const startedAt = Date.now();
  async function read() {
    while (!signal.aborted && next < targets.length && Date.now() - startedAt < 120_000) {
      const target = targets[next++]!;
      let canvas: HTMLCanvasElement | null = null;
      try {
        if (pdf && pdfjs) {
          const page = await pdf.getPage(target.page);
          const viewport = page.getViewport({scale: 2});
          const rendered = createCanvas(viewport.width, Math.ceil(viewport.height * 0.5));
          canvas = rendered.canvas;
          await page.render({canvas, canvasContext: rendered.context, viewport, background: '#ffffff'}).promise;
          await assertRenderedPdfImages(page, pdfjs.OPS);
        } else {
          const bitmap = await createImageBitmap(file);
          try {
            const scale = Math.min(1, 1400 / bitmap.width);
            const rendered = createCanvas(bitmap.width * scale, bitmap.height * scale * 0.5);
            canvas = rendered.canvas;
            rendered.context.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
          } finally {bitmap.close();}
        }
        if (signal.aborted) return;
        const result = normalizedRecognition(await recognizeWithSharedWorker(canvas, workerCount, PSM.SPARSE_TEXT));
        if (!signal.aborted && result.confidence >= 0.15 && result.text) onPage({page: target.page, text: result.text});
      } catch {
        // A label suggestion failure leaves a page undecided. Full extraction must still succeed.
      } finally {if (canvas) {canvas.width = 1; canvas.height = 1;}}
    }
  }
  try {await Promise.all(Array.from({length: workerCount}, () => read()));}
  finally {if (pdf) await pdf.loadingTask.destroy();}
}
