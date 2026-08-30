-- Bind executable state-rule activation to a validated deterministic release.
-- Source verification and its independent approval remain a separate governance stage.
-- Certification Final Review Confirmation is intentionally out of scope here.

alter table public.state_rule_pack_releases
  add column if not exists pack_candidate_id uuid references public.state_rule_pack_candidates(id) on delete restrict,
  add column if not exists source_activation_event_id uuid references public.state_rule_pack_activation_events(id) on delete restrict,
  add column if not exists source_snapshot_sha256 text,
  add column if not exists source_manifest_sha256 text,
  add column if not exists rule_set_sha256 text,
  add column if not exists fixture_set_sha256 text,
  add column if not exists conflict_set_sha256 text,
  add column if not exists fixture_count integer not null default 0,
  add column if not exists failed_fixture_count integer not null default 0,
  add column if not exists unresolved_conflict_count integer not null default 0,
  add column if not exists engine_build text,
  add column if not exists release_evidence jsonb not null default '{}'::jsonb;

alter table public.state_rule_pack_releases
  drop constraint if exists state_rule_pack_releases_validated_evidence_check;
alter table public.state_rule_pack_releases
  add constraint state_rule_pack_releases_validated_evidence_check
  check (
    status <> 'validated'::public.coverage_status
    or (
      pack_candidate_id is not null
      and source_activation_event_id is not null
      and source_snapshot_sha256 ~ '^[0-9a-f]{64}$'
      and source_manifest_sha256 ~ '^[0-9a-f]{64}$'
      and rule_set_sha256 ~ '^[0-9a-f]{64}$'
      and fixture_set_sha256 ~ '^[0-9a-f]{64}$'
      and conflict_set_sha256 ~ '^[0-9a-f]{64}$'
      and validated_rule_count > 0
      and fixture_count >= 5
      and failed_fixture_count = 0
      and unresolved_conflict_count = 0
      and approved_by is not null
      and approved_at is not null
      and effective_from is not null
      and nullif(btrim(engine_build), '') is not null
      and jsonb_typeof(release_evidence) = 'object'
    )
  );

alter table public.state_rule_pack_releases
  drop constraint if exists state_rule_pack_releases_nonnegative_counts_check;
alter table public.state_rule_pack_releases
  add constraint state_rule_pack_releases_nonnegative_counts_check
  check (
    validated_rule_count >= 0
    and fixture_count >= 0
    and failed_fixture_count >= 0
    and unresolved_conflict_count >= 0
  );

create unique index if not exists state_rule_pack_releases_exact_release_key
  on public.state_rule_pack_releases(
    pack_candidate_id,
    source_snapshot_sha256,
    source_manifest_sha256,
    rule_set_sha256,
    fixture_set_sha256
  )
  where status = 'validated'::public.coverage_status;

create index if not exists state_rule_pack_releases_candidate_status_effective_idx
  on public.state_rule_pack_releases(pack_candidate_id, status, effective_from desc, approved_at desc);

-- Existing broad table grants predate the controlled governance surface. Keep release
-- records read-only to signed-in users; all writes occur through a server-only RPC.
alter table public.state_rule_pack_releases enable row level security;
revoke all on table public.state_rule_pack_releases from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_pack_releases from authenticated;
grant select on table public.state_rule_pack_releases to authenticated;
grant all on table public.state_rule_pack_releases to service_role;

drop policy if exists "Signed-in users can view pack releases" on public.state_rule_pack_releases;
create policy "Managers can view state rule pack releases"
on public.state_rule_pack_releases
for select
to authenticated
using (
  exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  )
);

create or replace function public.record_validated_state_rule_pack_release(
  p_pack_candidate_id uuid,
  p_version text,
  p_effective_from date,
  p_approved_by uuid,
  p_approved_at timestamptz,
  p_validated_rule_count integer,
  p_fixture_count integer,
  p_failed_fixture_count integer,
  p_unresolved_conflict_count integer,
  p_source_snapshot_sha256 text,
  p_source_manifest_sha256 text,
  p_rule_set_sha256 text,
  p_fixture_set_sha256 text,
  p_conflict_set_sha256 text,
  p_engine_build text,
  p_limitations text default null,
  p_release_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pack public.state_rule_pack_candidates%rowtype;
  v_snapshot record;
  v_source_approval public.state_rule_pack_activation_events%rowtype;
  v_release_id uuid;
  v_result jsonb;
  v_hashes text[];
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required to record validated state-rule releases';
  end if;

  select *
  into v_pack
  from public.state_rule_pack_candidates pack
  where pack.id = p_pack_candidate_id
  for update;

  if not found or v_pack.state_code = 'US' then
    raise exception 'State rule pack candidate not found';
  end if;

  select *
  into v_snapshot
  from public.state_rule_pack_source_snapshot(v_pack.id);

  if not coalesce(v_snapshot.sources_ready, false) then
    raise exception 'Every required state and shared federal source must be verified first';
  end if;

  if p_source_snapshot_sha256 is null
     or p_source_snapshot_sha256 <> v_snapshot.source_snapshot_sha256 then
    raise exception 'Validated release is not bound to the current source snapshot';
  end if;

  select event.*
  into v_source_approval
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id = v_pack.id
    and event.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
  order by event.created_at desc
  limit 1;

  if v_source_approval.id is null then
    raise exception 'Independent source validation approval is required before deterministic release';
  end if;

  if p_approved_by is null
     or p_approved_by = v_source_approval.activator_id
     or p_approved_by = any(v_source_approval.first_reviewer_ids) then
    raise exception 'Deterministic release approval must be independent from source reviewers and source approver';
  end if;

  if nullif(btrim(coalesce(p_version, '')), '') is null then
    raise exception 'Release version is required';
  end if;
  if p_effective_from is null then
    raise exception 'Release effective date is required';
  end if;
  if p_approved_at is null or p_approved_at > now() + interval '5 minutes' then
    raise exception 'Valid independent approval timestamp is required';
  end if;
  if p_validated_rule_count is null or p_validated_rule_count <= 0 then
    raise exception 'At least one validated deterministic rule is required';
  end if;
  if p_fixture_count is null or p_fixture_count < 5 then
    raise exception 'All required fixture categories must be represented';
  end if;
  if coalesce(p_failed_fixture_count, -1) <> 0 then
    raise exception 'Validated release cannot contain failed fixtures';
  end if;
  if coalesce(p_unresolved_conflict_count, -1) <> 0 then
    raise exception 'Validated release cannot contain unresolved source conflicts';
  end if;
  if nullif(btrim(coalesce(p_engine_build, '')), '') is null then
    raise exception 'Release engine build is required';
  end if;
  if p_release_evidence is null or jsonb_typeof(p_release_evidence) <> 'object' then
    raise exception 'Release evidence must be a JSON object';
  end if;

  v_hashes := array[
    p_source_snapshot_sha256,
    p_source_manifest_sha256,
    p_rule_set_sha256,
    p_fixture_set_sha256,
    p_conflict_set_sha256
  ];
  if exists (
    select 1
    from unnest(v_hashes) hash_value
    where hash_value is null or hash_value !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'Every release identity must use a lowercase SHA-256 hash';
  end if;

  insert into public.state_rule_pack_releases (
    state_code,
    version,
    status,
    effective_from,
    approved_by,
    approved_at,
    validated_rule_count,
    limitations,
    pack_candidate_id,
    source_activation_event_id,
    source_snapshot_sha256,
    source_manifest_sha256,
    rule_set_sha256,
    fixture_set_sha256,
    conflict_set_sha256,
    fixture_count,
    failed_fixture_count,
    unresolved_conflict_count,
    engine_build,
    release_evidence
  )
  values (
    v_pack.state_code,
    btrim(p_version),
    'validated'::public.coverage_status,
    p_effective_from,
    p_approved_by,
    p_approved_at,
    p_validated_rule_count,
    nullif(btrim(coalesce(p_limitations, '')), ''),
    v_pack.id,
    v_source_approval.id,
    p_source_snapshot_sha256,
    p_source_manifest_sha256,
    p_rule_set_sha256,
    p_fixture_set_sha256,
    p_conflict_set_sha256,
    p_fixture_count,
    p_failed_fixture_count,
    p_unresolved_conflict_count,
    btrim(p_engine_build),
    p_release_evidence || jsonb_build_object(
      'control', 'deterministic_state_rule_release',
      'source_approval_event_id', v_source_approval.id,
      'source_snapshot_sha256', p_source_snapshot_sha256,
      'recorded_at', now()
    )
  )
  returning id into v_release_id;

  v_result := public.refresh_state_rule_pack_activation(
    v_pack.state_code,
    v_pack.inventory_generated_at
  );

  return v_result || jsonb_build_object(
    'release_id', v_release_id,
    'release_status', 'validated',
    'effective_from', p_effective_from,
    'validated_rule_count', p_validated_rule_count
  );
exception
  when unique_violation then
    raise exception 'This exact deterministic state-rule release is already recorded';
end;
$$;

revoke all on function public.record_validated_state_rule_pack_release(
  uuid,text,date,uuid,timestamptz,integer,integer,integer,integer,
  text,text,text,text,text,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.record_validated_state_rule_pack_release(
  uuid,text,date,uuid,timestamptz,integer,integer,integer,integer,
  text,text,text,text,text,text,text,jsonb
) to service_role;

create or replace function public.refresh_state_rule_pack_activation(
  p_state_code text,
  p_inventory_generated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pack public.state_rule_pack_candidates%rowtype;
  v_snapshot record;
  v_source_approval public.state_rule_pack_activation_events%rowtype;
  v_release public.state_rule_pack_releases%rowtype;
  v_status text;
  v_sources_approved boolean := false;
  v_active boolean := false;
  v_validated_on date;
begin
  select *
  into v_pack
  from public.state_rule_pack_candidates pack
  where pack.state_code = upper(trim(coalesce(p_state_code, '')))
    and pack.inventory_generated_at = p_inventory_generated_at
  for update;

  if not found then
    raise exception 'State rule pack candidate not found';
  end if;

  select *
  into v_snapshot
  from public.state_rule_pack_source_snapshot(v_pack.id);

  select event.*
  into v_source_approval
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id = v_pack.id
    and event.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
  order by event.created_at desc
  limit 1;

  v_sources_approved := coalesce(v_snapshot.sources_ready, false)
    and v_source_approval.id is not null;

  if v_sources_approved then
    select release.*
    into v_release
    from public.state_rule_pack_releases release
    where release.pack_candidate_id = v_pack.id
      and release.source_activation_event_id = v_source_approval.id
      and release.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
      and release.status = 'validated'::public.coverage_status
      and release.effective_from <= current_date
      and release.validated_rule_count > 0
      and release.fixture_count >= 5
      and release.failed_fixture_count = 0
      and release.unresolved_conflict_count = 0
    order by release.effective_from desc, release.approved_at desc, release.created_at desc
    limit 1;
  end if;

  v_active := v_sources_approved and v_release.id is not null;

  v_status := case
    when v_active then 'active'
    when v_sources_approved then 'verified'
    when coalesce(v_snapshot.sources_ready, false) then 'awaiting_second_verification'
    when coalesce(v_snapshot.has_blocker, false) then 'blocked'
    when coalesce(v_snapshot.has_progress, false) then 'agent_verification_in_progress'
    else 'queued_for_agent_verification'
  end;

  update public.state_rule_pack_candidates pack
  set status = v_status,
      compliance_activation_allowed = v_active,
      agent_verification_required = not v_sources_approved,
      validated_on = case when v_active then v_release.approved_at::date else null end,
      blocked_source_count = (
        select count(*)::integer
        from public.state_rule_source_candidates source
        where source.state_code = v_pack.state_code
          and source.inventory_generated_at = v_pack.inventory_generated_at
          and source.agent_verification_status in ('blocked', 'rejected')
          and source.candidate_status <> 'EXCLUDED_REDUNDANT_SOURCE'
      ),
      updated_at = now()
  where pack.id = v_pack.id
  returning pack.validated_on into v_validated_on;

  return jsonb_build_object(
    'pack_candidate_id', v_pack.id,
    'state_code', v_pack.state_code,
    'pack_status', v_status,
    'sources_ready', coalesce(v_snapshot.sources_ready, false),
    'source_approval_recorded', v_source_approval.id is not null,
    'activation_recorded', v_source_approval.id is not null,
    'validated_release_recorded', v_release.id is not null,
    'compliance_activation_allowed', v_active,
    'first_reviewer_count', coalesce(array_length(v_snapshot.first_reviewer_ids, 1), 0),
    'validated_on', v_validated_on
  );
end;
$$;

revoke all on function public.refresh_state_rule_pack_activation(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.refresh_state_rule_pack_activation(text, timestamptz)
  to service_role;

-- Reconcile all candidates. Existing source approvals remain valid evidence, but no
-- candidate is executable until a matching deterministic release is recorded.
do $$
declare
  v_pack record;
begin
  for v_pack in
    select state_code, inventory_generated_at
    from public.state_rule_pack_candidates
  loop
    perform public.refresh_state_rule_pack_activation(
      v_pack.state_code,
      v_pack.inventory_generated_at
    );
  end loop;
end;
$$;

-- Fail closed if a candidate somehow remains executable without a validated release.
do $$
declare
  v_invalid integer;
begin
  select count(*)
  into v_invalid
  from public.state_rule_pack_candidates pack
  where pack.state_code <> 'US'
    and pack.compliance_activation_allowed
    and not exists (
      select 1
      from public.state_rule_pack_releases release
      where release.pack_candidate_id = pack.id
        and release.status = 'validated'::public.coverage_status
        and release.effective_from <= current_date
        and release.validated_rule_count > 0
        and release.fixture_count >= 5
        and release.failed_fixture_count = 0
        and release.unresolved_conflict_count = 0
    );

  if v_invalid <> 0 then
    raise exception 'Fail-closed invariant violated for % state rule packs', v_invalid;
  end if;
end;
$$;
