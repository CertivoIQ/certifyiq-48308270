import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pdf = readFileSync('src/lib/pdf-ocr.ts', 'utf8');
const formMap = readFileSync('src/lib/tic-pdf-form-values.ts', 'utf8');
const registry = readFileSync('src/lib/tic-field-registry.ts', 'utf8');
const review = readFileSync('src/components/certivoiq-tic-review-form.tsx', 'utf8');

test('fillable TIC values are read directly before OCR fallback', () => {
  assert.match(pdf, /getFieldObjects\(\)/);
  assert.match(pdf, /ticPdfFormValueLinesByPage/);
  assert.match(pdf, /preparedTextByPage/);
});

test('TIC visual fallback uses optimized high-resolution rendering and preserves native values', () => {
  assert.match(pdf, /highResolutionFormCandidate/);
  assert.match(pdf, /const TIC_RENDER_SCALE = 3\.5/);
  assert.match(pdf, /highResolutionFormCandidate \? TIC_RENDER_SCALE : RENDER_SCALE/);
  assert.match(pdf, /combinedText/);
});

test('flattened TIC fallback requests OCR geometry for spatial cell mapping', () => {
  assert.match(pdf, /extractTicSpatialValueLines/);
  assert.match(pdf, /blocks:\s*true/);
  assert.match(pdf, /spatialLines/);
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
  assert.match(formMap, /household member \$\{row\}/);
});
