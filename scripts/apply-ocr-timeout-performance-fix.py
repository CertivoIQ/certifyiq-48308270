from pathlib import Path

pdf = Path('src/lib/pdf-ocr.ts')
s = pdf.read_text()

s = s.replace(
    '  OCR_LIMIT_MESSAGE,\n  OCR_SIDECAR_VERSION,\n  OCR_TIME_BUDGET_MS,',
    '  OCR_LIMIT_MESSAGE,\n  OCR_SIDECAR_VERSION,\n  OCR_TIME_BUDGET_MS,\n  OCR_TIMEOUT_MESSAGE,',
    1,
)

s = s.replace(
    'const RENDER_SCALE = 3;\n',
    'const RENDER_SCALE = 3;\nconst TIC_RENDER_SCALE = 3.5;\n',
    1,
)

s = s.replace(
    '  pageSegMode?: OcrPageSegMode,\n) {',
    '  pageSegMode?: OcrPageSegMode,\n  includeBlocks = false,\n) {',
    1,
)

s = s.replace(
    "    return worker.recognize(source, { rotateAuto: true }, { text: true, blocks: true });",
    "    return worker.recognize(\n      source,\n      { rotateAuto: true },\n      includeBlocks ? { text: true, blocks: true } : { text: true },\n    );",
    1,
)

s = s.replace(
    'async function recognizeScannedCanvas(canvas: HTMLCanvasElement, workerCount: number) {',
    'async function recognizeScannedCanvas(canvas: HTMLCanvasElement, workerCount: number, includeBlocks = false) {',
    1,
)

s = s.replace(
    'recognizeWithSharedWorker(canvas, workerCount, PSM.AUTO)',
    'recognizeWithSharedWorker(canvas, workerCount, PSM.AUTO, includeBlocks)',
)
s = s.replace(
    'recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SPARSE_TEXT)',
    'recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SPARSE_TEXT, includeBlocks)',
)
s = s.replace(
    'recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SINGLE_BLOCK)',
    'recognizeWithSharedWorker(contrastCanvas, workerCount, PSM.SINGLE_BLOCK, includeBlocks)',
)

s = s.replace(
    'recognition = await recognizeWithSharedWorker(file, 1);',
    'recognition = await recognizeWithSharedWorker(file, 1, undefined, true);',
    1,
)

s = s.replace(
    'const viewport = page.getViewport({ scale: highResolutionFormCandidate ? 4.5 : RENDER_SCALE });',
    'const viewport = page.getViewport({ scale: highResolutionFormCandidate ? TIC_RENDER_SCALE : RENDER_SCALE });',
    1,
)

s = s.replace(
    'const { text, confidence, blocks } = await recognizeScannedCanvas(canvas, workerCount);',
    'const { text, confidence, blocks } = await recognizeScannedCanvas(\n              canvas,\n              workerCount,\n              highResolutionFormCandidate,\n            );',
    1,
)

s = s.replace(
    'fatalError = new Error(OCR_LIMIT_MESSAGE);',
    'fatalError = new Error(OCR_TIMEOUT_MESSAGE);',
    1,
)

required = [
    'OCR_TIMEOUT_MESSAGE',
    'const TIC_RENDER_SCALE = 3.5;',
    'includeBlocks ? { text: true, blocks: true } : { text: true }',
    'recognizeWithSharedWorker(file, 1, undefined, true)',
    'highResolutionFormCandidate ? TIC_RENDER_SCALE : RENDER_SCALE',
    'fatalError = new Error(OCR_TIMEOUT_MESSAGE);',
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'Missing expected OCR performance marker: {marker}')

pdf.write_text(s)

ui = Path('src/components/certification-upload-panel-v4.tsx')
u = ui.read_text()
old = '      setProgressPercent(0);\n      setProgressLabel("Certification intake could not be staged.");'
new = '      setProgressLabel("Certification preparation stopped before staging.");'
if old not in u:
    raise SystemExit('Could not find upload failure progress reset block')
u = u.replace(old, new, 1)
ui.write_text(u)
