-- Phase 9: Compliance Time Machine.
-- Reconstructs only from immutable replay events, version-effective records, and
-- readiness snapshots that were actually stored at or before the requested time.

create index if not exists audit_replay_events_certification_item_fk_idx
  on public.audit_replay_events(certification_item_id);
do $ begin
  if to_regclass('public.auditor_access_events') is not null then
    execute 'create index if not exists auditor_access_events_actor_fk_idx on public.auditor_access_events(actor_id) where actor_id is not null';
  end if;
  if to_regclass('public.auditor_access_grants') is not null then
    execute 'create index if not exists auditor_access_grants_created_by_fk_idx on public.auditor_access_grants(created_by)';
    execute 'create index if not exists auditor_access_grants_revoked_by_fk_idx on public.auditor_access_grants(revoked_by) where revoked_by is not null';
  end if;
end $;

create or replace function public.compliance_time_machine_state(_as_of timestamptz)
returns jsonb
language sql stable security invoker set search_path=''
as $$
with visible_events as (
  select e.*
  from public.audit_replay_events e
  where e.user_id=(select auth.uid()) and e.occurred_at<=_as_of
), resolved_findings as (
  select distinct w.finding_id
  from visible_events e
  join public.certification_workflow_events w
    on e.source_table='public.certification_workflow_events'
   and w.id::text=e.source_id
  where e.event_type='finding_resolved' and w.finding_id is not null
), open_findings as (
  select e.*
  from visible_events e
  where e.event_type='finding_created'
    and e.source_table='public.compliance_findings'
    and not exists (
      select 1 from resolved_findings r where r.finding_id::text=e.source_id
    )
), submitted_corrections as (
  select e.*,w.finding_id
  from visible_events e
  join public.certification_workflow_events w
    on e.source_table='public.certification_workflow_events'
   and w.id::text=e.source_id
  where e.event_type='correction_submitted'
), unresolved_corrections as (
  select c.*
  from submitted_corrections c
  where c.finding_id is null or not exists (
    select 1 from resolved_findings r where r.finding_id=c.finding_id
  )
), applicable_rules as (
  select n.*
  from public.compliance_graph_nodes n
  where n.user_id=(select auth.uid()) and n.node_kind='rule'
    and n.recorded_at<=_as_of
    and n.effective_from<=_as_of::date
    and (n.effective_to is null or n.effective_to>=_as_of::date)
), program_exposure as (
  select a.program_code,count(distinct a.property_id)::integer as property_count
  from public.property_program_applicability a
  where a.user_id=(select auth.uid()) and a.created_at<=_as_of
    and a.effective_from<=_as_of::date
    and (a.effective_to is null or a.effective_to>=_as_of::date)
  group by a.program_code
), readiness as (
  select s.*
  from public.portfolio_readiness_snapshots s
  where s.user_id=(select auth.uid()) and s.calculated_at<=_as_of
  order by s.calculated_at desc limit 1
)
select jsonb_build_object(
  'as_of',_as_of,
  'historical_basis','stored-versioned-state-v1',
  'readiness',coalesce((
    select jsonb_build_object(
      'status','Available','score',readiness_score,
      'calculated_at',calculated_at,'snapshot_id',id,
      'property_count',property_count,'audit_ready_count',audit_ready_count,
      'at_risk_count',at_risk_count,'critical_findings',critical_findings,
      'open_corrective_actions',open_corrective_actions
    ) from readiness
  ),jsonb_build_object(
    'status','Unavailable',
    'reason','No stored readiness snapshot existed at or before the requested time. Present-day state was not regenerated backward.'
  )),
  'open_findings',coalesce((
    select jsonb_agg(jsonb_build_object(
      'finding_id',source_id,'certification_item_id',certification_item_id,
      'property_id',property_id,'occurred_at',occurred_at,
      'rule_version',rule_version,'source_version',source_version,
      'engine_version',engine_version,'snapshot',event_snapshot,
      'event_sha256',event_sha256
    ) order by occurred_at,source_id) from open_findings
  ),'[]'::jsonb),
  'unresolved_corrections',coalesce((
    select jsonb_agg(jsonb_build_object(
      'workflow_event_id',source_id,'finding_id',finding_id,
      'certification_item_id',certification_item_id,'property_id',property_id,
      'occurred_at',occurred_at,'snapshot',event_snapshot,'event_sha256',event_sha256
    ) order by occurred_at,source_id) from unresolved_corrections
  ),'[]'::jsonb),
  'applicable_rules',coalesce((
    select jsonb_agg(jsonb_build_object(
      'node_id',id,'canonical_key',canonical_key,'label',label,
      'program_code',program_code,'jurisdiction',jurisdiction,
      'rule_version',rule_version,'source_version',source_version,
      'effective_from',effective_from,'effective_to',effective_to,
      'engine_version',engine_version,'evidence_manifest_id',evidence_manifest_id
    ) order by canonical_key,rule_version) from applicable_rules
  ),'[]'::jsonb),
  'program_exposure',coalesce((
    select jsonb_agg(jsonb_build_object(
      'program_code',program_code,'property_count',property_count
    ) order by program_code) from program_exposure
  ),'[]'::jsonb),
  'counts',jsonb_build_object(
    'open_findings',(select count(*) from open_findings),
    'unresolved_corrections',(select count(*) from unresolved_corrections),
    'applicable_rules',(select count(*) from applicable_rules),
    'exposed_programs',(select count(*) from program_exposure)
  )
);
$$;
revoke all on function public.compliance_time_machine_state(timestamptz) from public,anon;
grant execute on function public.compliance_time_machine_state(timestamptz) to authenticated;

create or replace function public.compliance_time_machine(
  _as_of timestamptz,
  _compare_to timestamptz default null
)
returns jsonb
language sql stable security invoker set search_path=''
as $$
with current_state as (
  select public.compliance_time_machine_state(_as_of) as state
), comparison_state as (
  select case when _compare_to is null then null
    else public.compliance_time_machine_state(_compare_to) end as state
), states as (
  select c.state as current_state,p.state as comparison_state
  from current_state c cross join comparison_state p
)
select jsonb_build_object(
  'as_of',_as_of,'compare_to',_compare_to,
  'current_state',current_state,
  'comparison_state',comparison_state,
  'changes',case when comparison_state is null then null else jsonb_build_object(
    'open_findings',
      (current_state->'counts'->>'open_findings')::integer-
      (comparison_state->'counts'->>'open_findings')::integer,
    'unresolved_corrections',
      (current_state->'counts'->>'unresolved_corrections')::integer-
      (comparison_state->'counts'->>'unresolved_corrections')::integer,
    'applicable_rules',
      (current_state->'counts'->>'applicable_rules')::integer-
      (comparison_state->'counts'->>'applicable_rules')::integer,
    'exposed_programs',
      (current_state->'counts'->>'exposed_programs')::integer-
      (comparison_state->'counts'->>'exposed_programs')::integer,
    'readiness_score',
      case when current_state->'readiness'->>'status'='Available'
             and comparison_state->'readiness'->>'status'='Available'
        then (current_state->'readiness'->>'score')::numeric-
             (comparison_state->'readiness'->>'score')::numeric
        else null end
  ) end,
  'notice','Historical output uses stored events, effective-dated records, and recorded snapshots only.'
)
from states;
$$;
revoke all on function public.compliance_time_machine(timestamptz,timestamptz) from public,anon;
grant execute on function public.compliance_time_machine(timestamptz,timestamptz) to authenticated;
