-- Rollback-only UAT for the state-rule deterministic release activation boundary.
-- Run after 20260830031000_bind_state_rule_activation_to_validated_release.sql.

begin;

do $$
declare
  invalid_active integer;
  invalid_release integer;
  direct_authenticated_write boolean;
  anon_read boolean;
  authenticated_rpc boolean;
  service_rpc boolean;
begin
  select count(*)
  into invalid_active
  from public.state_rule_pack_candidates pack
  where pack.state_code <> 'US'
    and pack.compliance_activation_allowed
    and not exists (
      select 1
      from public.state_rule_pack_releases release
      join public.state_rule_pack_activation_events source_approval
        on source_approval.id = release.source_activation_event_id
      where release.pack_candidate_id = pack.id
        and release.status = 'validated'::public.coverage_status
        and release.source_snapshot_sha256 = source_approval.source_snapshot_sha256
        and release.effective_from <= current_date
        and release.validated_rule_count > 0
        and release.fixture_count >= 5
        and release.failed_fixture_count = 0
        and release.unresolved_conflict_count = 0
    );

  if invalid_active <> 0 then
    raise exception 'Executable state pack exists without matching validated deterministic release: %', invalid_active;
  end if;

  select count(*)
  into invalid_release
  from public.state_rule_pack_releases release
  where release.status = 'validated'::public.coverage_status
    and (
      release.pack_candidate_id is null
      or release.source_activation_event_id is null
      or release.source_snapshot_sha256 !~ '^[0-9a-f]{64}$'
      or release.source_manifest_sha256 !~ '^[0-9a-f]{64}$'
      or release.rule_set_sha256 !~ '^[0-9a-f]{64}$'
      or release.fixture_set_sha256 !~ '^[0-9a-f]{64}$'
      or release.conflict_set_sha256 !~ '^[0-9a-f]{64}$'
      or release.validated_rule_count <= 0
      or release.fixture_count < 5
      or release.failed_fixture_count <> 0
      or release.unresolved_conflict_count <> 0
      or release.approved_by is null
      or release.approved_at is null
      or release.effective_from is null
      or nullif(btrim(release.engine_build), '') is null
    );

  if invalid_release <> 0 then
    raise exception 'Validated release evidence invariant failed: %', invalid_release;
  end if;

  direct_authenticated_write := has_table_privilege(
    'authenticated', 'public.state_rule_pack_releases', 'INSERT'
  );
  anon_read := has_table_privilege(
    'anon', 'public.state_rule_pack_releases', 'SELECT'
  );
  authenticated_rpc := has_function_privilege(
    'authenticated',
    'public.record_validated_state_rule_pack_release(uuid,text,date,uuid,timestamptz,integer,integer,integer,integer,text,text,text,text,text,text,text,jsonb)',
    'EXECUTE'
  );
  service_rpc := has_function_privilege(
    'service_role',
    'public.record_validated_state_rule_pack_release(uuid,text,date,uuid,timestamptz,integer,integer,integer,integer,text,text,text,text,text,text,text,jsonb)',
    'EXECUTE'
  );

  if direct_authenticated_write then
    raise exception 'Authenticated clients retain direct INSERT on state rule releases';
  end if;
  if anon_read then
    raise exception 'Anonymous clients can read state rule releases';
  end if;
  if authenticated_rpc then
    raise exception 'Authenticated clients can execute the server-only release recorder';
  end if;
  if not service_rpc then
    raise exception 'Service role cannot execute the controlled release recorder';
  end if;
end
$$;

select
  status,
  count(*) as pack_count
from public.state_rule_pack_candidates
where state_code <> 'US'
group by status
order by status;

select
  status::text,
  count(*) as release_count
from public.state_rule_pack_releases
group by status
order by status;

rollback;
