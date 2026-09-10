-- Phase 12: tenant-scoped Portfolio Compliance Intelligence.
-- Metrics are computed from structured CertivoIQ records. Cross-customer
-- benchmarking is intentionally unavailable.

create or replace function public.portfolio_compliance_intelligence(
  _from_date date,
  _to_date date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $portfolio_intelligence$
declare
  v_user_id uuid:=auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if _from_date is null or _to_date is null or _from_date>_to_date then
    raise exception 'A valid inclusive date range is required' using errcode='22023';
  end if;
  if _to_date-_from_date>1095 then
    raise exception 'Portfolio analytics range cannot exceed three years' using errcode='22023';
  end if;

  with certifications as (
    select i.id,i.property_id,i.created_at::date as activity_date,
      coalesce(i.program_codes[1],'Unspecified') as program_code
    from public.certification_import_items i
    where i.user_id=v_user_id and i.created_at::date between _from_date and _to_date
  ), findings as (
    select f.id,f.item_id,f.rule_id,f.severity,f.status,f.evidence_refs,f.created_at,
      c.property_id,c.program_code
    from public.compliance_findings f
    join certifications c on c.id=f.item_id
    where f.user_id=v_user_id and f.created_at::date between _from_date and _to_date
  ), resolved_events as (
    select e.finding_id,min(e.occurred_at) as resolved_at
    from public.certification_workflow_events e
    join findings f on f.id=e.finding_id
    where lower(e.event_type) in ('finding_resolved','finding_closed','correction_approved','resolved','closed')
    group by e.finding_id
  ), remediation_durations as (
    select r.id,extract(epoch from (e.resolved_at-r.created_at))/3600.0 as hours
    from public.compliance_remediation_actions r
    join findings f on f.id=r.finding_id
    join resolved_events e on e.finding_id=r.finding_id
    where e.resolved_at>=r.created_at
  ), categories as (
    select rule_id,severity,count(*)::integer as finding_count
    from findings group by rule_id,severity
  ), repeats as (
    select rule_id,count(*)::integer as occurrence_count,
      count(distinct property_id)::integer as properties_affected
    from findings group by rule_id having count(*)>=2
  ), property_trends as (
    select coalesce(c.property_id::text,'Unassigned') as property_id,
      count(distinct c.id)::integer as certifications,
      count(distinct f.id)::integer as findings
    from certifications c left join findings f on f.item_id=c.id
    group by c.property_id
  ), program_trends as (
    select c.program_code,count(distinct c.id)::integer as certifications,
      count(distinct f.id)::integer as findings
    from certifications c left join findings f on f.item_id=c.id
    group by c.program_code
  ), reviewer_trends as (
    select r.reviewer_id::text as reviewer_id,count(*)::integer as reviews,
      count(*) filter(where lower(r.decision) in ('approved','pass','resolved'))::integer as approvals
    from public.finding_reviews r join findings f on f.id=r.finding_id
    where r.user_id=v_user_id and r.created_at::date between _from_date and _to_date
    group by r.reviewer_id
  ), evidence_deficiencies as (
    select rule_id,count(*)::integer as missing_evidence_findings
    from findings where jsonb_array_length(evidence_refs)=0
    group by rule_id
  ), totals as (
    select
      (select count(*)::integer from certifications) as certifications,
      (select count(*)::integer from findings) as findings,
      (select count(*)::integer from findings where lower(severity)='critical'
        and lower(status) not in ('closed','resolved','approved','pass')) as open_critical_findings
  )
  select jsonb_build_object(
    'range',jsonb_build_object('from',_from_date,'to',_to_date),
    'generated_at',clock_timestamp(),
    'method','structured-tenant-analytics-v1',
    'benchmarking',jsonb_build_object(
      'status','not_enabled',
      'reason','Cross-customer identifiable or confidential information is never exposed.'
    ),
    'summary',jsonb_build_object(
      'certifications',t.certifications,
      'findings',t.findings,
      'findings_per_100_certifications',
        case when t.certifications=0 then 0
        else round((t.findings::numeric*100)/t.certifications,2) end,
      'open_critical_findings',t.open_critical_findings,
      'average_remediation_hours',
        coalesce((select round(avg(hours)::numeric,2) from remediation_durations),0),
      'audit_readiness',public.audit_readiness_score(_to_date)->'score'
    ),
    'finding_categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.finding_count desc,c.rule_id,c.severity) from categories c),'[]'::jsonb),
    'repeat_deficiency_patterns',coalesce((select jsonb_agg(to_jsonb(r) order by r.occurrence_count desc,r.rule_id) from repeats r),'[]'::jsonb),
    'property_trends',coalesce((select jsonb_agg(to_jsonb(p) order by p.findings desc,p.property_id) from property_trends p),'[]'::jsonb),
    'program_trends',coalesce((select jsonb_agg(to_jsonb(p) order by p.findings desc,p.program_code) from program_trends p),'[]'::jsonb),
    'reviewer_trends',coalesce((select jsonb_agg(to_jsonb(r) order by r.reviews desc,r.reviewer_id) from reviewer_trends r),'[]'::jsonb),
    'recurring_evidence_deficiencies',coalesce((select jsonb_agg(to_jsonb(e) order by e.missing_evidence_findings desc,e.rule_id) from evidence_deficiencies e),'[]'::jsonb)
  ) into v_result from totals t;
  return v_result;
end;
$portfolio_intelligence$;

revoke all on function public.portfolio_compliance_intelligence(date,date) from public,anon;
grant execute on function public.portfolio_compliance_intelligence(date,date) to authenticated;
comment on function public.portfolio_compliance_intelligence(date,date) is
  'Tenant-scoped structured portfolio metrics. Cross-customer benchmarking is not enabled.';
