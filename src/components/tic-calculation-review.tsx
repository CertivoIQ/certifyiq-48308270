import { useEffect, useState } from 'react';
import { calculateTicSums, projectGrossPay } from '@/lib/tic-cell-repair.mjs';
import { TIC_FIELD_BY_KEY } from '@/lib/tic-field-registry';

type Props = { values: Record<string, string>; busy: boolean; onChange: (field: string, value: string) => void };

export function TicCalculationReview({ values, busy, onChange }: Props) {
  const [frequency, setFrequency] = useState('');
  const [periods, setPeriods] = useState('');
  const [policy, setPolicy] = useState('');
  const [incomeRow, setIncomeRow] = useState('1');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setChecked(false), [values]);
  const sums = calculateTicSums(values);
  let projection: ReturnType<typeof projectGrossPay> | null = null;
  let projectionError = '';
  try {
    const entries = periods.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => line.split('|').map(part => part.trim()));
    if (entries.some(parts => parts.length !== 2 || !parts[0])) throw new Error('Each line requires a unique document/pay-period reference | gross pay.');
    if (new Set(entries.map(parts => parts[0]!.toLowerCase())).size !== entries.length) throw new Error('Duplicate pay-period references must be resolved.');
    projection = projectGrossPay({ amounts: entries.map(parts => parts[1]!), frequency, policyRef: policy });
  } catch (cause) { projectionError = cause instanceof Error ? cause.message : 'Check the worksheet inputs.'; }

  function apply(changes: Record<string, string>, detail: string) {
    setError('');
    if (!checked || !reason.trim()) { setError('Confirm the source review and enter a correction reason.'); return; }
    const note = [values['calculation_review_note'], `${detail}; reason: ${reason.trim()}`].filter(Boolean).join('\n');
    if (note.length > 500) { setError('The calculation note exceeds 500 characters. Shorten the note before applying; no inputs were changed.'); return; }
    for (const [field, value] of Object.entries(changes)) onChange(field, value);
    onChange('calculation_review_note', note);
    setChecked(false);
  }
  const inputClass = 'w-full rounded border border-slate-400 bg-white p-2 text-sm text-slate-950';
  return (
    <section aria-label="Calculation review" className="space-y-4 rounded-lg border border-slate-400 bg-white p-4 text-slate-950">
      <h2 className="text-lg font-bold">Calculation review — proposed corrections</h2>
      <p className="text-sm">Uploaded values remain unchanged until you apply a proposal and save the TIC. These worksheets do not establish eligibility or verify property limits. Asset balances are kept separate from asset income.</p>
      <p className="text-sm">Review applicable program, certification date, property/unit designation, household size, effective-dated income and rent limits, utility allowance, and asset policy in the certification review. Do not use an uploaded limit as its own verification.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="text-left font-semibold">Totals from the annual amounts entered in the TIC</caption>
          <thead><tr><th className="p-2">Field</th><th className="p-2">Current TIC</th><th className="p-2">Recalculated proposal</th></tr></thead>
          <tbody>{Object.entries(sums.proposals).map(([key, value]) => <tr key={key}><td className="p-2">{TIC_FIELD_BY_KEY.get(key)?.label ?? key}</td><td className="p-2">{values[key] || 'Not entered'}</td><td className="p-2">{value}</td></tr>)}</tbody>
        </table>
      </div>
      {sums.blockers.map(message => <p className="text-sm" key={message}>{message}</p>)}
      <p className="text-xs">Blanks in an active row are not zero. Review asset exclusions, shared accounts, disposed assets and actual/imputed treatment before accepting asset totals. This does not calculate policy-dependent asset income.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Representative pay periods — one per line: document/pay-period reference | gross pay
          <textarea className={inputClass} rows={4} value={periods} disabled={busy} onChange={event => { setPeriods(event.target.value); setChecked(false); }} placeholder={'Stub 1 / period ending 2026-08-14 | 1500.00\nStub 2 / period ending 2026-08-28 | 1600.00'} />
        </label>
        <div className="space-y-3">
          <label className="block text-sm">Confirmed pay frequency<select className={inputClass} value={frequency} disabled={busy} onChange={event => { setFrequency(event.target.value); setChecked(false); }}><option value="">Select frequency</option><option value="weekly">Weekly — 52</option><option value="biweekly">Every two weeks — 26</option><option value="semimonthly">Twice monthly — 24</option><option value="monthly">Monthly — 12</option></select></label>
          <label className="block text-sm">Applicable projection policy / authority<input className={inputClass} value={policy} disabled={busy} onChange={event => { setPolicy(event.target.value); setChecked(false); }} /></label>
          <label className="block text-sm">Destination income row<select className={inputClass} value={incomeRow} disabled={busy} onChange={event => { setIncomeRow(event.target.value); setChecked(false); }}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Income row {i + 1}</option>)}</select></label>
        </div>
      </div>
      <p className="text-sm">{projection ? `${projection.formula} = ${projection.annual} annual gross income (proposal only).` : projectionError}</p>
      <p className="text-xs">Use gross pay, not net deposits or cumulative year-to-date totals. Confirm period coverage, duplicate statements, pay changes and whether this projection method is permitted. The projection replaces the selected row's wages amount; it does not add to it.</p>
      <label className="block text-sm">Correction reason<input className={inputClass} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)} />I checked the source amounts, period coverage, duplicate entries, destination row and applicable policy.</label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded border border-slate-700 px-3 py-2 text-sm disabled:opacity-50" disabled={busy || !checked || !reason.trim() || sums.blockers.length > 0 || !Object.keys(sums.proposals).length} onClick={() => apply(sums.proposals, 'Reconciled annual TIC row totals; asset principal kept separate')}>Apply proposed row totals</button>
        <button type="button" className="rounded border border-slate-700 px-3 py-2 text-sm disabled:opacity-50" disabled={busy || !checked || !reason.trim() || !projection || !/^(?:10|[1-9])$/.test(values[`income_member_${incomeRow}_household_member_number`] ?? '')} onClick={() => projection && apply({ [`income_member_${incomeRow}_wages_business`]: projection.annual }, `Income row ${incomeRow}: ${projection.formula} = ${projection.annual}; ${policy}; sources: ${periods.replace(/\n/g, '; ')}`)}>Apply gross-pay proposal</button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold">{error}</p>}
      <label className="block text-sm">Saved calculation review note<textarea className={inputClass} value={values['calculation_review_note'] ?? ''} maxLength={500} rows={3} disabled={busy} onChange={event => onChange('calculation_review_note', event.target.value)} /></label>
      <p className="text-xs">Save the TIC to persist applied values and the note through the existing confirmation workflow. Unapplied worksheet entries are not saved.</p>
    </section>
  );
}
