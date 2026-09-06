import { useState } from 'react';
import { SUPPORTING_DOCUMENT_DEFINITIONS } from '@/lib/tic-supporting-document-registry';
import { validatePageChoices, type PacketPageChoice, type PacketPageInventory, type PacketPageRole } from '@/lib/tic-packet-selection';

type Props = {
  inventory: PacketPageInventory[];
  choices: PacketPageChoice[];
  sourceUrl: string | null;
  isPdf: boolean;
  busy: boolean;
  onChange: (choices: PacketPageChoice[]) => void;
  onConfirm: () => void;
};
const administrative = /cover|transmittal|instructions|administrative|review notes/i;

export function TicPacketOrganizer({ inventory, choices, sourceUrl, isPdf, busy, onChange, onConfirm }: Props) {
  const [activePage, setActivePage] = useState(() => choices.find(c => c.role === 'tic_page')?.page ?? 1);
  let validation = '';
  try { validatePageChoices(choices, inventory.length, true); } catch (error) { validation = error instanceof Error ? error.message : 'Confirm each page.'; }
  const ticCount = choices.filter(c => c.role === 'tic_page').length;
  const pendingCount = choices.filter(c => c.role === 'pending').length;
  const omittedCount = choices.filter(c => c.role === 'omit').length;
  const supportingCount = choices.length - ticCount - pendingCount - omittedCount;
  const selectedUrl = sourceUrl ? (isPdf ? `${sourceUrl}#page=${activePage}` : sourceUrl) : null;
  function setChoice(page: number, role: PacketPageRole, reason?: string) {
    onChange(choices.map(c => c.page !== page ? c : { page, role, reason: reason ?? (role === 'omit' ? 'Not included in this certification review' : '') }));
  }
  return (
    <section className="mt-4 rounded-xl border bg-background p-4" aria-label="Choose packet documents">
      <h3 className="text-lg font-semibold">1. Choose documents for this review</h3>
      <p className="mt-2 text-sm text-muted-foreground">CertivoIQ has inspected the packet for TIC pages. Every other page is held for your decision. Confirm which pages belong to one TIC, include the supporting documents you need, and omit covers or unrelated material.</p>
      <p className="mt-2 text-xs text-muted-foreground">Omitting a page excludes it from extraction and review; it does not delete or alter the original upload. Missing required evidence can still block the final review.</p>
      <div className="my-3 flex flex-wrap gap-3 text-sm" aria-live="polite">
        <span>{ticCount} TIC</span><span>{supportingCount} supporting</span><span>{omittedCount} omitted</span><strong>{pendingCount} need a decision</strong>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="rounded border px-3 py-2 text-xs disabled:opacity-50" onClick={() => onChange(choices.map(c => {
          const suggested = inventory.find(p => p.page === c.page)?.suggestedRole;
          return c.role === 'pending' && suggested && !['pending', 'omit'].includes(suggested) ? { ...c, role: suggested } : c;
        }))}>Include remaining recognized documents</button>
        <button type="button" disabled={busy} className="rounded border px-3 py-2 text-xs disabled:opacity-50" onClick={() => onChange(choices.map(c => {
          const page = inventory.find(p => p.page === c.page);
          return c.role === 'pending' && page && administrative.test(page.label) ? { ...c, role: 'omit', reason: page.label } : c;
        }))}>Omit detected covers and instructions</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(320px,1.15fr)]">
        <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
          {inventory.map(page => {
            const choice = choices.find(c => c.page === page.page);
            const role = choice?.role ?? 'pending';
            return (
              <article key={page.page} className={`rounded-lg border p-3 ${activePage === page.page ? 'border-primary bg-primary/5' : ''}`}>
                <button type="button" disabled={busy} onClick={() => setActivePage(page.page)} className="text-left text-sm font-semibold underline-offset-4 hover:underline">Page {page.page} — {page.label}</button>
                <p className="mt-1 text-xs text-muted-foreground">{page.basis}</p>
                <label className="mt-2 block text-xs font-medium">Page {page.page} review role
                  <select aria-label={`Page ${page.page} review role`} className="mt-1 w-full rounded border bg-background px-2 py-2 text-sm" value={role} disabled={busy} onChange={e => setChoice(page.page, e.target.value as PacketPageRole)}>
                    <option value="pending">Needs decision — not yet included</option>
                    <option value="tic_page">Tenant Income Certification — use for TIC fields</option>
                    {SUPPORTING_DOCUMENT_DEFINITIONS.map(d => <option key={d.type} value={d.type}>Include: {d.label}</option>)}
                    <option value="omit">Omit from extraction and review</option>
                  </select>
                </label>
                {role === 'omit' && <label className="mt-2 block text-xs">Reason for omitting page {page.page}<input aria-label={`Page ${page.page} omission reason`} className="mt-1 w-full rounded border bg-background p-2 text-sm" value={choice?.reason ?? ''} maxLength={500} disabled={busy} onChange={e => setChoice(page.page, 'omit', e.target.value)} /></label>}
                {!page.excerpt && <p className="mt-2 text-xs font-medium">No readable text was recovered. Inspect the page before deciding.</p>}
              </article>
            );
          })}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm"><strong>Original packet · page {activePage}</strong>{selectedUrl && <a href={selectedUrl} target="_blank" rel="noreferrer" className="underline">Open source page</a>}</div>
          {selectedUrl ? isPdf ? <iframe key={`${sourceUrl}:${activePage}`} title={`Original packet page ${activePage}`} src={selectedUrl} className="h-[65vh] min-h-[400px] w-full rounded border bg-white" /> : <img src={selectedUrl} alt="Original uploaded certification page" className="max-h-[65vh] w-full object-contain" /> : <p className="rounded border p-4 text-sm">Source preview is unavailable. Reopen intake before verifying uncertain pages.</p>}
        </div>
      </div>
      {validation && <p className="mt-3 text-sm font-medium" role="status">{validation}</p>}
      <div className="mt-4 flex justify-end"><button type="button" className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy || !!validation || !sourceUrl} onClick={onConfirm}>{busy ? 'Extracting selected TIC pages…' : 'Confirm selection & extract TIC'}</button></div>
    </section>
  );
}
