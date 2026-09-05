from pathlib import Path

pdf = Path('src/lib/pdf-ocr.ts')
text = pdf.read_text()
import_anchor = "} from '@/lib/ocr-sidecar.mjs';\n"
extra_import = "import { ticPdfFormValueLinesByPage, type PdfFieldObjects } from '@/lib/tic-pdf-form-values';\n"
if extra_import not in text:
    text = text.replace(import_anchor, import_anchor + extra_import, 1)

arrays_anchor = "    const pages: OcrSidecarPage[] = [];\n    const needsOcr: number[] = [];\n"
arrays_replacement = "    const pages: OcrSidecarPage[] = [];\n    const needsOcr: number[] = [];\n    const preparedTextByPage = new Map<number, string>();\n    let nativeFormValuesByPage = new Map<number, string[]>();\n    try {\n      const fieldObjects = await pdf.getFieldObjects();\n      nativeFormValuesByPage = ticPdfFormValueLinesByPage(fieldObjects as unknown as PdfFieldObjects | null);\n    } catch {\n      // Some flattened PDFs do not expose AcroForm fields. Visual OCR remains the fallback.\n    }\n"
if 'nativeFormValuesByPage' not in text:
    if arrays_anchor not in text:
        raise SystemExit('Could not locate PDF page-array anchor')
    text = text.replace(arrays_anchor, arrays_replacement, 1)

old_text_block = """        const content = await page.getTextContent();
        const text = normalizePageText(
          content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
        );
        if (pageNeedsOcr(text)) needsOcr.push(pageNumber);
        else pages.push({ page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text });
"""
new_text_block = """        const content = await page.getTextContent();
        const nativeText = normalizePageText(
          content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
        );
        const formValueLines = nativeFormValuesByPage.get(pageNumber) ?? [];
        const text = normalizePageText([nativeText, ...formValueLines].filter(Boolean).join('\\n'));
        preparedTextByPage.set(pageNumber, text);
        const isTicFormPage =
          pageNumber <= 3 &&
          /tenant income certification/i.test(nativeText) &&
          !/instructions for completing/i.test(nativeText);
        if (pageNeedsOcr(text) || isTicFormPage) needsOcr.push(pageNumber);
        else pages.push({ page: pageNumber, source: 'text', engine: null, ocrConfidence: null, text });
"""
if old_text_block in text:
    text = text.replace(old_text_block, new_text_block, 1)
elif 'formValueLines = nativeFormValuesByPage.get(pageNumber)' not in text:
    raise SystemExit('Could not locate PDF native-text block')

old_viewport = "          const viewport = page.getViewport({ scale: RENDER_SCALE });\n"
new_viewport = """          const preparedText = preparedTextByPage.get(pageNumber) ?? '';
          const isTicFormPage = pageNumber <= 3 && /tenant income certification/i.test(preparedText);
          const viewport = page.getViewport({ scale: isTicFormPage ? 4.5 : RENDER_SCALE });
"""
if old_viewport in text:
    text = text.replace(old_viewport, new_viewport, 1)
elif 'isTicFormPage ? 4.5 : RENDER_SCALE' not in text:
    raise SystemExit('Could not locate PDF viewport block')

old_push = """              pages.push({
                page: pageNumber,
                source: 'ocr',
                engine: OCR_ENGINE,
                ocrConfidence: Math.min(1, confidence),
                text,
              });
"""
new_push = """              const combinedText = normalizePageText(
                [preparedTextByPage.get(pageNumber) ?? '', text].filter(Boolean).join('\\n'),
              );
              pages.push({
                page: pageNumber,
                source: 'ocr',
                engine: OCR_ENGINE,
                ocrConfidence: Math.min(1, confidence),
                text: combinedText,
              });
"""
if old_push in text:
    text = text.replace(old_push, new_push, 1)
elif 'const combinedText = normalizePageText' not in text:
    raise SystemExit('Could not locate OCR page-push block')
pdf.write_text(text)

form = Path('src/components/certivoiq-tic-review-form.tsx')
text = form.read_text()
old_import = 'import { TIC_FIELD_BY_KEY } from "@/lib/tic-field-registry";\n'
new_import = 'import { TIC_ASSET_ROW_COUNT, TIC_FIELD_BY_KEY, TIC_HOUSEHOLD_ROW_COUNT, TIC_INCOME_ROW_COUNT } from "@/lib/tic-field-registry";\n'
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif 'TIC_HOUSEHOLD_ROW_COUNT' not in text:
    raise SystemExit('Could not locate TIC review registry import')
text = text.replace('const members = Array.from({ length: 7 }, (_, i) => i + 1);', 'const members = Array.from({ length: TIC_HOUSEHOLD_ROW_COUNT }, (_, i) => i + 1);', 1)
text = text.replace('const members = Array.from({ length: 7 }, (_, i) => i + 1);', 'const members = Array.from({ length: TIC_INCOME_ROW_COUNT }, (_, i) => i + 1);', 1)
text = text.replace('const rows = Array.from({ length: 8 }, (_, i) => i + 1);', 'const rows = Array.from({ length: TIC_ASSET_ROW_COUNT }, (_, i) => i + 1);', 1)
form.write_text(text)

test = Path('scripts/test-tic-native-form-extraction.mjs')
test.write_text("""import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pdf = readFileSync('src/lib/pdf-ocr.ts', 'utf8');
const formMap = readFileSync('src/lib/tic-pdf-form-values.ts', 'utf8');
const registry = readFileSync('src/lib/tic-field-registry.ts', 'utf8');
const review = readFileSync('src/components/certivoiq-tic-review-form.tsx', 'utf8');

test('fillable TIC values are read directly before OCR fallback', () => {
  assert.match(pdf, /getFieldObjects\\(\\)/);
  assert.match(pdf, /ticPdfFormValueLinesByPage/);
  assert.match(pdf, /preparedTextByPage/);
});

test('TIC visual fallback uses higher resolution and preserves native values', () => {
  assert.match(pdf, /isTicFormPage \\? 4\\.5 : RENDER_SCALE/);
  assert.match(pdf, /combinedText/);
});

test('source TIC continuation capacity is represented in the review form', () => {
  assert.match(registry, /TIC_HOUSEHOLD_ROW_COUNT = 10/);
  assert.match(registry, /TIC_INCOME_ROW_COUNT = 10/);
  assert.match(registry, /TIC_ASSET_ROW_COUNT = 27/);
  assert.match(review, /TIC_HOUSEHOLD_ROW_COUNT/);
  assert.match(review, /TIC_INCOME_ROW_COUNT/);
  assert.match(review, /TIC_ASSET_ROW_COUNT/);
});

test('native PDF row names map to deterministic TIC aliases', () => {
  assert.match(formMap, /Last Name/);
  assert.match(formMap, /A Employment or Wages/);
  assert.match(formMap, /G Type of Asset/);
  assert.match(formMap, /household member \\$\\{row\\}/);
});
""")
