import { FREQUENCIES, newInput, newJob, newLine, newStub, evaluate, validDate, type Frequency } from '../../supabase/functions/_shared/income-calculator-engine';
import type { PacketPageChoice } from './tic-packet-selection';

export const INCOME_PREPARATION_VERSION = 'certification-income/1';
export const INCOME_DOCUMENT_TYPES = new Set(['check_stub', 'employment_verification', 'bank_statement', 'other_income', 'zero_income_certification']);
export type IncomeRow = {
  id: string; page: number; kind: 'wages' | 'other' | 'asset' | 'exclude';
  member: string; sourceName: string; amount: string; frequency: Frequency | '';
  periodStart: string; periodEnd: string; weeks: string; annualAdjustment: string; note: string;
};
export type IncomeDraft = { version: string; sourceSha256: string; selectionDigest: string; effectiveDate: string; rows: IncomeRow[]; confirmed: boolean; zeroIncome: boolean };
export type IncomePage = { page: number; type: string; reference: string; excerpt: string };
export type IncomePreparation = { draft: IncomeDraft; pages: IncomePage[] };
export type IncomeCalculation = { version: string; annualIncome: string | null; issues: string[]; rows: { id: string; annual: string | null; basis: string }[]; status: 'Pending full certification review' };
const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
const key = (s: string) => clean(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const canonical = (v: unknown): string => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
const amountPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})';

// Only explicit, labelled current-period amounts are proposed. Balances, net pay,
// deposits and YTD figures are never substitutes for current gross income.
function labelledAmount(text: string, labels: string): string {
  const matches = [...text.matchAll(new RegExp('(?:^|\\n)[ \\t]*(?:' + labels + ')[ \\t]*[:$]?[ \\t]*\\$?[ \\t]*(' + amountPattern + ')(?=\\s|$)', 'gim'))];
  const values = [...new Set(matches.filter(m => {
    const tail = text.slice(m.index! + m[0].length).split('\n')[0]!.split(/\b(?:YTD|year to date|net pay)\b/i)[0]!;
    return !/\d/.test(tail); // An unlabeled second numeric column is ambiguous.
  }).map(m => m[1]!.replaceAll(',', '')))];
  return values.length === 1 ? values[0]! : '';
}
function labelledText(text: string, labels: string): string {
  const matches = [...text.matchAll(new RegExp('(?:^|\\n)\\s*(?:' + labels + ')(?:[ \\t]*[:=][ \\t]*|[ \\t]+)([^\\n]{2,160})', 'gim'))];
  const values = [...new Set(matches.map(m => clean(m[1]!)))];
  return values.length === 1 ? values[0]! : '';
}
function frequency(text: string): Frequency | '' {
  const line = labelledText(text, 'pay frequency|payment frequency|pay cycle|frequency|payment schedule|pay schedule').replace(/\s*\(\d+[^)]*\)\s*$/, '');
  const candidates: Frequency[] = [];
  if (/^(?:bi[ -]?weekly|every (?:two|2) weeks|26 (?:pay )?periods)$/i.test(line)) candidates.push('BIWEEKLY');
  if (/^(?:semi[ -]?monthly|twice (?:a |per )?month(?:ly)?|24 (?:pay )?periods)$/i.test(line)) candidates.push('SEMIMONTHLY');
  if (/^(?:weekly|every week)$/i.test(line)) candidates.push('WEEKLY');
  if (/^(?:monthly|every month)$/i.test(line)) candidates.push('MONTHLY');
  if (/^(?:annual(?:ly)?|yearly|per year)$/i.test(line)) candidates.push('ANNUAL');
  return candidates.length === 1 ? candidates[0]! : '';
}
function date(text: string): string {
  if (validDate(text)) return text;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const value = m ? `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}` : '';
  return validDate(value) ? value : '';
}
export function buildIncomePreparation(pages: { page: number; text: string }[], choices: PacketPageChoice[], sourceSha256: string, selectionDigest: string, effectiveDate = ''): IncomePreparation {
  const selected = choices.filter(c => INCOME_DOCUMENT_TYPES.has(c.role));
  const incomePages: IncomePage[] = [];
  const rows: IncomeRow[] = [];
  for (const choice of selected) {
    const text = (pages.find(p => p.page === choice.page)?.text ?? '').replace(/^\s*(?:FIELD|CELL|BOUNDS|UNRESOLVED)[^\n]*$/gm, '');
    incomePages.push({ page: choice.page, type: choice.role, reference: `Original packet page ${choice.page}`, excerpt: text.slice(0, 2200) });
    const wages = ['check_stub', 'employment_verification'].includes(choice.role);
    const bank = choice.role === 'bank_statement';
    const amount = wages ? labelledAmount(text, '(?:current |this period )?gross (?:pay|earnings|wages)(?: this period)?|total gross pay|total current earnings')
      : bank ? labelledAmount(text, '(?:current |this period )?interest (?:earned|paid|credited)(?: this (?:period|month|statement))?|interest this period')
      : labelledAmount(text, '(?:gross |monthly |annual )?(?:benefit|pension|annuity|child support|alimony|unemployment|income) amount|gross monthly (?:benefit|amount)|monthly (?:benefit|payment)|net business income|net self.employment income');
    let freq = frequency(text);
    if (!freq && /(?:^|\n)\s*(?:gross )?monthly (?:(?:benefit|pension|income)(?: amount)?|payment|amount)\s*[:$\d]/i.test(text)) freq = 'MONTHLY';
    if (!freq && /(?:^|\n)\s*annual (?:benefit|pension|income) amount\s*:/i.test(text)) freq = 'ANNUAL';
    const period = labelledText(text, 'pay period|statement period');
    const range = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to|through|[-–])\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/i.exec(period);
    const periodStart = range ? date(range[1]!) : date(labelledText(text, 'pay period (?:start|begin|beginning)|period (?:start|beginning)|statement start'));
    const periodEnd = range ? date(range[2]!) : date(labelledText(text, 'pay period (?:end|ending)|period (?:end|ending)|statement end'));
    if (bank && !freq && validDate(periodStart) && validDate(periodEnd) && periodStart.slice(0, 7) === periodEnd.slice(0, 7) && periodStart.endsWith('-01') && new Date(Date.parse(periodEnd) + 86400000).getUTCDate() === 1) freq = 'MONTHLY';
    rows.push({ id: `income-page-${choice.page}`, page: choice.page, kind: wages ? 'wages' : bank ? 'asset' : 'other',
      member: labelledText(text, 'employee name|employee|recipient name|beneficiary|account holder|household member'),
      sourceName: labelledText(text, 'employer name|employer|income source|benefit provider|bank name') || (bank ? 'Account interest' : ''),
      amount, frequency: freq, periodStart, periodEnd,
      weeks: wages ? '52' : '', annualAdjustment: '0', note: bank ? 'Use interest income only. Identify transfers, returned funds and payroll already counted elsewhere before including any deposits.' : '' });
  }
  return { pages: incomePages, draft: { version: INCOME_PREPARATION_VERSION, sourceSha256, selectionDigest, effectiveDate: date(effectiveDate), rows, confirmed: false, zeroIncome: false } };
}
export function assertIncomeDraft(value: unknown): asserts value is IncomeDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Complete the Income Calculator before reviewing the certification.');
  const d = value as IncomeDraft;
  if (d.version !== INCOME_PREPARATION_VERSION || !/^[a-f0-9]{64}$/i.test(d.sourceSha256) || !/^[a-f0-9]{64}$/i.test(d.selectionDigest) || typeof d.effectiveDate !== 'string' || typeof d.confirmed !== 'boolean' || typeof d.zeroIncome !== 'boolean' || !Array.isArray(d.rows) || d.rows.length > 200) throw new Error('Invalid income preparation. Reopen the calculator.');
  const ids = new Set<string>();
  for (const row of d.rows) {
    if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.page) || row.page < 1 || !['wages', 'other', 'asset', 'exclude'].includes(row.kind) || !['', ...Object.keys(FREQUENCIES)].includes(row.frequency)) throw new Error('Invalid income evidence row.');
    for (const f of ['id', 'member', 'sourceName', 'amount', 'periodStart', 'periodEnd', 'weeks', 'annualAdjustment', 'note'] as const) if (typeof row[f] !== 'string' || row[f].length > 1000) throw new Error('Invalid income evidence value.');
    if (!row.id || ids.has(row.id)) throw new Error('Duplicate income row.');
    ids.add(row.id);
  }
}
export function calculateIncomePreparation(draft: IncomeDraft, pages: IncomePage[], requireConfirmation = false): IncomeCalculation {
  assertIncomeDraft(draft);
  const issues: string[] = [];
  const rows: IncomeCalculation['rows'] = [];
  const input = newInput(); input.effectiveDate = draft.effectiveDate;
  if (!validDate(draft.effectiveDate)) issues.push('Enter the certification effective date.');
  if (!pages.length) issues.push('Include income evidence in the document selection, including zero-income evidence when applicable.');
  for (const page of pages) if (!draft.rows.some(r => r.page === page.page)) issues.push(`Page ${page.page}: include an income entry or explain why it is not counted.`);
  const jobs = new Map<string, ReturnType<typeof newJob>>();
  const recurring = new Set<string>();
  for (const row of draft.rows) {
    const page = pages.find(p => p.page === row.page);
    const prefix = `Page ${row.page}`;
    if (!page) { issues.push(`${prefix}: this page is not selected income evidence.`); continue; }
    if (row.kind === 'exclude') {
      if (row.note.trim().length < 8) issues.push(`${prefix}: explain why this evidence is not counted (for example, duplicate payroll deposit or account principal).`);
      rows.push({ id: row.id, annual: null, basis: `Not counted: ${row.note}` }); continue;
    }
    if (page.type === 'zero_income_certification') { issues.push(`${prefix}: zero-income evidence cannot be used as a positive income source.`); continue; }
    if (page.type === 'bank_statement' && row.kind === 'wages') issues.push(`${prefix}: a bank deposit is not gross payroll evidence.`);
    if (page.type === 'bank_statement' && row.kind === 'other' && row.note.trim().length < 12) issues.push(`${prefix}: explain the deposit source and why it is income not counted elsewhere.`);
    if (!row.member.trim() || !row.sourceName.trim()) issues.push(`${prefix}: identify the household member and income source.`);
    if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(row.amount)) issues.push(`${prefix}: enter a supported amount; blanks are not zero.`);
    if (!row.frequency) { issues.push(`${prefix}: confirm the payment frequency. Biweekly and twice monthly are different.`); continue; }
    if (!validDate(row.periodStart) || !validDate(row.periodEnd) || row.periodStart > row.periodEnd || (validDate(draft.effectiveDate) && row.periodEnd >= draft.effectiveDate)) issues.push(`${prefix}: enter the evidence period before the certification effective date.`);
    const reference = `${draft.sourceSha256}#page-${row.page}`;
    const group = `${key(row.member)}:${key(row.sourceName)}`;
    if (row.kind === 'wages') {
      if (validDate(row.periodStart) && validDate(row.periodEnd)) {
        const days = (Date.parse(row.periodEnd) - Date.parse(row.periodStart)) / 86400000 + 1;
        const ranges = { WEEKLY: [7, 7], BIWEEKLY: [14, 14], SEMIMONTHLY: [13, 16], MONTHLY: [28, 31], ANNUAL: [365, 366] };
        const [min, max] = ranges[row.frequency];
        if (days < min! || days > max!) issues.push(`${prefix}: dates do not describe a complete ${row.frequency.toLowerCase()} pay period. Confirm the dates and frequency.`);
      }
      if (!/^\d{1,2}(?:\.\d{1,6})?$/.test(row.weeks) || Number(row.weeks) > 52 || Number(row.weeks) <= 0) issues.push(`${prefix}: confirm expected paid weeks in the coming year (more than 0 and at most 52).`);
      let job = jobs.get(group);
      if (!job) { job = { ...newJob(group), member: row.member, employer: row.sourceName, mode: 'STUB_AVERAGE', frequency: row.frequency, weeks: row.weeks, adjustment: row.annualAdjustment, changeSource: row.note, source: reference, reviewed: true }; jobs.set(group, job); }
      if (job.frequency !== row.frequency || job.weeks !== row.weeks || job.adjustment !== row.annualAdjustment) issues.push(`${prefix}: the same job has conflicting frequency, expected weeks or annual adjustment.`);
      job.stubs.push({ ...newStub(row.id), start: row.periodStart, end: row.periodEnd, gross: row.amount, source: reference, reviewed: true, completePeriod: true });
    } else {
      if (recurring.has(group) || jobs.has(group)) issues.push(`${prefix}: this member/source is already counted. Use one representative recurring amount and explain corroborating pages.`);
      recurring.add(group);
      const line = { ...newLine(row.id), member: row.member, label: row.sourceName, amount: row.amount, frequency: row.frequency, source: reference, reviewed: true };
      // Asset receipts are annualized as a draft evidence amount here. Program-specific
      // asset treatment and any imputation remain part of the full certification review.
      input.otherIncome.push(line);
      const single = newInput(); single.otherIncome = [line];
      rows.push({ id: row.id, annual: evaluate(single, [], { requireSavedHousehold: false }).prospectiveAnnual, basis: `${row.amount} × ${FREQUENCIES[row.frequency]} payments/year` });
    }
  }
  for (const [group, job] of jobs) { if (recurring.has(group)) issues.push(`${job.employer}: wages and another entry identify the same source.`); input.jobs.push(job); }
  const result = evaluate(input, [], { requireSavedHousehold: false });
  for (const r of result.jobResults) { const j = jobs.get(r.id)!; issues.push(...r.issues.map(i => `${j.employer}: ${i}`)); rows.push({ id: r.id, annual: r.annual, basis: `Average gross of ${j.stubs.length} complete pay period(s) × ${FREQUENCIES[j.frequency]} × ${j.weeks}/52 expected paid weeks. Pages ${j.stubs.map(s => s.source.split('#page-')[1]).join(', ')}.` }); }
  const active = draft.rows.filter(r => r.kind !== 'exclude');
  if (!active.length && !(draft.zeroIncome && pages.some(p => p.type === 'zero_income_certification'))) issues.push('No income sources are counted. Document and confirm zero income, or add the missing income evidence.');
  if (draft.zeroIncome && active.length) issues.push('Zero-income confirmation conflicts with included income rows.');
  if (requireConfirmation && !draft.confirmed) issues.push('Confirm the income sources, complete pay periods, payment frequencies, expected changes and excluded duplicates before continuing.');
  return { version: INCOME_PREPARATION_VERSION, annualIncome: issues.length ? null : result.prospectiveAnnual, issues: [...new Set(issues)], rows, status: 'Pending full certification review' };
}
export function validateIncomePreparation(value: unknown, current: IncomePreparation): { draft: IncomeDraft; calculation: IncomeCalculation } {
  assertIncomeDraft(value);
  if (value.sourceSha256 !== current.draft.sourceSha256 || value.selectionDigest !== current.draft.selectionDigest) throw new Error('Income evidence changed. Recalculate using the current packet selection.');
  const calculation = calculateIncomePreparation(value, current.pages, true);
  if (calculation.annualIncome === null || calculation.issues.length) throw new Error(calculation.issues.join(' ') || 'Annual income could not be calculated.');
  return { draft: value, calculation };
}

export function savedIncomePreparation(history: unknown, sourceSha256: string, selectionDigest: string, choices: PacketPageChoice[]) {
  const entries = Array.isArray(history) ? history.filter(e => e && typeof e === 'object' && e.type === 'tic_pre_save_confirmation') : [];
  const entry = entries.at(-1);
  if (!entry?.income_preparation_version) return null; // Historical intakes retain their original review contract.
  if (entry.income_preparation_version !== INCOME_PREPARATION_VERSION || !entry.income_preparation) throw new Error('Income preparation is missing or uses an unsupported version.');
  const current = buildIncomePreparation([], choices, sourceSha256, selectionDigest);
  const checked = validateIncomePreparation(entry.income_preparation.draft, current);
  if (canonical(checked.calculation) !== canonical(entry.income_preparation.calculation)) throw new Error('The saved income calculation changed. Recalculate before review.');
  return checked;
}
