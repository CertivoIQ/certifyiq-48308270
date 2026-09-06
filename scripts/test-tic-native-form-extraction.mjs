import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pdf = readFileSync('src/lib/pdf-ocr.ts', 'utf8');
const formMap = readFileSync('src/lib/tic-pdf-form-values.ts', 'utf8');
const fieldExtraction = readFileSync('src/lib/tic-field-extraction.ts', 'utf8');
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

test('native PDF source labels map directly to matching CertivoIQ keys', () => {
  const requiredPairs = [
    ['Property Name', 'property_name'],
    ['County', 'county'],
    ['TC', 'tax_credit_number'],
    ['BIN', 'building_identification_number'],
    ['Address', 'property_address'],
    ['Unit Number', 'unit_number'],
    ['# Bedrooms', 'unit_bedrooms'],
    ['Last Name', 'last_name'],
    ['First Name Middle Initial', 'first_name_middle_initial'],
    ['Rel HH', 'relationship'],
    ['Date of Birth', 'date_of_birth'],
    ['FIT Student', 'full_time_student'],
    ['A Employment or Wages', 'wages_business'],
    ['B Social SecurityPensions', 'social_security_pension'],
    ['C Public Assistance', 'public_assistance'],
    ['D Other Income', 'other_income'],
    ['G Type of Asset', 'type'],
    ['J Cash Value of Asset', 'cash_value'],
  ];
  for (const [source, target] of requiredPairs) {
    assert.ok(formMap.includes(source), `source field ${source} must be recognized`);
    assert.ok(formMap.includes(target), `source field ${source} must map to ${target}`);
  }
  assert.match(formMap, /DIRECT_PREFIX = "__CERTIVOIQ_TIC_FIELD__"/);
  assert.match(fieldExtraction, /DIRECT_TIC_FIELD_PREFIX = "__CERTIVOIQ_TIC_FIELD__"/);
});

test('certification type is a first-class mapped field for Initial, Recertification, and Other', () => {
  assert.match(formMap, /\["Initial Certification", "Recertification", "Other"\]/);
  assert.match(formMap, /\["certification_type", name\]/);
  assert.match(registry, /field\("certification_type"/);
  assert.match(review, /option="Initial Certification"/);
  assert.match(review, /option="Recertification"/);
  assert.match(review, /option="Other"/);
});

test('exact keyed TIC values are parsed before generic OCR aliases', () => {
  assert.match(fieldExtraction, /for \(let index = 0; index < lines\.length; index \+= 1\)/);
  assert.match(fieldExtraction, /TIC_FIELD_BY_KEY\.get\(direct\[1\]\)/);
  assert.match(fieldExtraction, /if \(found\.has\(definition\.key\)/);
  assert.match(fieldExtraction, /if \(line\.startsWith\(DIRECT_TIC_FIELD_PREFIX\)\) continue/);
});
