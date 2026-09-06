import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTicSpatialValueLines } from '../src/lib/tic-spatial-extraction.mjs';

const PREFIX = '__CERTIVOIQ_TIC_FIELD__';
const direct = (key, value) => `${PREFIX} ${key}: ${value}`;
const word = (text, x0, y0, x1, y1) => ({ text, bbox: { x0, y0, x1, y1 } });
const line = (text, y0, y1, words) => ({ text, bbox: { x0: 20, y0, x1: 980, y1 }, words });
const paragraph = (lines) => ({ lines });
const block = (lines) => ({ paragraphs: [paragraph(lines)] });

const householdHeader = line('HH Mbr # Last Name First Name Middle Initial Relationship Date of Birth Student Social Security', 180, 205, [
  word('HH', 25, 180, 45, 200), word('Mbr', 48, 180, 75, 200), word('Last', 120, 180, 155, 200), word('Name', 160, 180, 205, 200),
  word('First', 315, 180, 350, 200), word('Name', 355, 180, 400, 200), word('Relationship', 480, 180, 575, 200),
  word('Date', 660, 180, 700, 200), word('Birth', 705, 180, 745, 200), word('Student', 805, 180, 860, 200), word('Social', 900, 180, 940, 200),
]);

const incomeHeader = line('HH Mbr # Employment or Wages Social Security Pensions Public Assistance Other Income', 390, 415, [
  word('HH', 25, 390, 45, 410), word('Mbr', 48, 390, 75, 410), word('Employment', 145, 390, 230, 410), word('Wages', 235, 390, 285, 410),
  word('Social', 370, 390, 420, 410), word('Security', 425, 390, 490, 410), word('Public', 585, 390, 635, 410), word('Assistance', 640, 390, 720, 410), word('Other', 830, 390, 875, 410), word('Income', 880, 390, 935, 410),
]);

test('flattened TIC header and Part I map to the exact CertivoIQ fields', () => {
  const blocks = [block([
    line('TENANT INCOME CERTIFICATION', 20, 40, [word('TENANT', 300, 20, 380, 40), word('INCOME', 390, 20, 470, 40), word('CERTIFICATION', 480, 20, 610, 40)]),
    line('X Initial Certification Recertification Other', 55, 76, [
      word('X', 23, 55, 34, 75), word('Initial', 43, 55, 88, 75), word('Certification', 92, 55, 170, 75),
      word('Recertification', 245, 55, 350, 75), word('Other', 420, 55, 465, 75),
    ]),
    line('Effective Date: 07/01/2026 Move-in Date: 07/01/2025 Current Date: 06/25/2026', 80, 100, [word('Effective', 500, 80, 560, 100)]),
    line('Property Name: Peach Place County: Peach TC#: GA-123 BIN#: GA-987654', 110, 132, [word('Property', 25, 110, 85, 130)]),
    line('Address: 123 Florence Street, Fort Valley, GA 31030 Unit Number: 308 # Bedrooms: 2', 136, 158, [word('Address', 25, 136, 80, 156)]),
    line('PART II - HOUSEHOLD COMPOSITION', 170, 178, [word('PART', 300, 170, 345, 178)]),
    householdHeader,
  ])];

  const values = extractTicSpatialValueLines(blocks, 1000, 1000);
  assert(values.includes(direct('certification_type', 'Initial Certification')));
  assert(values.includes(direct('certification_effective_date', '07/01/2026')));
  assert(values.includes(direct('move_in_date', '07/01/2025')));
  assert(values.includes(direct('current_date', '06/25/2026')));
  assert(values.includes(direct('property_name', 'Peach Place')));
  assert(values.includes(direct('county', 'Peach')));
  assert(values.includes(direct('tax_credit_number', 'GA-123')));
  assert(values.includes(direct('building_identification_number', 'GA-987654')));
  assert(values.includes(direct('property_address', '123 Florence Street, Fort Valley, GA 31030')));
  assert(values.includes(direct('unit_number', '308')));
  assert(values.includes(direct('unit_bedrooms', '2')));
});

test('legacy flattened TIC household and income cells map by exact field key', () => {
  const blocks = [block([
    line('TENANT INCOME CERTIFICATION', 20, 40, [word('TENANT', 300, 20, 380, 40), word('INCOME', 390, 20, 470, 40), word('CERTIFICATION', 480, 20, 610, 40)]),
    line('PART II - HOUSEHOLD COMPOSITION', 150, 170, [word('PART', 300, 150, 345, 170), word('II', 350, 150, 370, 170), word('HOUSEHOLD', 380, 150, 470, 170), word('COMPOSITION', 480, 150, 590, 170)]),
    householdHeader,
    line('1 Mobley Maxine T H 01/17/1965 N XXX-XX-1234', 230, 252, [
      word('1', 40, 230, 50, 250), word('Mobley', 125, 230, 190, 250), word('Maxine', 330, 230, 390, 250), word('T', 395, 230, 405, 250),
      word('H', 520, 230, 530, 250), word('01/17/1965', 675, 230, 760, 250), word('N', 830, 230, 840, 250), word('XXX-XX-1234', 915, 230, 975, 250),
    ]),
    line('PART III - GROSS ANNUAL INCOME', 360, 380, [word('PART', 300, 360, 345, 380), word('III', 350, 360, 380, 380), word('GROSS', 390, 360, 450, 380), word('ANNUAL', 460, 360, 530, 380), word('INCOME', 540, 360, 610, 380)]),
    incomeHeader,
    line('1 25544.40 0.00 0.00 0.00', 440, 462, [
      word('1', 40, 440, 50, 460), word('25544.40', 185, 440, 260, 460), word('0.00', 430, 440, 470, 460), word('0.00', 650, 440, 690, 460), word('0.00', 875, 440, 915, 460),
    ]),
    line('PART IV - INCOME FROM ASSETS', 560, 580, [word('PART', 300, 560, 345, 580), word('IV', 350, 560, 375, 580), word('INCOME', 390, 560, 450, 580), word('ASSETS', 520, 560, 585, 580)]),
    line('HH Mbr # Type of Asset Cash Value Annual Income', 590, 615, [word('HH', 25, 590, 45, 610), word('Mbr', 48, 590, 75, 610), word('Type', 160, 590, 200, 610), word('Asset', 205, 590, 250, 610), word('Cash', 520, 590, 555, 610), word('Value', 560, 590, 600, 610), word('Annual', 820, 590, 875, 610), word('Income', 880, 590, 930, 610)]),
    line('1 CHECKING C 320.90 0.00', 650, 672, [word('1', 40, 650, 50, 670), word('CHECKING', 150, 650, 230, 670), word('C', 430, 650, 440, 670), word('320.90', 600, 650, 655, 670), word('0.00', 850, 650, 890, 670)]),
    line('PART V - TOTAL HOUSEHOLD INCOME', 760, 780, [word('PART', 300, 760, 345, 780), word('V', 350, 760, 360, 780), word('TOTAL', 380, 760, 430, 780), word('HOUSEHOLD', 440, 760, 530, 780), word('INCOME', 540, 760, 600, 780)]),
  ])];

  const values = extractTicSpatialValueLines(blocks, 1000, 1000);
  assert(values.includes(direct('household_member_1_last_name', 'Mobley')));
  assert(values.includes(direct('household_member_1_first_name_middle_initial', 'Maxine T')));
  assert(values.includes(direct('household_member_1_relationship', 'H')));
  assert(values.includes(direct('household_member_1_date_of_birth', '01/17/1965')));
  assert(values.includes(direct('household_member_1_full_time_student', 'N')));
  assert(values.includes(direct('income_member_1_wages_business', '25544.40')));
  assert(values.includes(direct('income_member_1_social_security_pension', '0.00')));
  assert(values.includes(direct('asset_1_type', 'CHECKING')));
  assert(values.includes(direct('asset_1_cash_value', '320.90')));
});

test('income header hard-stops household mapping when PART III heading is missed', () => {
  const blocks = [block([
    line('TENANT INCOME CERTIFICATION', 20, 40, [word('TENANT', 300, 20, 380, 40), word('INCOME', 390, 20, 470, 40), word('CERTIFICATION', 480, 20, 610, 40)]),
    line('PART II - HOUSEHOLD COMPOSITION', 150, 170, [word('PART', 300, 150, 345, 170), word('II', 350, 150, 370, 170), word('HOUSEHOLD', 380, 150, 470, 170), word('COMPOSITION', 480, 150, 590, 170)]),
    householdHeader,
    line('1 Mobley Maxine T H 01/17/1965 N XXX-XX-1234', 230, 252, [
      word('1', 40, 230, 50, 250), word('Mobley', 125, 230, 190, 250), word('Maxine', 330, 230, 390, 250), word('T', 395, 230, 405, 250),
      word('H', 520, 230, 530, 250), word('01/17/1965', 675, 230, 760, 250), word('N', 830, 230, 840, 250), word('XXX-XX-1234', 915, 230, 975, 250),
    ]),
    incomeHeader,
    line('(A) (B) (C) (D)', 420, 438, [word('(A)', 160, 420, 190, 438), word('(B)', 380, 420, 410, 438), word('(C)', 600, 420, 630, 438), word('(D)', 820, 420, 850, 438)]),
    line('1 25364.40 0.00 0.00 0.00', 450, 472, [
      word('1', 40, 450, 50, 470), word('25364.40', 185, 450, 260, 470), word('0.00', 430, 450, 470, 470), word('0.00', 650, 450, 690, 470), word('0.00', 875, 450, 915, 470),
    ]),
    line('TOTALS $ 25,364.40 $ 0.00 $ 0.00 $ 0.00', 500, 522, [word('TOTALS', 35, 500, 95, 520), word('$', 150, 500, 160, 520), word('25,364.40', 180, 500, 260, 520), word('$', 390, 500, 400, 520), word('0.00', 430, 500, 470, 520)]),
    line('PART IV - INCOME FROM ASSETS', 560, 580, [word('PART', 300, 560, 345, 580), word('IV', 350, 560, 375, 580), word('INCOME', 390, 560, 450, 580), word('ASSETS', 520, 560, 585, 580)]),
  ])];

  const values = extractTicSpatialValueLines(blocks, 1000, 1000);
  assert(values.includes(direct('household_member_1_last_name', 'Mobley')));
  assert(values.includes(direct('income_member_1_wages_business', '25364.40')));
  assert(!values.some((value) => /household_member_[2-9]_/.test(value)), 'income labels/totals must never become household rows');
  assert(!values.some((value) => value.includes('household_member_8_last_name: 25,364.40')));
  assert(!values.some((value) => value.includes('household_member_9_')));
});

test('unrelated race text does not force PHFA household column geometry', () => {
  const blocks = [block([
    line('TENANT INCOME CERTIFICATION', 20, 40, [word('TENANT', 300, 20, 380, 40), word('INCOME', 390, 20, 470, 40), word('CERTIFICATION', 480, 20, 610, 40)]),
    line('Race information may be collected elsewhere in the tenant file', 80, 100, [word('Race', 80, 80, 120, 100), word('information', 130, 80, 210, 100)]),
    line('PART II - HOUSEHOLD COMPOSITION', 150, 170, [word('PART', 300, 150, 345, 170), word('II', 350, 150, 370, 170), word('HOUSEHOLD', 380, 150, 470, 170), word('COMPOSITION', 480, 150, 590, 170)]),
    householdHeader,
    line('1 Mobley Maxine T H 01/17/1965 N XXX-XX-1234', 230, 252, [
      word('1', 40, 230, 50, 250), word('Mobley', 125, 230, 190, 250), word('Maxine', 330, 230, 390, 250), word('T', 395, 230, 405, 250),
      word('H', 520, 230, 530, 250), word('01/17/1965', 675, 230, 760, 250), word('N', 830, 230, 840, 250), word('XXX-XX-1234', 915, 230, 975, 250),
    ]),
    incomeHeader,
  ])];

  const values = extractTicSpatialValueLines(blocks, 1000, 1000);
  assert(values.includes(direct('household_member_1_last_name', 'Mobley')));
  assert(values.includes(direct('household_member_1_date_of_birth', '01/17/1965')));
  assert(!values.some((value) => value.includes('household_member_1_race:')));
});
