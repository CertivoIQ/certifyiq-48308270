-- Rollback-only checks for the deterministic state-rule release workbench.
-- Run after applying 20260830103100_deterministic_state_rule_release_workbench.sql.

begin;

do $$
declare
  state_pack_count integer;
  work_item_count integer;
  invalid_active_count integer;
  unbound_rule_count integer;
  rls_missing_count integer;
begin
  select count(*)::integer into state_pack_count
  from public.state_rule_pack_candidates
  where state_code <> 'US';

  select count(*)::integer into work_item_count
  from public.state_rule_release_work_items;

  if state_pack_count <> 50 or work_item_count <> state_pack_count then
    raise exception 'Expected one fail-closed work item for every state pack: states %, work items %',
      state_pack_count, work_item_count;
  end if;

  select count(*)::integer into invalid_active_count
  from public.state_rule_pack_candidates pack
  where pack.state_code <> 'US'
    and pack.compliance_activation_allowed
    and not exists (
      select 1
      from public.state_rule_pack_releases release
      where release.pack_candidate_id = pack.id
        and release.status = 'validated'::public.coverage_status
        and release.release_evidence->>'control' = 'deterministic_state_rule_workbench'
        and release.effective_from <= current_date
    );

  if invalid_active_count <> 0 then
    raise exception 'Found % active state packs without deterministic releases', invalid_active_count;
  end if;

  select count(*)::integer into unbound_rule_count
  from public.state_rule_deterministic_rules rule
  left join public.state_rule_source_candidates source
    on source.id = rule.source_candidate_id
  where rule.validation_status = 'VALIDATED'
    and (
      source.id is null
      or source.source_sha256 is null
      or rule.source_sha256 <> source.source_sha256
      or rule.source_page < 1
      or nullif(btrim(rule.citation),'') is null
    );

  if unbound_rule_count <> 0 then
    raise exception 'Found % validated rules not bound to exact source/page evidence', unbound_rule_count;
  end if;

  select count(*)::integer into rls_missing_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in (
      'state_rule_release_work_items',
      'state_rule_source_extraction_assessments',
      'state_rule_deterministic_rules',
      'state_rule_test_fixtures',
      'state_rule_source_conflicts',
      'state_rule_pack_release_assessments',
      'state_rule_release_approval_events'
    )
    and not relation.relrowsecurity;

  if rls_missing_count <> 0 then
    raise exception 'RLS missing from % deterministic release tables', rls_missing_count;
  end if;

  if has_table_privilege('authenticated','public.state_rule_deterministic_rules','INSERT')
     or has_table_privilege('authenticated','public.state_rule_test_fixtures','INSERT')
     or has_table_privilege('authenticated','public.state_rule_source_conflicts','INSERT') then
    raise exception 'Authenticated clients can write deterministic release evidence directly';
  end if;

  if has_table_privilege('service_role','public.state_rule_pack_releases','INSERT') then
    raise exception 'Service role can bypass the deterministic release finalizer with direct table inserts';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.record_validated_state_rule_pack_release(uuid,text,date,uuid,timestamptz,integer,integer,integer,integer,text,text,text,text,text,text,text,jsonb)',
      'EXECUTE'
    ) then
    raise exception 'Legacy caller-supplied release RPC remains executable';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.approve_state_rule_release_candidate(uuid,text,text)',
      'EXECUTE'
    ) then
    raise exception 'Independent release-approval RPC is not available to authorized signed-in reviewers';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.finalize_state_rule_pack_release(uuid,text,date,text,text)',
      'EXECUTE'
    ) then
    raise exception 'Authenticated clients can finalize deterministic releases';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.finalize_state_rule_pack_release(uuid,text,date,text,text)',
      'EXECUTE'
    ) then
    raise exception 'Trusted server cannot execute deterministic release finalizer';
  end if;
end;
$$;

select
  status,
  count(*)::integer as pack_count
from public.state_rule_release_work_items
group by status
order by status;

rollback;
