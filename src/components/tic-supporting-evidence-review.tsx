import { useMemo, useState } from 'react';
import { calculateSupportingProposal, type SupportingEvidence, type SupportingCalculation, type SupportingRecord } from '@/lib/tic-supporting-evidence.mjs';

type Props = {
  evidence: SupportingEvidence[];
  values: Record<string, string>;
  busy: boolean;
  sourceUrl: string | null;
  onApply: (changes: Record<string, string>, calculation: SupportingCalculation) => void;
};

function initialRecord(e: SupportingEvidence): SupportingRecord {
  const get = (key: string) => e.fields[key]?.value ?? '';
  return { evidenceId: e.id, periodEnd: get('period_end'), owner: get('owner'), institution: get('institution'), amount: get(e.kind === 'check_stub' ? 'gross_pay' : 'period_interest'), cashValue: get('closing_balance'), accountLast4: get('account_last4') };
}

export function TicSupportingEvidenceReview({ evidence, values, busy, sourceUrl, onApply }: Props) {
  const [kind, setKind] = useState<'wages' | 'bank_interest'>('wages');
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, SupportingRecord>>({});
  const [frequency, setFrequency] = useState('');
  const [destinationRow, setDestinationRow] = useState('1');
  const [member, setMember] = useState('');
  const [balanceMethod, setBalanceMethod] = useState('');
  const [policyRef, setPolicyRef] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const sourceKind = kind === 'wages' ? 'check_stub' : 'bank_statement';
  const shown = evidence.filter(e => e.kind === sourceKind);
  const records = shown.filter(e => selected.includes(e.id)).map(e => edits[e.id] ?? initialRecord(e));
  const worksheet: SupportingCalculation = { kind, records, frequency, destinationRow, policyRef, reason, reviewConfirmed: true, ...(kind === 'bank_interest' ? { balanceMethod } : {}) };
  const fieldPrefix = `${kind === 'wages' ? 'income_member' : 'asset'}_${destinationRow}_`;
  const linkedMember = values[fieldPrefix + 'household_member_number'] ?? '';
  const memberNumber = member || linkedMember;
  const fingerprint = JSON.stringify({ worksheet, memberNumber, values });
  const isConfirmed = confirmation === fingerprint;
  const proposal = useMemo(() => {
    try { return { result: calculateSupportingProposal(worksheet), error: '' }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Check the worksheet inputs.' }; }
  }, [fingerprint]);
  const inputClass = 'w-full rounded border border-slate-400 bg-white p-2 text-sm text-slate-950';
  function edit(e: SupportingEvidence, field: keyof SupportingRecord, value: string) {
    setEdits(current => ({ ...current, [e.id]: { ...(current[e.id] ?? initialRecord(e)), [field]: value } }));
    setMessage('');
  }
  function apply() {
    if (!proposal.result || !isConfirmed) return;
    if (!/^(?:10|[1-9])$/.test(memberNumber)) { setMessage('Choose the household member for this calculation.'); return; }
    if (linkedMember && linkedMember !== memberNumber) { setMessage('This destination row belongs to another member. Choose an unused row or the matching row.'); return; }
    if (!values[`household_member_${memberNumber}_last_name`] && !values[`household_member_${memberNumber}_first_name_middle_initial`]) { setMessage('Confirm this household member in Part II before applying the calculation.'); return; }
    const changes = { ...proposal.result.changes, [fieldPrefix + 'household_member_number']: memberNumber };
    if (kind === 'bank_interest' && !values[fieldPrefix + 'type']) changes[fieldPrefix + 'type'] = 'Bank account';
    onApply(changes, worksheet);
    setConfirmation('');
    setMessage('Proposed correction applied to the editable TIC. Save the TIC to retain the source references, reviewed inputs and formula.');
  }
  if (!evidence.length) return null;
  return (
    <section className="space-y-4 rounded-xl border border-slate-400 bg-white p-4 text-slate-950" aria-label="Supporting evidence calculations">
      <h2 className="text-lg font-bold">Supporting evidence → TIC calculations</h2>
      <p className="text-sm">Source values below were extracted from supporting pages. Correct uncertain cells, select distinct periods for one person and employer or one bank account, and compare the proposed correction before applying it. Original pages are unchanged.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">Worksheet<select className={inputClass} value={kind} disabled={busy} onChange={e => { setKind(e.target.value as typeof kind); setSelected([]); setFrequency(''); setDestinationRow('1'); setMember(''); }}><option value="wages">Employment gross pay</option><option value="bank_interest">Bank balance and actual interest</option></select></label>
        <label className="text-sm">Confirmed period frequency<select className={inputClass} value={frequency} disabled={busy} onChange={e => setFrequency(e.target.value)}><option value="">Select frequency</option><option value="weekly">Weekly · 52</option><option value="biweekly">Every two weeks · 26</option><option value="semimonthly">Twice monthly · 24</option><option value="monthly">Monthly · 12</option></select></label>
        {kind === 'bank_interest' && <label className="text-sm">Policy-permitted balance method<select className={inputClass} value={balanceMethod} disabled={busy} onChange={e => setBalanceMethod(e.target.value)}><option value="">Select method</option><option value="latest_closing">Latest closing balance</option><option value="mean_statement_balance">Mean of selected statement closing balances</option></select></label>}
      </div>
      {!shown.length && <p className="text-sm">No supported pages of this type were recognized in this packet. Review the original document; no values were assumed.</p>}
      {shown.map(e => {
        const record = edits[e.id] ?? initialRecord(e);
        return <fieldset key={e.id} className="space-y-2 rounded border p-3" disabled={busy}>
          <legend className="px-1 text-sm font-semibold">{e.kind === 'check_stub' ? 'Pay stub' : 'Bank statement'} · Page {e.page}</legend>
          <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(e.id)} onChange={event => setSelected(current => event.target.checked ? [...current, e.id] : current.filter(id => id !== e.id))} />Include this period</label>{sourceUrl && <a className="text-sm underline" href={`${sourceUrl.split('#')[0]}#page=${e.page}`} target="_blank" rel="noreferrer">View source page</a>}</div>
          <div className="grid gap-2 md:grid-cols-3">
            {([['owner', 'Employee / account owner'], ['institution', 'Employer / bank'], ['periodEnd', 'Period ending (MM/DD/YYYY)'], ['amount', kind === 'wages' ? 'Current gross pay' : 'Interest earned this period'], ...(kind === 'bank_interest' ? [['accountLast4', 'Account last four digits'], ['cashValue', 'Closing statement balance']] : [])] as Array<[keyof SupportingRecord, string]>).map(([key, label]) => <label key={key} className="text-xs">{label}<input className={inputClass} value={record[key] ?? ''} onChange={event => edit(e,key,event.target.value)} /></label>)}
          </div>
          {e.issues.map(issue => <p key={issue} className="text-xs">{issue}</p>)}
          <details className="text-xs"><summary className="cursor-pointer">Extracted source text and page references</summary>{Object.entries(e.fields).map(([field, fact]) => <p key={field} className="mt-1">{field.replaceAll('_', ' ')} · P{fact.page}: {fact.snippet}</p>)}</details>
        </fieldset>;
      })}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Destination TIC row<select className={inputClass} value={destinationRow} disabled={busy} onChange={e => { setDestinationRow(e.target.value); setMember(''); }}>{Array.from({ length: kind === 'wages' ? 10 : 27 }, (_, i) => <option key={i+1} value={i+1}>{kind === 'wages' ? 'Income' : 'Asset'} row {i+1}</option>)}</select></label>
        <label className="text-sm">Household member<select className={inputClass} value={memberNumber} disabled={busy} onChange={e => setMember(e.target.value)}><option value="">Select member</option>{Array.from({length:10},(_,i) => i+1).filter(i => values[`household_member_${i}_last_name`] || values[`household_member_${i}_first_name_middle_initial`]).map(i => <option key={i} value={i}>{i} · {values[`household_member_${i}_first_name_middle_initial`]} {values[`household_member_${i}_last_name`]}</option>)}</select></label>
        <label className="text-sm">Applicable calculation policy / authority<input className={inputClass} value={policyRef} maxLength={500} disabled={busy} onChange={e => setPolicyRef(e.target.value)} /></label>
        <label className="text-sm">Reason for this correction<input className={inputClass} value={reason} maxLength={500} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
      </div>
      <p className="text-sm">{proposal.result ? `${proposal.result.formula} = ${proposal.result.annual} annual income (proposal only).` : proposal.error}</p>
      {proposal.result && <div className="text-sm">{Object.entries(proposal.result.changes).map(([field, proposed]) => <p key={field}>{field.replaceAll('_',' ')}: <strong>{values[field] || 'Blank'}</strong> → <strong>{proposed}</strong></p>)}</div>}
      <p className="text-xs">Averaging is only appropriate when the selected periods are representative and the applicable program permits this method. Confirm pay changes, missing periods, shared accounts, exclusions and actual/imputed asset rules. These worksheets do not validate income/rent limits or issue eligibility decisions.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={isConfirmed} onChange={e => setConfirmation(e.target.checked ? fingerprint : '')} />I reviewed the sources, period coverage, owner/member match, destination row and applicable calculation policy.</label>
      <button type="button" className="rounded border border-slate-700 px-4 py-2 text-sm disabled:opacity-50" disabled={busy || !proposal.result || !isConfirmed || !memberNumber} onClick={apply}>Apply proposed correction to TIC</button>
      {message && <p role="status" className="text-sm font-medium">{message}</p>}
    </section>
  );
}
