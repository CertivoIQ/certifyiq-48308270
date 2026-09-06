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

export function isTicContent(text) {
  const normalized = compact(text);
  if (/^(?:tenant\s+income\s+certification\s*[:\u2013\u2014-]?\s*)?instructions\s+(?:for\s+)?(?:completing|to\s+complete)/i.test(normalized)) return false;
  const headingLines = String(text ?? '').split(/\r?\n/).map(compact);
  if (headingLines.slice(0, 8).some(line => /^(?:instructions\s+(?:for\s+)?(?:completing|to\s+complete)|tenant\s+income\s+certification\s*[-:–—]?\s*instructions)\b/i.test(line))) return false;
  if (headingLines.some(line => /^tenant\s+income\s+certification\b/i.test(line))) return true;
  const sections = [/part\s+ii\b.*household\s+composition/i, /part\s+iii\b.*gross\s+annual\s+income/i,
    /part\s+iv[a-b]?\b.*income\s+from\s+assets/i, /part\s+v\b.*total\s+household\s+income/i,
    /last\s+name.*first\s+name.*(?:birth|relationship)/i, /type\s+of\s+asset.*cash\s+value/i,
    /part\s+vi\b.*determination\s+of\s+income\s+eligibility/i,
    /part\s+vii\b.*rent/i, /part\s+viii\b.*student/i, /part\s+ix\b.*program\s+type/i];
  return sections.filter(pattern => pattern.test(normalized)).length >= 2;
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
  for (const item of items ?? []) {
    if (typeof item?.str !== 'string' || !item.str.trim() || !Array.isArray(item.transform)) continue;
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

/** Exact cents arithmetic for review worksheets; a blank is never zero. */
export function amountCents(raw) {
  const value = compact(raw).replace(/^\$\s*/, '');
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter an explicit nonnegative amount with at most two decimal places.');
  const [whole, fraction = ''] = value.replace(/,/g, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds supported precision.');
  return cents;
}
export function centsText(cents) { return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`; }
export function sumAmounts(values) { if (!values.length) throw new Error('No amounts supplied.'); return centsText(values.reduce((sum, v) => sum + amountCents(v), 0n)); }

/** Arithmetic proposal only. The reviewer chooses and cites the applicable projection policy. */
export function projectGrossPay({ amounts, frequency, policyRef }) {
  if (!compact(policyRef)) throw new Error('Record the applicable calculation policy before projecting income.');
  const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[frequency];
  if (!periods) throw new Error('Confirm pay frequency; it cannot be inferred from the amount.');
  if (!Array.isArray(amounts) || !amounts.length) throw new Error('Enter gross pay for each distinct, representative pay period.');
  const total = amounts.reduce((sum, amount) => sum + amountCents(amount), 0n);
  const divisor = BigInt(amounts.length);
  const annual = (total * BigInt(periods) + divisor / 2n) / divisor;
  return { annual: centsText(annual), formula: `(${amounts.map(compact).join(' + ')}) / ${amounts.length} × ${periods}`, policyRef: compact(policyRef), status: 'PROPOSAL_ONLY' };
}

/** Reconcile annual TIC rows; blank active cells block, and asset principal is separate. */
export function calculateTicSums(values) {
  const proposals = {};
  const blockers = [];
  const categories = ['wages_business', 'social_security_pension', 'public_assistance', 'other_income'];
  const totals = ['total_employment_income', 'total_social_security_pensions', 'total_public_assistance', 'total_other_income'];
  const income = [];
  for (let row = 1; row <= 10; row++) {
    const prefix = `income_member_${row}_`;
    if (!['household_member_number', ...categories].some(key => compact(values[prefix + key]))) continue;
    if (!/^(?:10|[1-9])$/.test(compact(values[prefix + 'household_member_number']))) blockers.push(`Income row ${row}: confirm the household member number.`);
    try { income.push(categories.map(key => amountCents(values[prefix + key]))); }
    catch { blockers.push(`Income row ${row}: all four annual-income amounts require a number or an explicit zero.`); }
  }
  if (income.length && !blockers.length) {
    const sums = categories.map((_, column) => income.reduce((total, row) => total + row[column], 0n));
    totals.forEach((key, column) => { proposals[key] = centsText(sums[column]); });
    proposals.total_income_e = centsText(sums.reduce((total, value) => total + value, 0n));
  }
  const assets = [];
  const assetBlockerStart = blockers.length;
  for (let row = 1; row <= 27; row++) {
    const prefix = `asset_${row}_`;
    if (!['household_member_number', 'type', 'cash_value', 'annual_income'].some(key => compact(values[prefix + key]))) continue;
    if (!/^(?:10|[1-9])$/.test(compact(values[prefix + 'household_member_number']))) blockers.push(`Asset row ${row}: confirm the household member number.`);
    try { assets.push([amountCents(values[prefix + 'cash_value']), amountCents(values[prefix + 'annual_income'])]); }
    catch { blockers.push(`Asset row ${row}: cash value and annual asset income must be explicit; an account balance is not income.`); }
  }
  if (assets.length && blockers.length === assetBlockerStart) {
    proposals.total_asset_cash_value = centsText(assets.reduce((sum, row) => sum + row[0], 0n));
    proposals.total_asset_annual_income = centsText(assets.reduce((sum, row) => sum + row[1], 0n));
  }
  return { proposals, blockers, status: 'PROPOSAL_ONLY' };
}
