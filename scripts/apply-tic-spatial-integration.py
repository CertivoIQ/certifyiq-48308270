from pathlib import Path

p = Path('src/lib/pdf-ocr.ts')
s = p.read_text()

anchor = "import { ticPdfFormValueLinesByPage, type PdfFieldObjects } from '@/lib/tic-pdf-form-values';\n"
extra = "import { extractTicSpatialValueLines } from '@/lib/tic-spatial-extraction.mjs';\n"
if extra not in s:
    if anchor not in s:
        raise SystemExit('Missing TIC form-value import anchor')
    s = s.replace(anchor, anchor + extra, 1)

old = "return worker.recognize(source, { rotateAuto: true });"
new = "return worker.recognize(source, { rotateAuto: true }, { text: true, blocks: true });"
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('Missing Tesseract recognize anchor')

old_norm = '''function normalizedRecognition(recognition: OcrRecognition) {
  const text = normalizePageText(recognition.data.text);
  const confidence = Number(recognition.data.confidence) / 100;
  return {
    text,
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}
'''
new_norm = '''function normalizedRecognition(recognition: OcrRecognition) {
  const text = normalizePageText(recognition.data.text);
  const confidence = Number(recognition.data.confidence) / 100;
  const blocks = (recognition.data as typeof recognition.data & { blocks?: unknown }).blocks ?? [];
  return {
    text,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    blocks,
  };
}
'''
if old_norm in s:
    s = s.replace(old_norm, new_norm, 1)
elif new_norm not in s:
    raise SystemExit('Missing normalizedRecognition anchor')

old_candidates = "const candidates: Array<{ text: string; confidence: number }> = [];"
new_candidates = "const candidates: Array<{ text: string; confidence: number; blocks: unknown }> = [];"
if old_candidates in s:
    s = s.replace(old_candidates, new_candidates, 1)
elif new_candidates not in s:
    raise SystemExit('Missing OCR candidates anchor')

old_image = '''    const { text, confidence } = normalizedRecognition(recognition);
    if (!text || !Number.isFinite(confidence) || confidence <= 0) {
      throw new Error(
        'This certification image did not contain readable text. Upload a clearer scan or route it to manual review.',
      );
    }
    reportProgress(onProgress, 'Certification image preparation complete.', 100);
'''
new_image = '''    const { text, confidence, blocks } = normalizedRecognition(recognition);
    if (!text || !Number.isFinite(confidence) || confidence <= 0) {
      throw new Error(
        'This certification image did not contain readable text. Upload a clearer scan or route it to manual review.',
      );
    }
    const spatialLines = /tenant income certification/i.test(text)
      ? extractTicSpatialValueLines(blocks)
      : [];
    const combinedImageText = normalizePageText([text, ...spatialLines].filter(Boolean).join('\\n'));
    reportProgress(onProgress, 'Certification image preparation complete.', 100);
'''
if old_image in s:
    s = s.replace(old_image, new_image, 1)
elif new_image not in s:
    raise SystemExit('Missing image OCR anchor')

old_sidecar_text = '''            ocrConfidence: Math.min(1, confidence),
            text,
          },
        ],'''
new_sidecar_text = '''            ocrConfidence: Math.min(1, confidence),
            text: combinedImageText,
          },
        ],'''
if old_sidecar_text in s:
    s = s.replace(old_sidecar_text, new_sidecar_text, 1)
elif new_sidecar_text not in s:
    raise SystemExit('Missing image sidecar text anchor')

old_viewport = '''          const preparedText = preparedTextByPage.get(pageNumber) ?? '';
          const isTicFormPage = pageNumber <= 3 && /tenant income certification/i.test(preparedText);
          const viewport = page.getViewport({ scale: isTicFormPage ? 4.5 : RENDER_SCALE });
'''
new_viewport = '''          const preparedText = preparedTextByPage.get(pageNumber) ?? '';
          const isTicFormPage = pageNumber <= 3 && /tenant income certification/i.test(preparedText);
          const highResolutionFormCandidate = pageNumber <= 3;
          const viewport = page.getViewport({ scale: highResolutionFormCandidate ? 4.5 : RENDER_SCALE });
'''
if old_viewport in s:
    s = s.replace(old_viewport, new_viewport, 1)
elif new_viewport not in s:
    raise SystemExit('Missing PDF render-scale anchor')

old_scan = '''            const { text, confidence } = await recognizeScannedCanvas(canvas, workerCount);
            if (text && Number.isFinite(confidence) && confidence > 0) {
              const combinedText = normalizePageText(
                [preparedTextByPage.get(pageNumber) ?? '', text].filter(Boolean).join('\\n'),
              );
'''
new_scan = '''            const { text, confidence, blocks } = await recognizeScannedCanvas(canvas, workerCount);
            if (text && Number.isFinite(confidence) && confidence > 0) {
              const ticDetected = isTicFormPage || /tenant income certification/i.test(`${preparedText} ${text}`);
              const spatialLines = ticDetected
                ? extractTicSpatialValueLines(blocks, canvas.width, canvas.height)
                : [];
              const combinedText = normalizePageText(
                [preparedTextByPage.get(pageNumber) ?? '', text, ...spatialLines].filter(Boolean).join('\\n'),
              );
'''
if old_scan in s:
    s = s.replace(old_scan, new_scan, 1)
elif new_scan not in s:
    raise SystemExit('Missing scanned PDF OCR anchor')

p.write_text(s)
