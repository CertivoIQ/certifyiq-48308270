-- Phase 7: explainable, deterministic Continuous Audit Readiness.
-- Every deduction is an attributable record; no model or opaque score is used.

create or replace function public.audit_readiness_score(_as_of date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with deductions as (
  select
    'open-finding:'||f.id::text as deduction_id,
    'open_finding'::text as deduction_code,
    case lower(f.severity) when 'critical' then 15 when 'major' then 6 else 2 end as points,
    'finding'::text as entity_type,f.id::text as entity_id,
    i.property_id::text as property_id,
    coalesce(i.program_codes[1],f.rule_pack_id) as program_code,
    null::date as due_date,
    'Open '||lower(f.severity)||' finding' as title,
    f.explanation,
    'Resolve the finding and attach the required correction evidence.'::text as remediation,
    'compliance_findings'::text as source_table
  from public.compliance_findings f
  join public.certification_import_items i on i.id=f.item_id
  where f.user_id=(select auth.uid())
    and lower(f.status) not in ('closed','resolved','approved','pass')
    and lower(f.review_state) <> 'approved'

  union all
  select
    'overdue-certification:'||a.id::text,'overdue_certification',10,
    'family_action',a.id::text,null,a.program_code,a.due_date,
    'Overdue certification action',
    'The '||a.action_type||' action passed its recorded due date without completion.',
    'Complete the certification workflow and final authorized review.',
    'pha_family_actions'
  from public.pha_family_actions a
  where a.user_id=(select auth.uid()) and a.due_date < _as_of
    and lower(a.workflow_status) not in ('completed','closed','approved')

  union all
  select
    'missing-signature:'||l.id::text,'missing_signature',10,
    'lease',l.id::text,null,null,l.lease_start,
    'Missing required lease signature',
    'The lease record is not marked signature complete.',
    'Obtain and verify every required signature before audit submission.',
    'pha_public_housing_leases'
  from public.pha_public_housing_leases l
  where l.workspace_user_id=(select auth.uid()) and not l.signature_complete
    and lower(l.status) not in ('cancelled','void')

  union all
  select
    'expired-verification:'||a.id::text,'expired_verification',8,
    'family_action',a.id::text,null,a.program_code,a.due_date,
    'Verification incomplete after due date',
    'Required verification remained incomplete when the action became due.',
    'Collect current verification and complete the controlled review.',
    'pha_family_actions'
  from public.pha_family_actions a
  where a.user_id=(select auth.uid()) and not a.verification_complete
    and a.due_date < _as_of
    and lower(a.workflow_status) not in ('completed','closed','cancelled')

  union all
  select
    'unresolved-correction:'||r.id::text,'unresolved_correction',
    case lower(r.severity) when 'critical' then 12 when 'major' then 6 else 2 end,
    'remediation_action',r.id::text,i.property_id::text,
    coalesce(i.program_codes[1],f.rule_pack_id),
    r.due_at::date,'Unresolved correction',
    coalesce(r.remediation_summary,r.remediation_plan),
    r.remediation_plan,'compliance_remediation_actions'
  from public.compliance_remediation_actions r
  join public.compliance_findings f on f.id=r.finding_id
  join public.certification_import_items i on i.id=f.item_id
  where f.user_id=(select auth.uid()) and upper(r.status) <> 'CLOSED'

  union all
  select
    'stale-rule-pack:'||a.id::text,'stale_rule_pack_coverage',8,
    'family_action',a.id::text,null,a.program_code,a.due_date,
    'Current rule version not validated',
    'The workflow has not validated the current controlled rule version.',
    'Validate the applicable controlled source release and rule version.',
    'pha_family_actions'
  from public.pha_family_actions a
  where a.user_id=(select auth.uid()) and not a.current_rule_version_validated
    and lower(a.workflow_status) not in ('completed','closed','cancelled')

  union all
  select
    'required-report:'||a.id::text,'required_report',6,
    'family_action',a.id::text,null,a.program_code,a.due_date,
    'Required reporting path is not validated',
    'The action has no validated reporting path for its required submission.',
    'Validate the reporting destination and complete the required report.',
    'pha_family_actions'
  from public.pha_family_actions a
  where a.user_id=(select auth.uid()) and not a.reporting_path_validated
    and lower(a.workflow_status) not in ('completed','closed','cancelled')

  union all
  select
    'upcoming-deadline:'||a.id::text,'upcoming_deadline',3,
    'family_action',a.id::text,null,a.program_code,a.due_date,
    'Upcoming compliance deadline',
    'The '||a.action_type||' action is due within 30 days.',
    'Assign the action and complete it before '||a.due_date::text||'.',
    'pha_family_actions'
  from public.pha_family_actions a
  where a.user_id=(select auth.uid())
    and a.due_date between _as_of and (_as_of+30)
    and lower(a.workflow_status) not in ('completed','closed','cancelled')
), totals as (
  select coalesce(sum(points),0)::integer as total_deduction from deductions
)
select jsonb_build_object(
  'as_of',_as_of,
  'score',greatest(0,100-(select total_deduction from totals)),
  'total_deduction',least(100,(select total_deduction from totals)),
  'method','deterministic-v1',
  'deductions',coalesce((
    select jsonb_agg(to_jsonb(d) order by d.points desc,d.due_date nulls last,d.deduction_id)
    from deductions d
  ),'[]'::jsonb),
  'get_me_to_100',coalesce((
    select jsonb_agg(jsonb_build_object(
      'queue_order',row_number() over(order by d.points desc,d.due_date nulls last,d.deduction_id),
      'deduction_id',d.deduction_id,'points_recovered',d.points,
      'title',d.title,'remediation',d.remediation,'entity_type',d.entity_type,
      'entity_id',d.entity_id,'property_id',d.property_id,
      'program_code',d.program_code,'due_date',d.due_date,'source_table',d.source_table
    ) order by d.points desc,d.due_date nulls last,d.deduction_id)
    from deductions d
  ),'[]'::jsonb)
);
$$;

revoke all on function public.audit_readiness_score(date) from public,anon;
grant execute on function public.audit_readiness_score(date) to authenticated;
comment on function public.audit_readiness_score(date) is
  'Explainable point-in-time readiness score. Every deduction maps to an RLS-visible source record.';
