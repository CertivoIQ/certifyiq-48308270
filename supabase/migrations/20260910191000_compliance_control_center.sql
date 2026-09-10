-- Phase 13: structured, tenant-scoped Compliance Control Center.
-- "What needs my attention today?" is assembled only from attributable records.

create or replace function public.compliance_control_center(
  _as_of date default current_date,
  _readiness_threshold integer default 80
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $control_center$
declare
  v_user_id uuid:=auth.uid();
  v_readiness jsonb;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if _readiness_threshold<0 or _readiness_threshold>100 then
    raise exception 'Readiness threshold must be between 0 and 100' using errcode='22023';
  end if;
  v_readiness:=public.audit_readiness_score(_as_of);

  with property_scores as (
    select p.id,p.name,greatest(0,100-coalesce(sum((d.value->>'points')::integer),0))::integer as readiness_score
    from public.portfolio_properties p
    left join lateral jsonb_array_elements(v_readiness->'deductions') d(value)
      on d.value->>'property_id'=p.id::text
    where p.user_id=v_user_id
    group by p.id,p.name
  ), properties_below as (
    select * from property_scores where readiness_score<_readiness_threshold
  ), critical_findings as (
    select f.id,i.property_id,f.explanation,f.created_at
    from public.compliance_findings f
    join public.certification_import_items i on i.id=f.item_id
    where f.user_id=v_user_id and i.user_id=v_user_id
      and lower(f.severity)='critical'
      and lower(f.status) not in ('closed','resolved','approved','pass')
      and lower(f.review_state)<>'approved'
  ), open_remediation as (
    select r.id,r.finding_id,r.due_at,r.severity,r.remediation_plan,i.property_id
    from public.compliance_remediation_actions r
    join public.compliance_findings f on f.id=r.finding_id
    join public.certification_import_items i on i.id=f.item_id
    where f.user_id=v_user_id and i.user_id=v_user_id
      and lower(r.status) not in ('closed','resolved','approved','cancelled')
  ), overdue_actions as (
    select a.id,a.action_type,a.due_date,a.program_code
    from public.pha_family_actions a
    where a.user_id=v_user_id and a.due_date<_as_of
      and lower(a.workflow_status) not in ('completed','closed','approved','cancelled')
  ), regulatory_changes as (
    select d.id,d.current_source_node_id,d.compared_at
    from public.regulatory_diff_reports d
    where d.user_id=v_user_id and d.diff_status='awaiting_authorized_review'
  ), attention as (
    select 1 as priority,'critical_finding'::text as attention_type,f.id::text as record_id,
      'Critical finding requires review'::text as title,f.explanation as detail,
      f.property_id::text as property_id,null::date as due_date,'compliance_findings'::text as source_table
    from critical_findings f
    union all
    select 2,'overdue_remediation',r.id::text,'Remediation is overdue',r.remediation_plan,
      r.property_id::text,r.due_at::date,'compliance_remediation_actions'
    from open_remediation r where r.due_at::date<_as_of
    union all
    select 2,'overdue_certification',a.id::text,'Certification action is overdue',a.action_type,
      null,a.due_date,'pha_family_actions'
    from overdue_actions a
    union all
    select 3,'regulatory_change_review',d.id::text,'Regulatory change awaits authorized review',
      'Review the preserved regulatory diff and impact analysis before any activation.',
      null,null,'regulatory_diff_reports'
    from regulatory_changes d
    union all
    select 4,'remediation_sla',r.id::text,'Remediation is approaching SLA',r.remediation_plan,
      r.property_id::text,r.due_at::date,'compliance_remediation_actions'
    from open_remediation r where r.due_at::date between _as_of and _as_of+7
    union all
    select 5,'property_below_readiness',p.id::text,'Property is below readiness threshold',
      p.name||' is at '||p.readiness_score||' against threshold '||_readiness_threshold||'.',
      p.id::text,null,'portfolio_properties'
    from properties_below p
  )
  select jsonb_build_object(
    'as_of',_as_of,'generated_at',clock_timestamp(),
    'method','structured-control-center-v1',
    'readiness_threshold',_readiness_threshold,
    'summary',jsonb_build_object(
      'portfolio_size',(select count(*)::integer from public.portfolio_properties p where p.user_id=v_user_id),
      'units',(select count(*)::integer from public.portfolio_units u where u.user_id=v_user_id),
      'certifications_in_progress',(select count(*)::integer from public.certification_import_items i
        where i.user_id=v_user_id and lower(i.status) not in
          ('completed','processed','approved','archived','cancelled','failed')),
      'audit_readiness',v_readiness->'score',
      'critical_findings',(select count(*)::integer from critical_findings),
      'overdue_items',
        (select count(*)::integer from open_remediation r where r.due_at::date<_as_of)
        +(select count(*)::integer from overdue_actions),
      'regulatory_changes_requiring_attention',(select count(*)::integer from regulatory_changes),
      'remediation_approaching_sla',
        (select count(*)::integer from open_remediation r where r.due_at::date between _as_of and _as_of+7),
      'properties_below_readiness',(select count(*)::integer from properties_below)
    ),
    'properties_below_readiness',coalesce((
      select jsonb_agg(to_jsonb(p) order by p.readiness_score,p.name,p.id) from properties_below p
    ),'[]'::jsonb),
    'needs_attention_today',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.priority,a.due_date nulls last,a.record_id) from attention a
    ),'[]'::jsonb),
    'readiness_deductions',v_readiness->'deductions'
  ) into v_result;
  return v_result;
end;
$control_center$;

revoke all on function public.compliance_control_center(date,integer) from public,anon;
grant execute on function public.compliance_control_center(date,integer) to authenticated;
comment on function public.compliance_control_center(date,integer) is
  'Executive attention queue grounded only in tenant-owned structured CertivoIQ records.';
