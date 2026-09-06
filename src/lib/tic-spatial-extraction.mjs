const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

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
  return { words, lines };
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

function tableExtent(words, width) {
  const xs = words.flatMap((word) => [word.x0, word.x1]).filter(Number.isFinite);
  if (!xs.length) return { x0: width * 0.025, x1: width * 0.975 };
  const min = Math.max(0, Math.min(...xs));
  const max = Math.min(width, Math.max(...xs));
  const span = max - min;
  if (span < width * 0.55) return { x0: width * 0.025, x1: width * 0.975 };
  return { x0: Math.max(0, min - width * 0.01), x1: Math.min(width, max + width * 0.01) };
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

function add(lines, alias, value) {
  const cleaned = clean(value);
  if (!cleaned) return;
  lines.push(`${alias}: ${cleaned}`);
}

function locateHouseholdTable(lines, pageHeight) {
  const title = firstMatchingLine(lines, [/part\s*ii\b.*household/, /household\s+composition/]);
  if (!title) return null;
  const header = firstMatchingLine(
    lines,
    [
      /last\s+name.*first\s+name/,
      /first\s+name.*last\s+name/,
    ],
    title.y1,
  );
  const bodyStart = (header?.y1 ?? title.y1) + Math.max(2, pageHeight * 0.003);
  const next = firstMatchingLine(
    lines,
    [
      /part\s*iii\b/,
      /gross\s+annual\s+income/,
      /employment.*wages.*(?:social|security|pension)/,
      /social\s+security.*public\s+assistance/,
      /part\s*iv[a-b]?\b/,
      /type\s+of\s+asset.*cash\s+value/,
      /part\s*v\b/,
    ],
    bodyStart,
  );
  return {
    start: bodyStart,
    end: Math.max(bodyStart, next?.y0 ?? pageHeight),
    header,
  };
}

function locateIncomeTable(lines, pageHeight) {
  const title = firstMatchingLine(lines, [/part\s*iii\b.*(?:gross|annual).*income/, /gross\s+annual\s+income/]);
  const header = firstMatchingLine(
    lines,
    [
      /employment.*wages.*(?:social|security|pension)/,
      /social\s+security.*public\s+assistance.*other\s+income/,
    ],
    title?.y1 ?? -Infinity,
  );
  if (!title && !header) return null;
  const anchorBottom = header?.y1 ?? title?.y1 ?? 0;
  const bodyStart = anchorBottom + Math.max(2, pageHeight * 0.003);
  const next = firstMatchingLine(
    lines,
    [
      /part\s*iv[a-b]?\b/,
      /income\s+from\s+assets/,
      /type\s+of\s+asset.*(?:cash\s+value|annual\s+income)/,
      /part\s*v\b/,
      /total\s+household\s+income/,
    ],
    bodyStart,
  );
  return { start: bodyStart, end: Math.max(bodyStart, next?.y0 ?? pageHeight) };
}

function locateAssetTable(lines, pageHeight) {
  const title = firstMatchingLine(lines, [/part\s*iv[a-b]?\b.*income.*assets/, /income\s+from\s+assets/, /part\s*iv\b.*assets/]);
  const header = firstMatchingLine(
    lines,
    [
      /type\s+of\s+asset.*(?:cash\s+value|annual\s+income)/,
      /cash\s+value.*annual\s+income/,
    ],
    title?.y1 ?? -Infinity,
  );
  if (!title && !header) return null;
  const anchorBottom = header?.y1 ?? title?.y1 ?? 0;
  const bodyStart = anchorBottom + Math.max(2, pageHeight * 0.003);
  const next = firstMatchingLine(
    lines,
    [
      /part\s*v\b/,
      /total\s+household\s+income/,
      /household\s+certification/,
      /part\s*vi\b/,
    ],
    bodyStart,
  );
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
    if (!member) continue;
    if (!parts.slice(1).some(Boolean)) continue;
    if (profile === 'phfa') {
      add(out, `household member ${member} last name`, parts[1]);
      add(out, `household member ${member} first name middle initial`, parts[2]);
      add(out, `household member ${member} relationship`, parts[3]);
      add(out, `household member ${member} race`, parts[4]);
      add(out, `household member ${member} ethnicity`, parts[5]);
      add(out, `household member ${member} disability`, parts[6]);
      add(out, `household member ${member} gender`, parts[7]);
      add(out, `household member ${member} date of birth`, parts[8]);
      add(out, `household member ${member} full-time student`, parts[9]);
      add(out, `household member ${member} ssn alien registration`, parts[10]);
    } else {
      add(out, `household member ${member} last name`, parts[1]);
      add(out, `household member ${member} first name middle initial`, parts[2]);
      add(out, `household member ${member} relationship`, parts[3]);
      add(out, `household member ${member} date of birth`, parts[4]);
      add(out, `household member ${member} full-time student`, parts[5]);
      add(out, `household member ${member} ssn alien registration`, parts[6]);
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
  for (const row of clusterRows(body, table.start, table.end, pageHeight)) {
    const parts = splitColumns(row.words, extent, boundaries);
    const text = usefulRowText(parts);
    if (!text || /\btotal\b/.test(text) || isHeaderOrNote(text)) continue;
    const member = explicitMemberNumber(parts[0], 10);
    if (!member) continue;
    if (!parts.slice(1).some((value) => /\d/.test(value))) continue;
    add(out, `income member ${member} employment or wages`, parts[1]);
    add(out, `income member ${member} social security pensions`, parts[2]);
    add(out, `income member ${member} public assistance`, parts[3]);
    add(out, `income member ${member} other income`, parts[4]);
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
  for (const row of clusterRows(body, table.start, table.end, pageHeight)) {
    const parts = splitColumns(row.words, extent, boundaries);
    const text = usefulRowText(parts);
    if (!text || /\b(total|threshold|imputed income threshold)\b/.test(text) || isHeaderOrNote(text)) continue;
    const member = explicitMemberNumber(parts[0], 27);
    if (!member) continue;
    if (!parts.slice(1).some(Boolean)) continue;
    add(out, `asset ${member} household member number`, parts[0]);
    add(out, `asset ${member} type`, parts[1]);
    if (profile === 'phfa') {
      add(out, `asset ${member} current disposed`, parts[2]);
      add(out, `asset ${member} category`, parts[3]);
      add(out, `asset ${member} cash value`, parts[4]);
      add(out, `asset ${member} income method`, parts[5]);
      add(out, `asset ${member} annual income`, parts[6]);
    } else {
      add(out, `asset ${member} current disposed`, parts[2]);
      add(out, `asset ${member} cash value`, parts[3]);
      add(out, `asset ${member} annual income`, parts[4]);
    }
  }
  return out;
}

/**
 * Recover row/cell values from flattened TIC pages using OCR geometry.
 * This never invents values: only words already returned by Tesseract are
 * reassigned to deterministic TIC row/column aliases.
 */
export function extractTicSpatialValueLines(blocks, suppliedWidth, suppliedHeight) {
  const { words, lines } = flattenBlocks(blocks);
  if (!words.length || !lines.length) return [];
  const width = Number(suppliedWidth) > 0 ? Number(suppliedWidth) : Math.max(...words.map((word) => word.x1));
  const height = Number(suppliedHeight) > 0 ? Number(suppliedHeight) : Math.max(...words.map((word) => word.y1));
  const pageText = normalizedText(lines.map((line) => line.text).join(' '));
  if (!/tenant income certification/.test(pageText)) return [];

  const householdTable = locateHouseholdTable(lines, height);
  const householdHeaderText = normalizedText(householdTable?.header?.text ?? '');
  const profile = /\brace\b|\bethn\b|\bdsbs\b|\bgndr\b|\bethnicity\b|\bdisability\b/.test(householdHeaderText)
    ? 'phfa'
    : 'legacy';
  const incomeTable = locateIncomeTable(lines, height);
  const assetTable = locateAssetTable(lines, height);

  return [
    ...householdLines(words, householdTable, width, height, profile),
    ...incomeLines(words, incomeTable, width, height),
    ...assetLines(words, assetTable, width, height, profile),
  ];
}
