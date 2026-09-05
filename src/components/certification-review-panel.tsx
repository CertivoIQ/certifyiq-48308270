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

/**
 * Live review panel for the compliance vertical slice: uploaded documents show
 * proposed extracted information immediately, while compliance review remains
 * an explicit separate action.
 */

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  PASS: { icon: CheckCircle2, className: 'text-compliant', label: 'Pass' },
  FAIL: { icon: XCircle, className: 'text-destructive', label: 'Fail' },
  UNABLE_TO_DETERMINE: { icon: HelpCircle, className: 'text-flag', label: 'Unable to determine' },
};

const EXTRACTED_FIELD_LABELS: Record<string, string> = {
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

type EvidenceRef = { field?: string; documentRef?: string | null; page?: number | null; snippet?: string | null };

type CertificationReviewPanelProps = {
  initialItemId?: string | null;
};

export function CertificationReviewPanel({ initialItemId = null }: CertificationReviewPanelProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [jurisdiction, setJurisdiction] = useState('');
  const [certificationType, setCertificationType] = useState<
    '' | 'INITIAL' | 'ANNUAL' | 'INTERIM'
  >('');
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
    setNotice('Saved certification opened from intake.');
  }, [initialItemId]);

  const review = useQuery({
    queryKey: ['certification-review', activeId],
    enabled: !!activeId,
    queryFn: () => getReview({ data: { itemId: activeId! } }),
  });

  const runQueue = useMutation({
    mutationFn: async () => {
      const queued = await queueReviews({ data: { itemIds: [...selectedIds] } });
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
              Extracted document information is saved and displayed automatically after upload. Compliance review begins only when selected below.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="certification-type">
            Certification type
          </label>
          <select
            id="certification-type"
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={certificationType}
            onChange={(event) =>
              setCertificationType(
                event.target.value as '' | 'INITIAL' | 'ANNUAL' | 'INTERIM',
              )
            }
          >
            <option value="">Select type</option>
            <option value="INITIAL">Initial</option>
            <option value="ANNUAL">Annual</option>
            <option value="INTERIM">Interim</option>
          </select>
          <label className="text-sm text-muted-foreground" htmlFor="jurisdiction">
            Jurisdiction
          </label>
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
            onClick={() => runQueue.mutate()}
          >
            <PlayCircle className="h-4 w-4" />
            {runQueue.isPending ? 'Reviewing queue…' : `Review selected (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {items.data && items.data.length > 0 ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Documents are never selected for compliance review automatically.</span>
            <button type="button" className="font-medium text-primary" onClick={() => setSelectedIds(new Set(items.data.map((item) => item.id)))}>Select all visible</button>
          </div>
          {items.data.map((item) => {
            const extracted = extractedEntries(item.extracted_data);
            return (
              <div key={item.id} className={`rounded-lg border p-3 ${item.id === activeId ? 'border-primary bg-primary/5' : ''}`}>
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
                    className="size-4"
                  />
                  <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{item.household_name || item.original_file_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.property_name ? `${item.property_name} · Unit ${item.unit_number}` : item.original_file_name} · {item.certification_type || 'type required'} · {item.jurisdiction || 'jurisdiction required'}</span>
                  </button>
                  <span className="rounded-full border px-2 py-1 text-xs">{item.review_queue_status.replaceAll('_', ' ')}</span>
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
                  <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                    No supported certification fields were found automatically. The source document and OCR evidence are saved.
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                    Extraction pending.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Upload a certification document to populate Documents automatically.
        </p>
      )}

      {notice && (
        <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm" role="status">
          {notice}
        </p>
      )}

      {review.data && (
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
          {freeReviewsRemaining !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{freeReviewsRemaining} FREE certification review{freeReviewsRemaining === 1 ? '' : 's'} remaining</p>
                <p className="mt-1 text-sm text-muted-foreground">Use the remaining reviews to validate CertivoIQ on your own files, then scale to your full portfolio.</p>
              </div>
              {freeReviewsRemaining === 0 && (
                <Link to="/pricing" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  Choose your plan
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}

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
                  <span className="text-xs text-muted-foreground">
                    {finding.rule_pack_id}@{finding.rule_pack_version} · {finding.jurisdiction} · {finding.engine_build}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{finding.explanation}</p>
                {blocking.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-flag">
                    {blocking.map((reason) => (
                      <li key={reason} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
                {refs.length > 0 && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">Evidence</div>
                    <ul className="mt-1 space-y-1">
                      {refs.map((ref) => (
                        <li key={`${finding.id}-${ref.field}`}>
                          {ref.field} — {ref.documentRef} p.{ref.page ?? '—'}: “{ref.snippet}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    disabled={decide.isPending || finding.status === 'UNABLE_TO_DETERMINE'}
                    onClick={() => decide.mutate({ findingId: finding.id, decision: 'approved' })}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ findingId: finding.id, decision: 'remediation_requested' })}
                  >
                    Request remediation
                  </button>
                  <span className="text-xs text-muted-foreground">Review state: {finding.review_state}</span>
                </div>
                {trail.length > 0 && (
                  <ul className="mt-2 text-xs text-muted-foreground">
                    {trail.map((entry) => (
                      <li key={`${entry.finding_id}-${entry.created_at}`}>
                        {new Date(entry.created_at).toLocaleString()} — {entry.decision}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}

      {review.data && review.data.facts.length > 0 && (
        <details className="mt-6 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Source citations for extracted information ({review.data.facts.length})
          </summary>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {review.data.facts.map((fact) => (
              <li key={fact.field_name}>
                <span className="font-medium text-foreground">{EXTRACTED_FIELD_LABELS[fact.field_name] ?? fact.field_name}</span>: {String(fact.field_value)} —{' '}
                {fact.source_document_ref} p.{fact.source_page ?? '—'} · {Math.round(Number(fact.confidence) * 100)}%
                confidence · {fact.extraction_provider}
                {fact.human_verified ? ' · confirmed' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}