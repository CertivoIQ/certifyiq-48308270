import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, FileSearch, HelpCircle, PlayCircle, XCircle } from 'lucide-react';
import {
  getCertificationReview,
  recordFindingDecision,
} from '@/utils/certification-review.functions';
import { runCertificationReview } from '@/utils/tic-certification-review.functions';
import { listCertificationDocuments } from '@/utils/certification-extraction-preview.functions';
import { markCertificationReviewFailed, queueCertificationReviews } from '@/lib/portfolio-intake.functions';
import { useAccount } from '@/hooks/use-account';
import { CertificationSupportingDocumentsPanel } from '@/components/certification-supporting-documents-panel';

/**
 * Live review panel for the compliance vertical slice.
 */

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  PASS: { icon: CheckCircle2, className: 'text-compliant', label: 'Pass' },
  FAIL: { icon: XCircle, className: 'text-destructive', label: 'Fail' },
  UNABLE_TO_DETERMINE: { icon: HelpCircle, className: 'text-flag', label: 'Unable to determine' },
};

const EXTRACTED_FIELD_LABELS: Record<string, string> = {
  calculated_projected_annual_income: 'Calculated projected annual income (pending program review)',
  tenant_signature_date: 'Tenant signature date',
  certification_effective_date: 'Certification effective date',
  household_annual_income: 'Household annual income',
  applicable_lihtc_income_limit: 'Applicable LIHTC income limit',
  household_net_assets: 'Household net assets',
  hotma_asset_cap: 'HOTMA asset cap',
  gross_rent: 'Gross rent',
  state_max_gross_rent: 'Maximum gross rent',
  utility_allowance_source: 'Utility allowance source',
};

const MONEY_FIELDS = new Set([
  'calculated_projected_annual_income',
  'household_annual_income',
  'applicable_lihtc_income_limit',
  'household_net_assets',
  'hotma_asset_cap',
  'gross_rent',
  'state_max_gross_rent',
]);

function extractedEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [] as Array<[string, unknown]>;
  return Object.entries(value as Record<string, unknown>).filter(([, fieldValue]) =>
    fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && typeof fieldValue !== 'object',
  );
}

function formatExtractedValue(field: string, value: unknown) {
  if (MONEY_FIELDS.has(field)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
    }
  }
  return String(value);
}

function finiteMoney(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function IncomeLimitComparison({ values }: { values: Record<string, unknown> }) {
  const income = finiteMoney(values['calculated_projected_annual_income'] ?? values['household_annual_income']);
  const limit = finiteMoney(values['applicable_lihtc_income_limit']);
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  if (income === null) return null;
  if (limit === null) {
    return (
      <div className="mt-3 rounded-lg border border-flag/30 bg-flag/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-flag"><HelpCircle className="size-4" />Needs income-limit information</p>
        <p className="mt-2 text-sm">Calculated household income: <strong>{money(income)}</strong></p>
        <p className="mt-1 text-xs text-muted-foreground">CertivoIQ needs the applicable property/program income limit for this household size and certification date before it can show an over-or-under result.</p>
      </div>
    );
  }
  const difference = income - limit;
  const over = difference > 0;
  const percent = limit === 0 ? null : (income / limit) * 100;
  return (
    <div className={`mt-3 rounded-lg border p-4 ${over ? 'border-destructive/30 bg-destructive/5' : 'border-compliant/30 bg-compliant/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 text-sm font-semibold ${over ? 'text-destructive' : 'text-compliant'}`}>
          {over ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
          {over ? 'Over income limit' : 'At or under income limit'}
        </p>
        {percent !== null ? <span className="text-sm font-semibold">{percent.toFixed(1)}% of limit</span> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Calculated annual income</p><p className="font-semibold tabular-nums">{money(income)}</p></div>
        <div><p className="text-xs text-muted-foreground">Applicable income limit</p><p className="font-semibold tabular-nums">{money(limit)}</p></div>
        <div><p className="text-xs text-muted-foreground">Variance (income − limit)</p><p className="font-semibold tabular-nums">{difference > 0 ? '+' : difference < 0 ? '−' : ''}{money(Math.abs(difference))}</p></div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Calculation: {money(income)} household income − {money(limit)} income limit = {difference < 0 ? '−' : ''}{money(Math.abs(difference))}.</p>
      <p className="mt-1 text-xs font-medium">
        {difference === 0
          ? 'The household income equals the applicable limit, so the variance is $0.00.'
          : over
            ? `The household is ${money(difference)} over the applicable income limit. A positive variance means calculated income exceeds the selected limit.`
            : `The household is ${money(Math.abs(difference))} under the applicable income limit. A negative variance means calculated income remains below the selected limit.`}
      </p>
    </div>
  );
}

type EvidenceRecordRow = {
  id: string;
  manifest_sha256: string;
  manifest: unknown;
  outcome: string;
  engine_build: string;
  created_at: string;
};

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];
}

function EvidenceRecordCard({ record }: { record: EvidenceRecordRow }) {
  const manifest = recordObject(record.manifest);
  const documents = recordArray(manifest['documents']);
  const facts = recordArray(manifest['extractedInputs']);
  const calculations = recordArray(manifest['calculations']);
  const rules = recordArray(manifest['evaluatedRules']);
  const actions = recordArray(manifest['humanActions']);
  const certification = recordObject(manifest['certification']);
  const download = () => {
    const blob = new Blob([JSON.stringify(record.manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `certivoiq-evidence-record-${record.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="CertivoIQ Evidence Record">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">CertivoIQ Evidence Record</p><h3 className="mt-1 font-semibold">Review evidence and reproducibility receipt</h3></div>
        <span className="rounded-full border bg-background px-3 py-1 text-xs font-semibold">{record.outcome.replaceAll('_', ' ')}</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Evidence ID</p><p className="break-all font-mono text-xs">{record.id}</p></div>
        <div><p className="text-xs text-muted-foreground">Certification</p><p className="font-medium">{String(certification['type'] ?? '—')} · {String(certification['jurisdiction'] ?? '—')}</p></div>
        <div><p className="text-xs text-muted-foreground">Generated</p><p className="font-medium">{new Date(record.created_at).toLocaleString()}</p></div>
        <div><p className="text-xs text-muted-foreground">Engine</p><p className="font-medium">{record.engine_build}</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[['Source documents', documents.length], ['Confirmed facts', facts.filter(f => f['humanVerified']).length], ['Calculations', calculations.length], ['Rules evaluated', rules.length], ['Recorded actions', actions.length]].map(([label, count]) => <div key={String(label)} className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{count}</p></div>)}
      </div>
      {documents.length > 0 ? <div className="mt-4 rounded-lg border bg-background p-3"><p className="text-xs font-semibold">Source integrity</p>{documents.map((document, index) => <p key={String(document['id'] ?? index)} className="mt-1 break-all text-xs text-muted-foreground">{String(document['filename'] ?? 'Document')} · SHA-256 {String(document['sha256'] ?? 'Unavailable')}</p>)}</div> : null}
      <div className="mt-4 rounded-lg border bg-background p-3"><p className="text-xs font-semibold">Immutable record hash</p><p className="mt-1 break-all font-mono text-xs">{record.manifest_sha256}</p><p className="mt-2 text-xs text-muted-foreground">This hash binds the source identity, confirmed evidence, calculation inputs and outputs, rule versions, findings, and recorded actions in this review version.</p></div>
      <button type="button" onClick={download} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Download Evidence Record</button>
    </section>
  );
}

type EvidenceRef = { field?: string; documentRef?: string | null; page?: number | null; snippet?: string | null };

type CertificationReviewPanelProps = {
  initialItemId?: string | null | undefined;
  initialAction?: "support" | "review" | undefined;
};

export function CertificationReviewPanel({ initialItemId = null, initialAction }: CertificationReviewPanelProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [jurisdiction, setJurisdiction] = useState('');
  const [certificationType, setCertificationType] = useState<'' | 'INITIAL' | 'ANNUAL' | 'INTERIM'>('');
  const [notice, setNotice] = useState('');
  const { account } = useAccount();

  const listItems = useServerFn(listCertificationDocuments);
  const getReview = useServerFn(getCertificationReview);
  const runReview = useServerFn(runCertificationReview);
  const queueReviews = useServerFn(queueCertificationReviews);
  const markReviewFailed = useServerFn(markCertificationReviewFailed);
  const recordDecision = useServerFn(recordFindingDecision);

  const items = useQuery({ queryKey: ['certification-items'], queryFn: () => listItems() });
  const activeId = selectedId ?? items.data?.[0]?.id ?? null;

  useEffect(() => {
    if (!initialItemId) return;
    setSelectedId(initialItemId);
    setNotice(
      initialAction === 'support'
        ? 'Pending certification opened from the Command Center. Attach one supporting document below.'
        : initialAction === 'review'
          ? 'Pending certification opened from the Command Center. Review this certification when ready.'
          : 'Saved certification opened.'
    );
    window.setTimeout(() => {
      document.getElementById(`certification-${initialItemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, [initialItemId, initialAction]);

  const review = useQuery({
    queryKey: ['certification-review', activeId],
    enabled: !!activeId,
    queryFn: () => getReview({ data: { itemId: activeId! } }),
  });

  const runQueue = useMutation({
    mutationFn: async (requestedIds?: string[]) => {
      const itemIds = requestedIds?.length ? requestedIds : [...selectedIds];
      const queued = await queueReviews({ data: { itemIds } });
      let completed = 0;
      let failed = 0;
      for (const item of queued.items) {
        setSelectedId(item.id);
        setNotice(`Reviewing ${completed + failed + 1} of ${queued.items.length} in original upload order…`);
        try {
          const result = await runReview({
            data: {
              itemId: item.id,
              ...(certificationType ? { certificationType } : {}),
              ...(jurisdiction ? { jurisdiction } : {}),
            },
          });
          if ('error' in result && result.error) {
            failed += 1;
            await markReviewFailed({ data: { itemId: item.id } });
          } else completed += 1;
        } catch {
          failed += 1;
          await markReviewFailed({ data: { itemId: item.id } });
        }
      }
      return { completed, failed, total: queued.items.length };
    },
    onSuccess: async (result) => {
      setSelectedIds(new Set());
      setNotice(`Review queue finished in upload order: ${result.completed} completed${result.failed ? `, ${result.failed} failed` : ''}.`);
      await queryClient.invalidateQueries({ queryKey: ['certification-review'] });
      await queryClient.invalidateQueries({ queryKey: ['certification-items'] });
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { findingId: string; decision: 'approved' | 'remediation_requested' }) =>
      recordDecision({ data: input }),
    onSuccess: async (result) => {
      if ('error' in result && result.error) setNotice(result.error);
      else setNotice('Reviewer decision recorded in the audit trail.');
      await queryClient.invalidateQueries({ queryKey: ['certification-review'] });
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const freeReviewsRemaining =
    account?.isTrial && account.limits.aiDocs !== null
      ? Math.max(0, account.limits.aiDocs - account.usage.aiDocsUsed)
      : null;

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileSearch className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Certification documents</h2>
            <p className="text-sm text-muted-foreground">
              Review extracted certification information, supporting evidence, findings, and source citations below.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="certification-type">Certification type</label>
          <select
            id="certification-type"
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={certificationType}
            onChange={(event) => setCertificationType(event.target.value as '' | 'INITIAL' | 'ANNUAL' | 'INTERIM')}
          >
            <option value="">Select type</option>
            <option value="INITIAL">Initial</option>
            <option value="ANNUAL">Annual</option>
            <option value="INTERIM">Interim</option>
          </select>
          <label className="text-sm text-muted-foreground" htmlFor="jurisdiction">Jurisdiction</label>
          <input
            id="jurisdiction"
            className="w-20 rounded-md border bg-background px-2 py-1 text-sm uppercase"
            value={jurisdiction}
            maxLength={2}
            placeholder="Auto"
            onChange={(event) => setJurisdiction(event.target.value.toUpperCase())}
          />
          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={selectedIds.size === 0 || runQueue.isPending}
            onClick={() => runQueue.mutate([...selectedIds])}
          >
            <PlayCircle className="h-4 w-4" />
            {runQueue.isPending ? 'Reviewing queue…' : `Review selected (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {items.data && items.data.length > 0 ? (
        <div className="mt-5 space-y-3">
          <div className="flex justify-end text-xs text-muted-foreground">
            <button type="button" className="cursor-pointer font-medium text-primary" onClick={() => setSelectedIds(new Set(items.data.map((item) => item.id)))}>Select all visible</button>
          </div>
          {items.data.map((item) => {
            const extracted = extractedEntries(item.extracted_data);
            const extractedValues = item.extracted_data && typeof item.extracted_data === 'object' && !Array.isArray(item.extracted_data)
              ? item.extracted_data as Record<string, unknown>
              : {};
            return (
              <div id={`certification-${item.id}`} key={item.id} className={`rounded-lg border p-3 ${item.id === activeId ? 'border-primary bg-primary/5' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.original_file_name} for review`}
                    checked={selectedIds.has(item.id)}
                    onChange={(event) => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(item.id); else next.delete(item.id);
                      return next;
                    })}
                    className="size-4 cursor-pointer"
                  />
                  <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <span className="block truncate text-sm font-medium">{item.household_name || item.original_file_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.property_name ? `${item.property_name} · Unit ${item.unit_number}` : item.original_file_name} · {item.certification_type || 'type required'} · {item.jurisdiction || 'jurisdiction required'}</span>
                  </button>
                  <span className="rounded-full border px-2 py-1 text-xs">{(item.review_queue_status ?? 'pending').replaceAll('_', ' ')}</span>
                </div>

                {extracted.length > 0 ? (
                  <div className="mt-3 rounded-lg border bg-background/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extracted document information</span>
                      {item.confidence !== null && item.confidence !== undefined ? (
                        <span className="text-xs text-muted-foreground">Average confidence {Math.round(Number(item.confidence) * 100)}%</span>
                      ) : null}
                    </div>
                    <dl className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                      {extracted.map(([field, value]) => (
                        <div key={`${item.id}-${field}`} className="min-w-0">
                          <dt className="text-[11px] text-muted-foreground">{EXTRACTED_FIELD_LABELS[field] ?? field.replaceAll('_', ' ')}</dt>
                          <dd className="truncate text-sm font-medium">{formatExtractedValue(field, value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : item.processed_at ? (
                  <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">No supported certification fields were found automatically. The source document and OCR evidence are saved.</div>
                ) : (
                  <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">Extraction pending.</div>
                )}
                <IncomeLimitComparison values={extractedValues} />
                {item.id === activeId && (item.review_queue_status === 'not_queued' || item.review_queue_status === 'queued') ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div>
                      <p className="text-sm font-medium">Pending certification actions</p>
                      <p className="mt-1 text-xs text-muted-foreground">Attach supporting evidence before review, or begin review for this certification.</p>
                    </div>
                    <button
                      type="button"
                      disabled={runQueue.isPending}
                      onClick={() => runQueue.mutate([item.id])}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <PlayCircle className="size-4" />
                      {runQueue.isPending ? 'Reviewing…' : 'Review Certification'}
                    </button>
                  </div>
                ) : null}
                {item.id === activeId ? <CertificationSupportingDocumentsPanel itemId={item.id} /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Upload a certification document to populate Documents automatically.</p>
      )}

      {notice && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm" role="status">{notice}</p>}

      {review.data && (
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          {freeReviewsRemaining !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{freeReviewsRemaining} FREE certification review{freeReviewsRemaining === 1 ? '' : 's'} remaining</p>
                <p className="mt-1 text-sm text-muted-foreground">Use the remaining reviews to validate CertivoIQ on your own files, then scale to your full portfolio.</p>
              </div>
              {freeReviewsRemaining === 0 && <Link to="/pricing" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Choose your plan</Link>}
            </div>
          ) : null}
        </div>
      )}

      {review.data?.evidenceRecord
        ? <EvidenceRecordCard record={review.data.evidenceRecord as EvidenceRecordRow} />
        : review.data
          ? <div className="mt-6 rounded-xl border p-4"><p className="font-medium">Evidence Record pending</p><p className="mt-1 text-sm text-muted-foreground">Run the full certification review to bind the confirmed facts, calculations, governing rules, findings, and source-file hash into the CertivoIQ Evidence Record.</p></div>
          : null}

      {review.data && review.data.findings.length > 0 && (
        <div className="mt-6 space-y-3">
          {review.data.findings.map((finding) => {
            const style = STATUS_STYLE[finding.status] ?? STATUS_STYLE['UNABLE_TO_DETERMINE']!;
            const Icon = style.icon;
            const refs = (finding.evidence_refs as EvidenceRef[] | null) ?? [];
            const blocking = (finding.blocking_reasons as string[] | null) ?? [];
            const trail = review.data.reviews.filter((entry) => entry.finding_id === finding.id);
            return (
              <article key={finding.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={`flex items-center gap-2 font-medium ${style.className}`}>
                    <Icon className="h-4 w-4" />
                    {style.label} · {finding.rule_id} v{finding.rule_version}
                  </div>
                  <span className="text-xs text-muted-foreground">{finding.rule_pack_id}@{finding.rule_pack_version} · {finding.jurisdiction} · {finding.engine_build}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{finding.explanation}</p>
                {blocking.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-flag">
                    {blocking.map((reason) => <li key={reason} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{reason}</li>)}
                  </ul>
                )}
                {refs.length > 0 && <EvidenceRefList findingId={finding.id} refs={refs} />}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={decide.isPending || finding.status === 'UNABLE_TO_DETERMINE'} onClick={() => decide.mutate({ findingId: finding.id, decision: 'approved' })}>Approve</button>
                  <button className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={decide.isPending} onClick={() => decide.mutate({ findingId: finding.id, decision: 'remediation_requested' })}>Request remediation</button>
                  <span className="text-xs text-muted-foreground">Review state: {finding.review_state}</span>
                </div>
                {trail.length > 0 && (
                  <ul className="mt-2 text-xs text-muted-foreground">
                    {trail.map((entry) => <li key={`${entry.finding_id}-${entry.created_at}`}>{new Date(entry.created_at).toLocaleString()} — {entry.decision}</li>)}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}

      {review.data && review.data.facts.length > 0 && (
        <details className="mt-6 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">Source citations for extracted information ({review.data.facts.length})</summary>
          <CitationList facts={review.data.facts as CitationFact[]} />
        </details>
      )}
    </section>
  );
}

type CitationFact = {
  field_name: string;
  field_value: unknown;
  source_document_ref: string | null;
  source_page: number | null;
  source_snippet?: string | null;
  confidence: number | string | null;
  human_verified?: boolean | null;
  extraction_provider: string | null;
};

function CitationList({ facts }: { facts: CitationFact[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ul className="mt-3 space-y-2 text-xs">
      {facts.map((fact) => {
        const isSelected = selected === fact.field_name;
        return (
          <li key={fact.field_name}>
            <button
              type="button"
              aria-pressed={isSelected}
              aria-expanded={isSelected}
              onClick={() => setSelected(isSelected ? null : fact.field_name)}
              className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <span className="font-medium text-foreground">{EXTRACTED_FIELD_LABELS[fact.field_name] ?? fact.field_name}</span>
              <span className="text-muted-foreground">: {String(fact.field_value)}</span>
              {isSelected ? (
                <span className="mt-2 block space-y-1 text-muted-foreground">
                  {fact.source_snippet ? <span className="block">Source snippet: “{fact.source_snippet}”</span> : null}
                  <span className="block">Document reference: {fact.source_document_ref ?? '—'}</span>
                  <span className="block">Page: {fact.source_page ?? '—'}</span>
                  <span className="block">Confidence: {fact.confidence === null ? '—' : `${Math.round(Number(fact.confidence) * 100)}%`}</span>
                  <span className="block">Extraction provider: {fact.extraction_provider ?? '—'}</span>
                  {fact.human_verified ? <span className="block">Confirmed by reviewer</span> : null}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EvidenceRefList({ findingId, refs }: { findingId: string; refs: EvidenceRef[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">Evidence</div>
      <ul className="mt-2 space-y-2">
        {refs.map((ref, index) => {
          const refKey = ref.field ?? `ref-${index}`;
          const isSelected = selected === refKey;
          return (
            <li key={`${findingId}-${refKey}`}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-expanded={isSelected}
                onClick={() => setSelected(isSelected ? null : refKey)}
                className={`w-full cursor-pointer rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              >
                <span className="font-medium text-foreground">{ref.field}</span>
                <span> — {ref.documentRef} p.{ref.page ?? '—'}</span>
                {isSelected ? (
                  <span className="mt-1 block">
                    {ref.snippet ? <span className="block">Source snippet: “{ref.snippet}”</span> : null}
                    <span className="block">Document reference: {ref.documentRef}</span>
                    <span className="block">Page: {ref.page ?? '—'}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
