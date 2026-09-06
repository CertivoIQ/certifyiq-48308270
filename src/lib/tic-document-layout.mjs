// TIC_RECOGNITION_HARDENING_V1
/** TIC intake proposals only. No inferred verification, approval, or eligibility. */
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const checked = /^(?:\[\s*x\s*\]|☒|☑|✓|✔|■|x)$/i;
const certificationTypes = ['Initial Certification', 'Recertification', 'Other'];

export function selectedCertificationType(text) {
  const candidates = new Set();
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (line.startsWith('__CERTIVOIQ_TIC_FIELD__')) continue;
    // A mark between labels belongs to the FOLLOWING label; never to both.
    const marked = [...line.matchAll(/(\[\s*x\s*\]|\[\s*\]|☒|☑|☐|□|✓|✔|■|\bx\b)\s*(initial\s+certification|recertification|other)\b/gi)];
    for (const match of marked) {
      if (checked.test(match[1])) candidates.add(certificationTypes.find(v => v.toLowerCase() === compact(match[2]).toLowerCase()));
    }
    if (marked.length) continue;
    const explicit = /^\s*(?:certification\s+type\s*[:=]\s*)?(initial\s+certification|recertification|other)\s*(?:[:=]\s*)?(\[\s*x\s*\]|☒|☑|✓|✔|■|x)?\s*$/i.exec(line);
    if (explicit && (explicit[2] || /^\s*certification\s+type\s*[:=]/i.test(line))) {
      candidates.add(certificationTypes.find(v => v.toLowerCase() === compact(explicit[1]).toLowerCase()));
    }
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

/** A narrative checklist or cover letter is not a TIC even when it mentions its fields. */
export function administrativePageLabel(text) {
  const head = String(text ?? '').split(/\r?\n/).filter(line => !line.startsWith('__CERTIVOIQ_')).slice(0, 14).join(' ');
  if (/\b(?:instructions\s+(?:for\s+)?(?:completing|to\s+complete)|tenant\s+income\s+certification\s*[-:–—]?\s*instructions)\b/i.test(head)) return 'TIC instructions';
  if (/\b(?:cover\s*(?:page|sheet|letter)|fax\s*(?:transmittal|cover)|transmittal\s*(?:page|sheet|letter))\b/i.test(head)) return 'Cover / transmittal page';
  if (/\b(?:sample\s+findings|review\s+findings|reviewer[’\x27]?s?\s+notes|review\s+(?:checklist|summary)|file\s+review\s+(?:report|summary)|income\s+limits?\s+applicable\s+to\s+certification)\b/i.test(head)) return 'Review notes / administrative page';
  return null;
}

export function isTicContent(text) {
  if (administrativePageLabel(text)) return false;
  const lines = String(text ?? '').split(/\r?\n/).filter(line => !line.startsWith('__CERTIVOIQ_')).map(compact);
  const normalized = compact(lines.join(' '));
  const sections = [/part\s+i\b.{0,25}development\s+data/i, /part\s+ii\b.{0,25}household\s+composition/i,
    /part\s+iii\b.{0,25}(?:gross\s+)?annual\s+income/i, /part\s+iv[a-b]?\b.{0,25}(?:income\s+from\s+)?assets/i,
    /part\s+v\b.{0,25}total\s+household\s+income/i, /part\s+vi\b.{0,25}determination\s+of\s+income\s+eligibility/i,
    /part\s+vii\b.{0,10}rent/i, /part\s+viii\b.{0,10}student/i, /part\s+ix\b.{0,10}program\s+type/i];
  const count = sections.filter(pattern => pattern.test(normalized)).length;
  const title = lines.some(line => /^tenant\s+income\s+certification(?:\s*\([^)]*\))?\s*$/i.test(line));
  const header = /tenant\s+income\s+certification/i.test(normalized.slice(0, 1500));
  const cells = /last\s+name.{0,50}first\s+name/i.test(normalized) || /type\s+of\s+asset.{0,100}cash\s+value/i.test(normalized);
  const supplemental = (/annual income calculation worksheet/i.test(normalized) && /relationship/i.test(normalized) && /description/i.test(normalized))
    || (/rental application/i.test(normalized) && /household information/i.test(normalized) && /housing information/i.test(normalized))
    || (/personal references/i.test(normalized) && /household income/i.test(normalized) && /other income/i.test(normalized))
    || (/asset information/i.test(normalized) && /adjustments to income/i.test(normalized) && /other information/i.test(normalized))
    || (/full custody/i.test(normalized) && /automobiles/i.test(normalized) && /bankruptcy/i.test(normalized))
    || (/head of household/i.test(normalized) && /adult household member/i.test(normalized) && /ethnicity/i.test(normalized));
  return supplemental || title || count >= 2 || (header && count >= 1 && cells);
}

export function strictMappedValue(type, raw, key = '') {
  const value = compact(raw);
  if (!value || value.length > 500) return null;
  if (key === 'certification_type') return certificationTypes.find(v => v.toLowerCase() === value.toLowerCase()) ?? null;
  if (type === 'currency' || type === 'number') {
    const accounting = /^\(.*\)$/.test(value);
    const cleaned = (accounting ? value.slice(1, -1) : value).replace(/^\$\s*/, '').replace(/%$/, '').trim();
    if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(cleaned)) return null;
    const amount = Number(cleaned.replace(/,/g, '')) * (accounting ? -1 : 1);
    return Number.isFinite(amount) && Math.abs(amount) <= Number.MAX_SAFE_INTEGER ? amount : null;
  }
  if (type === 'date') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!iso && !us) return null;
    const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [Number(us[3]), Number(us[1]), Number(us[2])];
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
  }
  if (type === 'yes_no') {
    if (/^(?:yes|y|true)$/i.test(value)) return 'Yes';
    if (/^(?:no|n|false)$/i.test(value)) return 'No';
    return null;
  }
  // Exact source cell values must NOT be stripped as neighboring form labels.
  return value;
}

/** Preserve native PDF coordinates for the existing spatial table reader. */
export function nativePdfLayout(items, viewport) {
  const words = [];
  if (Number(viewport.rotation ?? 0) % 360 !== 0) return { text: "", blocks: [] };
  for (const item of items ?? []) {
    if (typeof item?.str !== 'string' || !item.str.trim() || !Array.isArray(item.transform)) continue;
    if (Math.abs(Number(item.transform[1]) || 0) > 0.1 || Math.abs(Number(item.transform[2]) || 0) > 0.1) continue;
    const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const scale = Math.abs(Number(viewport.scale) || 1);
    const height = Math.max(1, Math.abs(Number(item.height) || Number(item.transform[3]) || 10) * scale);
    const width = Math.abs(Number(item.width) || 0) * scale;
    if (![x, baseline, width, height].every(Number.isFinite) || !width) continue;
    for (const token of item.str.matchAll(/\S+/g)) {
      const x0 = x + width * token.index / item.str.length;
      const x1 = x + width * (token.index + token[0].length) / item.str.length;
      words.push({ text: token[0], bbox: { x0, x1, y0: baseline - height, y1: baseline } });
    }
  }
  const rows = [];
  for (const word of words.sort((a, b) => a.bbox.y1 - b.bbox.y1 || a.bbox.x0 - b.bbox.x0)) {
    const last = rows.at(-1);
    const tolerance = Math.max(2, (word.bbox.y1 - word.bbox.y0) * 0.3);
    if (!last || Math.abs(last.baseline - word.bbox.y1) > tolerance) rows.push({ baseline: word.bbox.y1, words: [word] });
    else last.words.push(word);
  }
  const lines = rows.map(row => {
    const ordered = row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return { text: ordered.map(word => word.text).join(' '), words: ordered, bbox: {
      x0: Math.min(...ordered.map(word => word.bbox.x0)), x1: Math.max(...ordered.map(word => word.bbox.x1)),
      y0: Math.min(...ordered.map(word => word.bbox.y0)), y1: Math.max(...ordered.map(word => word.bbox.y1)),
    } };
  });
  return { text: lines.map(line => line.text).join('\n'), blocks: [{ paragraphs: [{ lines }] }] };
}


