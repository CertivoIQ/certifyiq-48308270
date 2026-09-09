import { findTicLabelForKey } from './tic-label-matching.mjs';
import { isTicContent } from './tic-document-layout.mjs';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const DIRECT_PREFIX = '__CERTIVOIQ_TIC_FIELD__';

function bboxOf(value) {
  const box = value?.bbox;
  if (!box) return null;
  const x0 = Number(box.x0);
  const y0 = Number(box.y0);
  const x1 = Number(box.x1);
  const y1 = Number(box.y1);
  if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

function flattenBlocks(blocks) {
  const words = [];
  const lines = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    for (const paragraph of block?.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        const lineBox = bboxOf(line);
        const lineText = clean(line?.text);
        const lineWords = [];
        for (const word of line?.words ?? []) {
          const box = bboxOf(word);
          const text = clean(word?.text);
          if (!box || !text) continue;
          const item = { text, ...box, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2 };
          words.push(item);
          lineWords.push(item);
        }
        if (lineBox && lineText) lines.push({ text: lineText, ...lineBox, words: lineWords });
      }
    }
  }
  // OCR engines may return each table cell as a separate line/block. Rejoin only
  // physically aligned fragments, not the arbitrary reading order of blocks.
  const rows = [];
  for (const line of [...lines].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    const row = rows.at(-1);
    const tolerance = Math.max(2, (line.y1 - line.y0) * 0.4);
    if (!row || Math.abs(row.y0 - line.y0) > tolerance) rows.push({ y0: line.y0, fragments: [line] });
    else row.fragments.push(line);
  }
  const joined = rows.map(row => {
    if (row.fragments.length === 1) return row.fragments[0];
    const fragments = row.fragments.sort((a, b) => a.x0 - b.x0);
    const rowWords = fragments.flatMap(line => line.words).sort((a, b) => a.x0 - b.x0);
    const text = fragments.map(line => line.text).join(' ');
    return { text, words: rowWords, x0: Math.min(...fragments.map(line => line.x0)), x1: Math.max(...fragments.map(line => line.x1)),
      y0: Math.min(...fragments.map(line => line.y0)), y1: Math.max(...fragments.map(line => line.y1)) };
  });
  return { words, lines: joined };
}

function normalizedText(value) {
  return clean(value).toLowerCase().replace(/[–—_-]+/g, ' ').replace(/\s+/g, ' ');
}

function findLine(lines, pattern, afterY = -Infinity) {
  return lines
    .filter((line) => line.y0 >= afterY && pattern.test(normalizedText(line.text)))
    .sort((a, b) => a.y0 - b.y0)[0] ?? null;
}

function firstMatchingLine(lines, patterns, afterY = -Infinity) {
  return patterns
    .map((pattern) => findLine(lines, pattern, afterY))
    .filter(Boolean)
    .sort((a, b) => a.y0 - b.y0)[0] ?? null;
}

function explicitMemberNumber(value, max) {
  const normalized = clean(value).replace(/[()#.]/g, '').trim();
  const match = normalized.match(/^(10|[1-9])$/);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= max ? number : null;
}

function clusterRows(words, startY, endY, pageHeight) {
  const candidates = words
    .filter((word) => word.cy >= startY && word.cy < endY)
    .sort((a, b) => a.cy - b.cy || a.x0 - b.x0);
  const tolerance = Math.max(7, pageHeight * 0.0065);
  const rows = [];
  for (const word of candidates) {
    const last = rows.at(-1);
    if (!last || Math.abs(word.cy - last.cy) > tolerance) {
      rows.push({ cy: word.cy, words: [word] });
    } else {
      last.words.push(word);
      last.cy = last.words.reduce((sum, item) => sum + item.cy, 0) / last.words.length;
    }
  }
  return rows.map((row) => ({ ...row, words: row.words.sort((a, b) => a.x0 - b.x0) }));
}

function tableExtent(_words, width) {
  // Never scale a table to its populated cells. A blank/redacted SSN or empty
  // income column must not shrink the grid and move names into other columns.
  // These normalized template bounds are proposals, not arbitrary-layout proof.
  return { x0: width * 0.025, x1: width * 0.975 };
}

function splitColumns(rowWords, extent, boundaries) {
  const result = Array.from({ length: boundaries.length - 1 }, () => []);
  const span = Math.max(1, extent.x1 - extent.x0);
  for (const word of rowWords) {
    const x = (word.cx - extent.x0) / span;
    const index = boundaries.findIndex((upper, i) => i > 0 && x < upper) - 1;
    const target = index >= 0 ? index : boundaries.length - 2;
    result[Math.max(0, Math.min(result.length - 1, target))].push(word.text);
  }
  return result.map((tokens) => clean(tokens.join(' ')));
}

function usefulRowText(parts) {
  return normalizedText(parts.join(' '));
}

function isHeaderOrNote(text) {
  return /\b(last name|first name|middle initial|relationship|date of birth|student|social security|employment|wages|pensions|public assistance|other income|type of asset|cash value|annual income|optional|indicates responses|total|part ii|part iii|part iv)\b/.test(text);
}

function cleanFieldValue(value) {
  return clean(value)
    .replace(/[☐□▢◻◽]/g, ' ')
    .replace(/_{2,}/g, ' ')
    .replace(/\.{3,}/g, ' ')
    .replace(/^[:=\-–—#\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function add(lines, key, value) {
  const cleaned = cleanFieldValue(value);
  if (!cleaned) return;
  lines.push(`${DIRECT_PREFIX} ${key}: ${cleaned}`);
}

const STATIC_LABELS = [
  ['certification_effective_date', /effective\s+date\s*:?/i],
  ['move_in_date', /move[ -]?in\s+date\s*:?/i],
  ['current_date', /current\s+date\s*:?/i],
  ['property_name', /property\s+name\s*:?/i],
  ['county', /county\s*:?/i],
  ['tax_credit_number', /\btc\s*#\s*:?/i],
  ['building_identification_number', /\bbin\s*#\s*:?/i],
  ['property_address', /\baddress\s*:?/i],
  ['unit_number', /unit\s+number\s*:?/i],
  ['unit_bedrooms', /#\s*bedrooms?\s*:?/i],
  ['applicable_lihtc_income_limit', /current\s+income\s+limit\s+per\s+family\s+size\s*:?/i],
  ['current_income_limit_140_percent', /current\s+income\s+limit\s*[x×]\s*140%\s*:?/i],
  ['household_income_at_move_in', /household\s+income\s+at\s+move[ -]?in\s*:?/i],
  ['household_size_at_move_in', /household\s+size\s+at\s+move[ -]?in\s*:?/i],
  ['rental_assistance_type', /rental\s+assistance\s+type\s*:?/i],
  ['tenant_paid_rent', /tenant\s+paid\s+rent\s*:?/i],
  ['rent_assistance', /rent\s+assistance\s*:?/i],
  ['utility_allowance', /utility\s+allowance\s*:?/i],
  ['other_non_optional_charges', /other\s+non[ -]?optional\s+charges\s*:?/i],
  ['gross_rent', /gross\s+rent\s+for\s+unit\s*:?/i],
  ['state_max_gross_rent', /maximum\s+rent\s+limit\s+for\s+this\s+unit\s*:?/i],
  ['student_exception_code', /student\s+explanation\s*:?/i],
  ['household_annual_income', /total\s+annual\s+household\s+income(?:\s+from\s+all\s+sources)?\s*:?/i],
  ['total_income_e', /total\s+income\s*\(e\)\s*:?/i],
  ['asset_actual_income_below_iit', /total\s+of\s+actual\s+income\s+earned\s+from\s+all\s+assets(?:\s*\(f\))?\s*:?/i],
  ['total_nnpp', /total\s+of\s+nnpp\s*:?/i],
  ['total_income_assets_m', /total\s+income\s+from\s+assets(?:\s*\(m\))?\s*:?/i],
];

function staticFieldLines(lines) {
  const out = [];
  for (const line of lines) {
    const hits = [];
    for (const [key, pattern] of STATIC_LABELS) {
      const exact = pattern.exec(line.text);
      const variant = findTicLabelForKey(line.text, key);
      const match = variant && (!exact || variant.end - variant.start > exact[0].length)
        ? { index: variant.start, 0: line.text.slice(variant.start, variant.end) } : exact;
      if (match && Number.isFinite(match.index)) {
        hits.push({ key, start: match.index, end: match.index + match[0].length });
      }
    }
    const accepted = hits.filter(hit => !hits.some(other => other.start <= hit.start && other.end >= hit.end && (other.start < hit.start || other.end > hit.end)));
    hits.length = 0;
    hits.push(...accepted);
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    for (let index = 0; index < hits.length; index += 1) {
      const hit = hits[index];
      const next = hits[index + 1];
      const raw = line.text.slice(hit.end, next?.start ?? line.text.length);
      const value = cleanFieldValue(raw);
      if (!value) continue;
      add(out, hit.key, value);
    }
  }
  return out;
}

function markerScore(value) {
  const text = clean(value);
  if (/^(?:x|\[x\]|☒|✓|✔|■|●|◆)$/i.test(text)) return 4;
  return 0;
}

function optionWordIndex(words, patterns) {
  for (let index = 0; index <= words.length - patterns.length; index += 1) {
    let matches = true;
    for (let offset = 0; offset < patterns.length; offset += 1) {
      if (!patterns[offset].test(normalizedText(words[index + offset]?.text ?? ''))) {
        matches = false;
        break;
      }
    }
    if (matches) return index;
  }
  return -1;
}

function selectedCertificationType(lines, words, pageWidth, pageHeight) {
  const line = firstMatchingLine(lines, [
    /initial\s+certification.*recertification.*other/,
    /initial\s+certification.*recertification/,
  ]);
  if (!line) return null;

  const raw = line.text;
  const explicit = [
    ['Initial Certification', /(?:☒|✓|✔|■|●|\[x\]|\bx\b)\s*initial\s+certification/i],
    ['Recertification', /(?:☒|✓|✔|■|●|\[x\]|\bx\b)\s*recertification/i],
    ['Other', /(?:☒|✓|✔|■|●|\[x\]|\bx\b)\s*other\b/i],
  ];
  const direct = explicit.filter(([, pattern]) => pattern.test(raw));
  if (direct.length === 1) return direct[0][0];
  if (direct.length > 1) return null;

  const options = [
    ['Initial Certification', [/^initial$/, /^certification$/]],
    ['Recertification', [/^recertification$/]],
    ['Other', [/^other$/]],
  ];
  const scored = [];
  for (const [label, patterns] of options) {
    const index = optionWordIndex(line.words, patterns);
    if (index < 0) continue;
    const anchor = line.words[index];
    let score = 0;
    for (const word of words) {
      if (Math.abs(word.cy - anchor.cy) > Math.max(8, pageHeight * 0.012)) continue;
      if (word.x1 > anchor.x0 || word.x1 < anchor.x0 - pageWidth * 0.055) continue;
      score = Math.max(score, markerScore(word.text));
    }
    scored.push({ label, score });
  }
  const best = scored.sort((a, b) => b.score - a.score);
  return best[0]?.score > 0 && best[0]?.score > (best[1]?.score ?? 0) ? best[0].label : null;
}

function otherCertificationText(lines) {
  const line = firstMatchingLine(lines, [/initial\s+certification.*recertification.*other/]);
  if (!line) return '';
  const match = /\bother\b\s*[:=\-–—]?\s*(.*)$/i.exec(line.text);
  const value = cleanFieldValue(match?.[1] ?? '');
  if (!value || /current\s+date/i.test(value)) return '';
  return value;
}

function locateHouseholdTable(lines, pageHeight) {
  const title = firstMatchingLine(lines, [/part\s*ii\b.*household/, /household\s+composition/]);
  if (!title) return null;
  const header = firstMatchingLine(lines, [/last\s+name.*first\s+name/, /first\s+name.*last\s+name/], title.y1);
  const bodyStart = (header?.y1 ?? title.y1) + Math.max(2, pageHeight * 0.003);
  const next = firstMatchingLine(lines, [
    /part\s*iii\b/, /gross\s+annual\s+income/, /employment.*wages.*(?:social|security|pension)/,
    /social\s+security.*public\s+assistance/, /part\s*iv[a-b]?\b/, /type\s+of\s+asset.*cash\s+value/, /part\s*v\b/,
  ], bodyStart);
  return { start: bodyStart, end: Math.max(bodyStart, next?.y0 ?? pageHeight), header };
}

function locateIncomeTable(lines, pageHeight) {
  const title = firstMatchingLine(lines, [/part\s*iii\b.*(?:gross|annual).*income/, /gross\s+annual\s+income/]);
  const header = firstMatchingLine(lines, [
    /employment.*wages.*(?:social|security|pension)/,
    /social\s+security.*public\s+assistance.*other\s+income/,
  ], title?.y1 ?? -Infinity);
  if (!title && !header) return null;
  const anchorBottom = header?.y1 ?? title?.y1 ?? 0;
  const bodyStart = anchorBottom + Math.max(2, pageHeight * 0.003);
  const next = firstMatchingLine(lines, [
    /part\s*iv[a-b]?\b/, /income\s+from\s+assets/, /type\s+of\s+asset.*(?:cash\s+value|annual\s+income)/,
    /part\s*v\b/, /total\s+household\s+income/,
  ], bodyStart);
  return { start: bodyStart, end: Math.max(bodyStart, next?.y0 ?? pageHeight) };
}

function locateAssetTable(lines, pageHeight) {
  const title = firstMatchingLine(lines, [/part\s*iv[a-b]?\b.*income.*assets/, /income\s+from\s+assets/, /part\s*iv\b.*assets/]);
  const header = firstMatchingLine(lines, [
    /type\s+of\s+asset.*(?:cash\s+value|annual\s+income)/,
    /cash\s+value.*annual\s+income/,
  ], title?.y1 ?? -Infinity);
  if (!title && !header) return null;
  const anchorBottom = header?.y1 ?? title?.y1 ?? 0;
  const bodyStart = anchorBottom + Math.max(2, pageHeight * 0.003);
  const next = firstMatchingLine(lines, [/part\s*v\b/, /total\s+household\s+income/, /household\s+certification/, /part\s*vi\b/], bodyStart);
  return { start: bodyStart, end: Math.max(bodyStart, next?.y0 ?? pageHeight) };
}

function householdLines(words, table, pageWidth, pageHeight, profile) {
  if (!table || table.end <= table.start) return [];
  const body = words.filter((word) => word.cy >= table.start && word.cy < table.end);
  const extent = tableExtent(body, pageWidth);
  const boundaries = profile === 'phfa'
    ? [0, 0.065, 0.235, 0.405, 0.47, 0.535, 0.60, 0.665, 0.765, 0.86, 1]
    : [0, 0.075, 0.295, 0.455, 0.64, 0.79, 0.885, 1];
  const out = [];
  for (const row of clusterRows(body, table.start, table.end, pageHeight)) {
    const parts = splitColumns(row.words, extent, boundaries);
    const text = usefulRowText(parts);
    if (!text || isHeaderOrNote(text)) continue;
    const member = explicitMemberNumber(parts[0], 10);
    if (!member || !parts.slice(1).some(Boolean)) continue;
    add(out, `household_member_${member}_last_name`, parts[1]);
    add(out, `household_member_${member}_first_name_middle_initial`, parts[2]);
    add(out, `household_member_${member}_relationship`, parts[3]);
    if (profile === 'phfa') {
      add(out, `household_member_${member}_race`, parts[4]);
      add(out, `household_member_${member}_ethnicity`, parts[5]);
      add(out, `household_member_${member}_disability`, parts[6]);
      add(out, `household_member_${member}_gender`, parts[7]);
      add(out, `household_member_${member}_date_of_birth`, parts[8]);
      add(out, `household_member_${member}_full_time_student`, parts[9]);
      add(out, `household_member_${member}_ssn_or_alien_registration`, parts[10]);
    } else {
      add(out, `household_member_${member}_date_of_birth`, parts[4]);
      add(out, `household_member_${member}_full_time_student`, parts[5]);
      add(out, `household_member_${member}_ssn_or_alien_registration`, parts[6]);
    }
  }
  return out;
}

function incomeLines(words, table, pageWidth, pageHeight) {
  if (!table || table.end <= table.start) return [];
  const body = words.filter((word) => word.cy >= table.start && word.cy < table.end);
  const extent = tableExtent(body, pageWidth);
  const boundaries = [0, 0.075, 0.325, 0.545, 0.755, 1];
  const out = [];
  let sourceRow = 0;
  for (const row of clusterRows(body, table.start, table.end, pageHeight)) {
    const parts = splitColumns(row.words, extent, boundaries);
    const text = usefulRowText(parts);
    if (!text || /\btotal\b/.test(text) || isHeaderOrNote(text)) continue;
    const member = explicitMemberNumber(parts[0], 10);
    if (!member || !parts.slice(1).some((value) => /\d/.test(value))) continue;
    if (++sourceRow > 10) break;
    add(out, `income_member_${sourceRow}_household_member_number`, parts[0]);
    add(out, `income_member_${sourceRow}_wages_business`, parts[1]);
    add(out, `income_member_${sourceRow}_social_security_pension`, parts[2]);
    add(out, `income_member_${sourceRow}_public_assistance`, parts[3]);
    add(out, `income_member_${sourceRow}_other_income`, parts[4]);
  }
  return out;
}

function assetLines(words, table, pageWidth, pageHeight, profile) {
  if (!table || table.end <= table.start) return [];
  const body = words.filter((word) => word.cy >= table.start && word.cy < table.end);
  const extent = tableExtent(body, pageWidth);
  const boundaries = profile === 'phfa'
    ? [0, 0.07, 0.29, 0.39, 0.51, 0.68, 0.79, 1]
    : [0, 0.075, 0.39, 0.47, 0.75, 1];
  const out = [];
  let sourceRow = 0;
  for (const row of clusterRows(body, table.start, table.end, pageHeight)) {
    const parts = splitColumns(row.words, extent, boundaries);
    const text = usefulRowText(parts);
    if (!text || /\b(total|threshold|imputed income threshold)\b/.test(text) || isHeaderOrNote(text)) continue;
    const member = explicitMemberNumber(parts[0], 27);
    if (!member || !parts.slice(1).some(Boolean)) continue;
    if (++sourceRow > 27) break;
    add(out, `asset_${sourceRow}_household_member_number`, parts[0]);
    add(out, `asset_${sourceRow}_type`, parts[1]);
    if (profile === 'phfa') {
      add(out, `asset_${sourceRow}_current_disposed`, parts[2]);
      add(out, `asset_${sourceRow}_category`, parts[3]);
      add(out, `asset_${sourceRow}_cash_value`, parts[4]);
      add(out, `asset_${sourceRow}_income_method`, parts[5]);
      add(out, `asset_${sourceRow}_annual_income`, parts[6]);
    } else {
      add(out, `asset_${sourceRow}_current_disposed`, parts[2]);
      add(out, `asset_${sourceRow}_cash_value`, parts[3]);
      add(out, `asset_${sourceRow}_annual_income`, parts[4]);
    }
  }
  return out;
}

/**
 * Recover exact source-field values from flattened TIC pages. Repeated table
 * cells use OCR geometry; labeled header/static fields use bounded label spans.
 * Output is keyed directly to the CertivoIQ TIC registry, so recognized values
 * cannot drift into neighboring fields.
 */
export function extractTicSpatialValueLines(blocks, suppliedWidth, suppliedHeight) {
  const { words, lines } = flattenBlocks(blocks);
  if (!words.length || !lines.length) return [];
  const width = Number(suppliedWidth) > 0 ? Number(suppliedWidth) : Math.max(...words.map((word) => word.x1));
  const height = Number(suppliedHeight) > 0 ? Number(suppliedHeight) : Math.max(...words.map((word) => word.y1));
  const pageText = normalizedText(lines.map((line) => line.text).join(' '));
  if (!isTicContent(lines.map(line => line.text).join('\n'))) return [];

  const householdTable = locateHouseholdTable(lines, height);
  const householdHeaderText = normalizedText(householdTable?.header?.text ?? '');
  const profile = /\brace\b|\bethn\b|\bdsbs\b|\bgndr\b|\bethnicity\b|\bdisability\b/.test(householdHeaderText)
    ? 'phfa'
    : 'legacy';
  const incomeTable = locateIncomeTable(lines, height);
  const assetTable = locateAssetTable(lines, height);

  const out = [...staticFieldLines(lines)];
  const certificationType = selectedCertificationType(lines, words, width, height);
  if (certificationType) add(out, 'certification_type', certificationType);
  if (certificationType === 'Other') {
    const explanation = otherCertificationText(lines);
    if (explanation) add(out, 'other_certification_type', explanation);
  }

  out.push(
    ...householdLines(words, householdTable, width, height, profile),
    ...incomeLines(words, incomeTable, width, height),
    ...assetLines(words, assetTable, width, height, profile),
  );
  return out;
}