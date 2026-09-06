/** Source-bound proposals. A supporting amount is never a compliance determination. */
import { strictMappedValue, amountCents, centsText, projectGrossPay } from './tic-cell-repair.mjs';
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const identity = value => clean(value).toLowerCase();
const date = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4})';
const money = '(?:\\$\\s*)?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';

function readLabel(lines, pattern, type, field, page, confidence, issues) {
  const found = new Map();
  for (let i = 0; i < lines.length; i++) {
    const match = pattern.exec(lines[i]);
    if (!match) continue;
    const raw = clean(match[1]);
    const value = type === 'text' ? (raw || null) : strictMappedValue(type, raw, field);
    if (value === null) continue;
    found.set(String(value), { value: String(value), page, snippet: lines[i].slice(0, 300), confidence });
  }
  if (found.size > 1) { issues.push(`${field}: conflicting source values; enter the correct value after reviewing the page.`); return null; }
  return found.size === 1 ? [...found.values()][0] : null;
}

/** Conservative label-based extraction. Unsupported or ambiguous layouts remain editable, not guessed. */
export function extractSupportingEvidence(pages, classifications, source, provenance = new Map()) {
  const byPage = new Map((classifications ?? []).map(item => [item.page, item]));
  const output = [];
  for (const page of pages ?? []) {
    const classification = byPage.get(page.page);
    const kind = classification?.documentType;
    if (classification?.kind !== 'supporting' || !['check_stub', 'bank_statement'].includes(kind)) continue;
    const lines = String(page.text ?? '').split(/\r?\n/).map(clean).filter(Boolean);
    const confidence = Math.min(0.9, Number(provenance.get(page.page)?.confidence ?? 0.85));
    const fields = {}, issues = [];
    function read(key, pattern, type = 'text') {
      const result = readLabel(lines, pattern, type, key, page.page, confidence, issues);
      if (result) fields[key] = result;
    }
    read('period_end', new RegExp(`^(?:(?:pay|statement)\\s+period\\s+(?:end(?:ing)?|to)|period\\s+ending|statement\\s+date)\\s*[:=]?\\s*(${date})\\s*$`, 'i'), 'date');
    read('period_start', new RegExp(`^(?:(?:pay|statement)\\s+period\\s+(?:start(?:ing)?|from)|period\\s+beginning)\\s*[:=]?\\s*(${date})\\s*$`, 'i'), 'date');
    read('frequency', /^(?:pay|payment|statement)\s+frequency\s*[:=]\s*(weekly|bi[- ]?weekly|every two weeks|semi[- ]?monthly|twice monthly|monthly)\s*$/i);
    if (kind === 'check_stub') {
      read('owner', /^(?:employee(?:\s+name)?|name\s+of\s+employee)\s*[:=]\s*(.{1,160})$/i);
      read('institution', /^(?:employer(?:\s+name)?|company(?:\s+name)?)\s*[:=]\s*(.{1,160})$/i);
      read('gross_pay', new RegExp(`^(?:(?:current|this\\s+period)\\s+)?(?:gross\\s+(?:pay|earnings)|total\\s+gross)(?:\\s*\\((?:current|this\\s+period)\\))?\\s*[:=]?\\s*(${money})(?:\\s+(?:net\\s+pay|deductions)\\s*[:=].*)?$`, 'i'), 'currency');
      if (!fields.gross_pay) issues.push('Current-period gross pay was not unambiguously extracted. Net pay and year-to-date totals were not substituted.');
    } else {
      read('owner', /^(?:account\s+(?:holder|owner)(?:\s+name)?|customer\s+name)\s*[:=]\s*(.{1,160})$/i);
      read('institution', /^(?:bank(?:\s+name)?|financial\s+institution)\s*[:=]\s*(.{1,160})$/i);
      read('account_last4', /^(?:account(?:\s+(?:number|no\.?))?|acct\.?)(?:\s*#)?\s*[:=]\s*(?:[\dXx*• -]*?)(\d{4})\s*$/i);
      read('closing_balance', new RegExp(`^(?:ending|closing|new)\\s+balance\\s*[:=]?\\s*(${money})\\s*$`, 'i'), 'currency');
      read('average_balance', new RegExp(`^average\\s+(?:daily\\s+)?balance\\s*[:=]?\\s*(${money})\\s*$`, 'i'), 'currency');
      read('period_interest', new RegExp(`^(?:interest\\s+(?:earned|paid)\\s+(?:this|for\\s+this)\\s+(?:period|month)|(?:current|this\\s+period)\\s+interest)\\s*[:=]?\\s*(${money})\\s*$`, 'i'), 'currency');
      if (!fields.closing_balance && !fields.average_balance) issues.push('No unambiguous statement balance was extracted.');
      if (!fields.period_interest) issues.push('Current-period interest was not extracted; deposits and account principal are not asset income.');
    }
    if (!fields.period_end) issues.push('Confirm the period end date; no date was inferred from the filename.');
    if (!fields.owner || !fields.institution) issues.push('Confirm the account/employee owner and institution before grouping documents.');
    output.push({ id: `${kind}:${page.page}`, kind, page: page.page, sourceDocumentRef: source.fileName, sourceSha256: source.sha256, fields, issues, status: 'PROPOSAL_ONLY' });
  }
  return output;
}

export function resolveReviewCertificationType(values) {
  const type = identity(values?.certification_type);
  if (type === 'initial certification') return 'INITIAL';
  if (type === 'recertification') return 'ANNUAL';
  if (type === 'other' && ['INITIAL', 'ANNUAL', 'INTERIM'].includes(values?.other_certification_review_action)) return values.other_certification_review_action;
  return null;
}

/** Used both in the browser and by the authenticated save handler. */
export function calculateSupportingProposal(input) {
  if (!input || !['wages', 'bank_interest'].includes(input.kind)) throw new Error('Select a supported calculation.');
  if (!clean(input.policyRef) || clean(input.policyRef).length > 500) throw new Error('Record the applicable calculation policy.');
  if (!clean(input.reason) || clean(input.reason).length > 500) throw new Error('Enter a correction reason.');
  if (input.reviewConfirmed !== true) throw new Error('Confirm source amounts, household ownership and the calculation policy.');
  const row = Number(input.destinationRow);
  if (!Number.isInteger(row) || row < 1 || row > (input.kind === 'wages' ? 10 : 27)) throw new Error('Select a valid destination row.');
  if (!Array.isArray(input.records) || !input.records.length || input.records.length > 50) throw new Error('Select between 1 and 50 evidence records.');
  const seenIds = new Set(), seenPeriods = new Set(), parties = new Set();
  for (const record of input.records) {
    if (!clean(record.evidenceId) || seenIds.has(record.evidenceId)) throw new Error('A source page is selected more than once.');
    seenIds.add(record.evidenceId);
    const period = strictMappedValue('date', record.periodEnd);
    if (!period) throw new Error('Confirm a valid four-digit-year period end for every source.');
    const p = /^\d{4}-/.test(period) ? period : (() => { const [m,d,y] = period.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; })();
    if (seenPeriods.has(p)) throw new Error('Duplicate period end dates must be resolved; continuation pages cannot count as another payment.');
    seenPeriods.add(p);
    if (!clean(record.owner) || !clean(record.institution)) throw new Error('Confirm the owner/employee and employer/bank on every selected source.');
    if (clean(record.owner).length > 160 || clean(record.institution).length > 160) throw new Error('Owner and institution names must be 160 characters or fewer.');
    const account = input.kind === 'bank_interest' ? clean(record.accountLast4) : '';
    if (input.kind === 'bank_interest' && !/^\d{4}$/.test(account)) throw new Error('Confirm the account’s last four digits for every bank statement.');
    parties.add([identity(record.owner), identity(record.institution), account].join('|'));
    amountCents(record.amount);
    if (input.kind === 'bank_interest') amountCents(record.cashValue);
  }
  if (parties.size !== 1) throw new Error('Use one employee/employer or one bank account per calculation.');
  const projection = projectGrossPay({ amounts: input.records.map(record => String(record.amount)), frequency: input.frequency, policyRef: input.policyRef });
  if (input.kind === 'wages') return { changes: { [`income_member_${row}_wages_business`]: projection.annual }, formula: projection.formula, annual: projection.annual, status: 'PROPOSAL_ONLY' };
  if (!['latest_closing', 'mean_statement_balance'].includes(input.balanceMethod)) throw new Error('Confirm the policy-permitted bank balance method.');
  // Dates were validated above. Compare normalized ISO values, not locale-dependent dates.
  const iso = raw => { const v = String(raw); if (/^\d{4}-/.test(v)) return v; const [m,d,y] = v.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; };
  const ordered = [...input.records].sort((a,b) => iso(a.periodEnd).localeCompare(iso(b.periodEnd)));
  const count = BigInt(ordered.length);
  const cash = input.balanceMethod === 'latest_closing' ? amountCents(ordered.at(-1).cashValue) : (ordered.reduce((sum, record) => sum + amountCents(record.cashValue), 0n) + count / 2n) / count;
  return { changes: { [`asset_${row}_cash_value`]: centsText(cash), [`asset_${row}_annual_income`]: projection.annual, [`asset_${row}_income_method`]: 'Actual' }, formula: `${projection.formula}; cash value: ${input.balanceMethod}`, annual: projection.annual, status: 'PROPOSAL_ONLY' };
}

/** Reject fabricated source references and recompute every submitted calculation server-side. */
export function validateSupportingCalculations(events, evidence, values) {
  if (events === undefined) return [];
  if (!Array.isArray(events) || events.length > 30 || JSON.stringify(events).length > 100000) throw new Error('Calculation review history is too large.');
  const byId = new Map(evidence.map(item => [item.id, item]));
  return events.map(event => {
    const proposal = calculateSupportingProposal(event);
    const sources = event.records.map(record => {
      const found = byId.get(record.evidenceId);
      if (!found || found.kind !== (event.kind === 'wages' ? 'check_stub' : 'bank_statement')) throw new Error('A selected calculation source is not part of this uploaded packet.');
      return { id: found.id, page: found.page, sourceSha256: found.sourceSha256, sourceDocumentRef: found.sourceDocumentRef, extractedFields: found.fields };
    });
    const member = values[`${event.kind === 'wages' ? 'income_member' : 'asset'}_${Number(event.destinationRow)}_household_member_number`];
    if (!/^(?:10|[1-9])$/.test(clean(member))) throw new Error('Confirm the household member number on the calculation destination row.');
    return {
      kind: event.kind, destinationRow: Number(event.destinationRow), frequency: event.frequency,
      balanceMethod: event.kind === 'bank_interest' ? event.balanceMethod : null,
      policyRef: clean(event.policyRef), reason: clean(event.reason), sources,
      reviewedInputs: event.records.map(record => ({ evidenceId: record.evidenceId, periodEnd: record.periodEnd, owner: clean(record.owner), institution: clean(record.institution), amount: String(record.amount), ...(event.kind === 'bank_interest' ? { accountLast4: record.accountLast4, cashValue: String(record.cashValue) } : {}) })),
      calculatedValues: proposal.changes, formula: proposal.formula,
      retainedInSavedTic: Object.entries(proposal.changes).every(([field,value]) => String(values[field] ?? '') === value || (Number.isFinite(Number(values[field])) && Number(values[field]) === Number(value))),
      status: 'REVIEWER_APPLIED_PROPOSAL',
    };
  });
}

/** Return a bounded, display-safe review history; approval is not inferred. */
export function summarizeCalculationHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-100).flatMap(entry => {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.calculation_reviews)) return [];
    return entry.calculation_reviews.slice(0, 30).filter(record => record && typeof record === 'object').map(record => ({
      kind: clean(record.kind), formula: clean(record.formula).slice(0, 5000),
      policyRef: clean(record.policyRef).slice(0, 500), reason: clean(record.reason).slice(0, 500),
      destinationRow: Number(record.destinationRow), retainedInSavedTic: record.retainedInSavedTic === true,
      sourcePages: (Array.isArray(record.sources) ? record.sources : []).map(item => Number(item?.page)).filter(page => Number.isInteger(page) && page > 0 && page <= 200),
      confirmedAt: clean(entry.confirmed_at),
    }));
  });
}
