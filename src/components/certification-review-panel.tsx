import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, FileSearch, HelpCircle, PlayCircle, XCircle } from 'lucide-react';
import {
  getCertificationReview,
  listCertificationItems,
  recordFindingDecision,
  runCertificationReview,
} from '@/utils/certification-review.functions';
import { useAccount } from '@/hooks/use-account';

/**
 * Live review panel for the compliance vertical slice: run extraction + the
 * deterministic rule engine on an uploaded certification, then record the
 * human reviewer decision. All data here is persisted, not demo content.
 */

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  PASS: { icon: CheckCircle2, className: 'text-compliant', label: 'Pass' },
  FAIL: { icon: XCircle, className: 'text-destructive', label: 'Fail' },
  UNABLE_TO_DETERMINE: { icon: HelpCircle, className: 'text-flag', label: 'Unable to determine' },
};

type EvidenceRef = { field?: string; documentRef?: string | null; page?: number | null; snippet?: string | null };

export function CertificationReviewPanel() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState('US');
  const [certificationType, setCertificationType] = useState<
    '' | 'INITIAL' | 'ANNUAL' | 'INTERIM'
  >('');
  const [notice, setNotice] = useState('');
  const { account } = useAccount();

  const listItems = useServerFn(listCertificationItems);
  const getReview = useServerFn(getCertificationReview);
  const runReview = useServerFn(runCertificationReview);
  const recordDecision = useServerFn(recordFindingDecision);

  const items = useQuery({ queryKey: ['certification-items'], queryFn: () => listItems() });
  const activeId = selectedId ?? items.data?.[0]?.id ?? null;

  const review = useQuery({
    queryKey: ['certification-review', activeId],
    enabled: !!activeId,
    queryFn: () => getReview({ data: { itemId: activeId! } }),
  });

  const run = useMutation({
    mutationFn: async (itemId: string) =>
      runReview({
        data: {
          itemId,
          programs: ['LIHTC'],
          certificationType: certificationType as 'INITIAL' | 'ANNUAL' | 'INTERIM',
          ...(jurisdiction === 'US' ? {} : { jurisdiction }),
          useAi: true,
        },
      }),
    onSuccess: async (result) => {
      if ('error' in result && result.error) setNotice(result.error);
      else if ('rulePack' in result && result.rulePack && result.counts) {
        setNotice(
          `Reviewed with ${result.rulePack.id}@${result.rulePack.version} · ${result.counts.pass} pass · ${result.counts.fail} fail · ${result.counts.unableToDetermine} undetermined`,
        );
      }

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
            <h2 className="font-semibold">Live certification review</h2>
            <p className="text-sm text-muted-foreground">
              Extraction captures each fact with its document citation; versioned rules decide Pass, Fail, or Unable to
              determine. A human records the final decision.
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
            onChange={(event) => setJurisdiction(event.target.value.toUpperCase() || 'US')}
          />
          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={!activeId || !certificationType || run.isPending}
            onClick={() => activeId && run.mutate(activeId)}
          >
            <PlayCircle className="h-4 w-4" />
            {run.isPending ? 'Reviewing…' : 'Run review'}
          </button>
        </div>
      </div>

      {items.data && items.data.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {items.data.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`rounded-full border px-3 py-1 text-xs ${item.id === activeId ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground'}`}
            >
              {item.original_file_name} · {item.status}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Upload a certification text or CSV export above to run a live review.
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
            Extracted facts with citations ({review.data.facts.length})
          </summary>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {review.data.facts.map((fact) => (
              <li key={fact.field_name}>
                <span className="font-medium text-foreground">{fact.field_name}</span>: {String(fact.field_value)} —{' '}
                {fact.source_document_ref} p.{fact.source_page ?? '—'} · {Math.round(Number(fact.confidence) * 100)}%
                confidence · {fact.extraction_provider}
                {fact.human_verified ? ' · human verified' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
