import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTicSpatialValueLines } from '../src/lib/tic-spatial-extraction.mjs';

const word = (text, x0, y0, x1, y1) => ({ text, bbox: { x0, y0, x1, y1 } });
const line = (text, y0, y1, words) => ({ text, bbox: { x0: 20, y0, x1: 980, y1 }, words });
const paragraph = (lines) => ({ lines });
const block = (lines) => ({ paragraphs: [paragraph(lines)] });

test('legacy flattened TIC household and income cells map by geometry', () => {
  const blocks = [block([
    line('TENANT INCOME CERTIFICATION', 20, 40, [word('TENANT', 300, 20, 380, 40), word('INCOME', 390, 20, 470, 40), word('CERTIFICATION', 480, 20, 610, 40)]),
    line('PART II - HOUSEHOLD COMPOSITION', 150, 170, [word('PART', 300, 150, 345, 170), word('II', 350, 150, 370, 170), word('HOUSEHOLD', 380, 150, 470, 170), word('COMPOSITION', 480, 150, 590, 170)]),
    line('HH Mbr # Last Name First Name Middle Initial Relationship Date of Birth Student Social Security', 180, 205, [
      word('HH', 25, 180, 45, 200), word('Mbr', 48, 180, 75, 200), word('Last', 120, 180, 155, 200), word('Name', 160, 180, 205, 200),
      word('First', 315, 180, 350, 200), word('Name', 355, 180, 400, 200), word('Relationship', 480, 180, 575, 200),
      word('Date', 660, 180, 700, 200), word('Birth', 705, 180, 745, 200), word('Student', 805, 180, 860, 200), word('Social', 900, 180, 940, 200),
    ]),
    line('1 Mobley Maxine T H 01/17/1965 N XXX-XX-1234', 230, 252, [
      word('1', 40, 230, 50, 250), word('Mobley', 125, 230, 190, 250), word('Maxine', 330, 230, 390, 250), word('T', 395, 230, 405, 250),
      word('H', 520, 230, 530, 250), word('01/17/1965', 675, 230, 760, 250), word('N', 830, 230, 840, 250), word('XXX-XX-1234', 915, 230, 975, 250),
    ]),
    line('PART III - GROSS ANNUAL INCOME', 360, 380, [word('PART', 300, 360, 345, 380), word('III', 350, 360, 380, 380), word('GROSS', 390, 360, 450, 380), word('ANNUAL', 460, 360, 530, 380), word('INCOME', 540, 360, 610, 380)]),
    line('HH Mbr # Employment or Wages Social Security Pensions Public Assistance Other Income', 390, 415, [
      word('HH', 25, 390, 45, 410), word('Mbr', 48, 390, 75, 410), word('Employment', 145, 390, 230, 410), word('Wages', 235, 390, 285, 410),
      word('Social', 370, 390, 420, 410), word('Security', 425, 390, 490, 410), word('Public', 585, 390, 635, 410), word('Assistance', 640, 390, 720, 410), word('Other', 830, 390, 875, 410), word('Income', 880, 390, 935, 410),
    ]),
    line('1 25544.40 0.00 0.00 0.00', 440, 462, [
      word('1', 40, 440, 50, 460), word('25544.40', 185, 440, 260, 460), word('0.00', 430, 440, 470, 460), word('0.00', 650, 440, 690, 460), word('0.00', 875, 440, 915, 460),
    ]),
    line('PART IV - INCOME FROM ASSETS', 560, 580, [word('PART', 300, 560, 345, 580), word('IV', 350, 560, 375, 580), word('INCOME', 390, 560, 450, 580), word('ASSETS', 520, 560, 585, 580)]),
    line('HH Mbr # Type of Asset Cash Value Annual Income', 590, 615, [word('HH', 25, 590, 45, 610), word('Mbr', 48, 590, 75, 610), word('Type', 160, 590, 200, 610), word('Asset', 205, 590, 250, 610), word('Cash', 520, 590, 555, 610), word('Value', 560, 590, 600, 610), word('Annual', 820, 590, 875, 610), word('Income', 880, 590, 930, 610)]),
    line('1 CHECKING C 320.90 0.00', 650, 672, [word('1', 40, 650, 50, 670), word('CHECKING', 150, 650, 230, 670), word('C', 430, 650, 440, 670), word('320.90', 600, 650, 655, 670), word('0.00', 850, 650, 890, 670)]),
    line('PART V - TOTAL HOUSEHOLD INCOME', 760, 780, [word('PART', 300, 760, 345, 780), word('V', 350, 760, 360, 780), word('TOTAL', 380, 760, 430, 780), word('HOUSEHOLD', 440, 760, 530, 780), word('INCOME', 540, 760, 600, 780)]),
  ])];

  const lines = extractTicSpatialValueLines(blocks, 1000, 1000);
  assert(lines.includes('household member 1 last name: Mobley'));
  assert(lines.includes('household member 1 first name middle initial: Maxine T'));
  assert(lines.includes('household member 1 relationship: H'));
  assert(lines.includes('household member 1 date of birth: 01/17/1965'));
  assert(lines.includes('household member 1 full-time student: N'));
  assert(lines.includes('income member 1 employment or wages: 25544.40'));
  assert(lines.includes('income member 1 social security pensions: 0.00'));
  assert(lines.includes('asset 1 type: CHECKING'));
  assert(lines.includes('asset 1 cash value: 320.90'));
});
