-- Customer-scoped governance inspection. This intentionally exposes structured
-- service-delivery metadata only; raw customer content remains excluded and
-- model-training eligibility remains prohibited.

create or replace function public.compliance_corpus_governance_snapshot(_as_of timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with caller as (
  select (select auth.uid()) as user_id
), corpus as (
  select public.compliance_corpus_status(_as_of) as status
), finding_stats as (
  select
    count(*)::int as total_findings,
    count(*) filter (
      where upper(coalesce(f.status,'')) in ('FAIL','UNABLE_TO_DETERMINE','UNABLE TO DETERMINE')
        and lower(coalesce(f.review_state,'')) not in ('approved','resolved','closed','accepted')
    )::int as open_findings,
    count(*) filter (
      where lower(coalesce(f.review_state,'')) in ('approved','resolved','closed','accepted')
    )::int as resolved_findings,
    count(*) filter (
      where lower(coalesce(f.severity,''))='critical'
        and upper(coalesce(f.status,'')) in ('FAIL','UNABLE_TO_DETERMINE','UNABLE TO DETERMINE')
        and lower(coalesce(f.review_state,'')) not in ('approved','resolved','closed','accepted')
    )::int as critical_open
  from public.compliance_findings f, caller c
  where f.user_id=c.user_id and f.created_at<=_as_of
), correction_stats as (
  select
    count(*) filter(where a.status='assigned')::int as open_corrections,
    count(*) filter(where a.status='resolved')::int as resolved_corrections
  from public.certification_finding_assignments a
  join public.certification_workflow_cases w on w.id=a.case_id
  join caller c on c.user_id=w.workspace_user_id
  where a.assigned_at<=_as_of
), evidence_stats as (
  select count(*)::int as evidence_manifests
  from public.evidence_manifests e, caller c
  where e.user_id=c.user_id and e.created_at<=_as_of
), review_stats as (
  select count(*)::int as reviewer_decisions
  from public.finding_reviews r, caller c
  where r.user_id=c.user_id and r.created_at<=_as_of
), audit_stats as (
  select count(*)::int as audit_files
  from public.certification_audit_files a, caller c
  where a.workspace_user_id=c.user_id and a.filed_at<=_as_of
), recent_findings as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) as rows
  from (
    select f.id,f.rule_id,f.rule_version,f.rule_pack_id,f.rule_pack_version,
           f.jurisdiction,f.status,f.severity,f.review_state,f.engine_build,
           f.created_at,f.updated_at
    from public.compliance_findings f, caller c
    where f.user_id=c.user_id and f.created_at<=_as_of
    order by f.created_at desc
    limit 25
  ) x
), recent_corrections as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.assigned_at desc),'[]'::jsonb) as rows
  from (
    select a.finding_id,a.status as assignment_status,a.assigned_at,a.resolved_at,
           f.rule_id,f.status as finding_status,f.review_state,f.severity,f.jurisdiction
    from public.certification_finding_assignments a
    join public.certification_workflow_cases w on w.id=a.case_id
    join public.compliance_findings f on f.id=a.finding_id
    join caller c on c.user_id=w.workspace_user_id
    where a.assigned_at<=_as_of
    order by a.assigned_at desc
    limit 25
  ) x
)
select jsonb_build_object(
  'as_of',_as_of,
  'policy',(select status from corpus),
  'service_delivery_counts',jsonb_build_object(
    'findings',(select total_findings from finding_stats),
    'open_findings',(select open_findings from finding_stats),
    'critical_open',(select critical_open from finding_stats),
    'resolved_findings',(select resolved_findings from finding_stats),
    'open_corrections',(select open_corrections from correction_stats),
    'resolved_corrections',(select resolved_corrections from correction_stats),
    'reviewer_decisions',(select reviewer_decisions from review_stats),
    'evidence_manifests',(select evidence_manifests from evidence_stats),
    'audit_files',(select audit_files from audit_stats)
  ),
  'recent_findings',(select rows from recent_findings),
  'recent_corrections',(select rows from recent_corrections),
  'governance_view','structured_service_delivery_metadata_only',
  'raw_customer_content_included',false,
  'model_training_use','prohibited'
);
$$;
revoke all on function public.compliance_corpus_governance_snapshot(timestamptz) from public,anon;
grant execute on function public.compliance_corpus_governance_snapshot(timestamptz) to authenticated;
