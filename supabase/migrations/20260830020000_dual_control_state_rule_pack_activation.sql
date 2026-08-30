-- Two-stage state rule-pack activation.
-- Stage 1 verifies each exact source. Stage 2 requires a different active
-- Administrator to activate the completed pack. Existing evidence is preserved.

create table if not exists public.state_rule_pack_activation_events (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  inventory_generated_at timestamptz not null,
  activator_id uuid not null references auth.users(id) on delete restrict,
  first_reviewer_ids uuid[] not null,
  verified_source_count integer not null check (verified_source_count > 0),
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  activated_on date not null default current_date,
  notes text not null check (char_length(notes) between 10 and 4000),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint state_rule_pack_activation_events_snapshot_key
    unique (pack_candidate_id, source_snapshot_sha256),
  constraint state_rule_pack_activation_events_distinct_activator
    check (not (activator_id = any(first_reviewer_ids)))
);

create index if not exists state_rule_pack_activation_events_pack_created_idx
  on public.state_rule_pack_activation_events(pack_candidate_id, created_at desc);

alter table public.state_rule_pack_activation_events enable row level security;

revoke all on table public.state_rule_pack_activation_events from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_pack_activation_events from authenticated;
grant select on table public.state_rule_pack_activation_events to authenticated;
grant all on table public.state_rule_pack_activation_events to service_role;

drop policy if exists "Managers can view state pack activation events"
  on public.state_rule_pack_activation_events;
create policy "Managers can view state pack activation events"
on public.state_rule_pack_activation_events
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

create or replace function public.block_state_rule_pack_activation_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'State rule pack activation events are immutable';
end;
$$;

revoke all on function public.block_state_rule_pack_activation_event_mutation() from public, anon, authenticated;
grant execute on function public.block_state_rule_pack_activation_event_mutation() to service_role;

drop trigger if exists block_state_rule_pack_activation_event_mutation
  on public.state_rule_pack_activation_events;
create trigger block_state_rule_pack_activation_event_mutation
before update or delete on public.state_rule_pack_activation_events
for each row execute function public.block_state_rule_pack_activation_event_mutation();

alter table public.state_rule_pack_candidates
  drop constraint if exists state_rule_pack_candidates_status_check;
alter table public.state_rule_pack_candidates
  add constraint state_rule_pack_candidates_status_check
  check (
    status in (
      'queued_for_agent_verification',
      'agent_verification_in_progress',
      'awaiting_second_verification',
      'blocked',
      'verified',
      'active',
      'rejected'
    )
  );

create or replace function public.state_rule_pack_source_snapshot(p_pack_candidate_id uuid)
returns table (
  sources_ready boolean,
  has_blocker boolean,
  has_progress boolean,
  first_reviewer_ids uuid[],
  verified_source_count integer,
  source_snapshot_sha256 text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with selected_pack as (
    select pack.id, pack.state_code, pack.inventory_generated_at
    from public.state_rule_pack_candidates pack
    where pack.id = p_pack_candidate_id
  ),
  required_sources as (
    select source.*
    from public.state_rule_source_candidates source
    join selected_pack pack
      on source.state_code = pack.state_code
     and source.inventory_generated_at = pack.inventory_generated_at
    where not (
      source.agent_verification_status = 'rejected'
      and source.candidate_status = 'EXCLUDED_REDUNDANT_SOURCE'
    )

    union all

    select source.*
    from public.state_rule_source_candidates source
    join selected_pack pack on pack.state_code <> 'US'
    where source.state_code = 'US'
      and source.inventory_generated_at = (
        select max(federal_pack.inventory_generated_at)
        from public.state_rule_pack_candidates federal_pack
        where federal_pack.state_code = 'US'
      )
      and not (
        source.agent_verification_status = 'rejected'
        and source.candidate_status = 'EXCLUDED_REDUNDANT_SOURCE'
      )
  ),
  source_reviews as (
    select
      source.id,
      source.agent_verification_status,
      source.exact_bytes_captured,
      source.source_sha256,
      source.retrieved_at,
      source.updated_at,
      review.reviewer_id
    from required_sources source
    left join lateral (
      select event.reviewer_id
      from public.state_rule_source_verification_events event
      where event.source_candidate_id = source.id
        and event.decision = 'verified'
      order by event.created_at desc, event.id desc
      limit 1
    ) review on true
  )
  select
    count(*) > 0
      and bool_and(
        source_reviews.agent_verification_status = 'verified'
        and source_reviews.exact_bytes_captured
        and source_reviews.source_sha256 is not null
        and source_reviews.retrieved_at is not null
        and source_reviews.reviewer_id is not null
      ) as sources_ready,
    coalesce(
      bool_or(source_reviews.agent_verification_status in ('blocked', 'rejected')),
      false
    ) as has_blocker,
    coalesce(
      bool_or(source_reviews.agent_verification_status <> 'queued_for_agent_verification'),
      false
    ) as has_progress,
    coalesce(
      array_agg(distinct source_reviews.reviewer_id)
        filter (where source_reviews.reviewer_id is not null),
      '{}'::uuid[]
    ) as first_reviewer_ids,
    count(*) filter (
      where source_reviews.agent_verification_status = 'verified'
        and source_reviews.reviewer_id is not null
    )::integer as verified_source_count,
    encode(
      digest(
        coalesce(
          string_agg(
            source_reviews.id::text || ':' ||
            coalesce(source_reviews.source_sha256, '') || ':' ||
            coalesce(source_reviews.retrieved_at::text, '') || ':' ||
            coalesce(source_reviews.reviewer_id::text, '') || ':' ||
            source_reviews.agent_verification_status || ':' ||
            source_reviews.updated_at::text,
            '|' order by source_reviews.id
          ),
          ''
        ),
        'sha256'
      ),
      'hex'
    ) as source_snapshot_sha256
  from source_reviews;
$$;

revoke all on function public.state_rule_pack_source_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.state_rule_pack_source_snapshot(uuid) to service_role;

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
  v_activation public.state_rule_pack_activation_events%rowtype;
  v_status text;
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
  into v_activation
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id = v_pack.id
    and event.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
  order by event.created_at desc
  limit 1;

  v_active := coalesce(v_snapshot.sources_ready, false) and v_activation.id is not null;

  v_status := case
    when v_active then 'active'
    when coalesce(v_snapshot.sources_ready, false) then 'awaiting_second_verification'
    when coalesce(v_snapshot.has_blocker, false) then 'blocked'
    when coalesce(v_snapshot.has_progress, false) then 'agent_verification_in_progress'
    else 'queued_for_agent_verification'
  end;

  update public.state_rule_pack_candidates pack
  set status = v_status,
      compliance_activation_allowed = v_active,
      agent_verification_required = not v_active,
      validated_on = case when v_active then v_activation.activated_on else null end,
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
    'activation_recorded', v_activation.id is not null,
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

create or replace function public.activate_state_rule_pack(
  p_pack_candidate_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pack public.state_rule_pack_candidates%rowtype;
  v_snapshot record;
  v_notes text := trim(coalesce(p_notes, ''));
  v_event_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level = 'admin'
  ) then
    raise exception 'Active Administrator authority required';
  end if;

  if char_length(v_notes) < 10 or char_length(v_notes) > 4000 then
    raise exception 'Activation notes must contain 10 to 4000 characters';
  end if;

  select *
  into v_pack
  from public.state_rule_pack_candidates pack
  where pack.id = p_pack_candidate_id
  for update;

  if not found then
    raise exception 'State rule pack candidate not found';
  end if;

  if v_pack.state_code = 'US' then
    raise exception 'The shared federal baseline is activated through each state pack';
  end if;

  select *
  into v_snapshot
  from public.state_rule_pack_source_snapshot(v_pack.id);

  if not coalesce(v_snapshot.sources_ready, false) then
    raise exception 'Every required state and shared federal source must complete first verification';
  end if;

  if coalesce(array_length(v_snapshot.first_reviewer_ids, 1), 0) = 0 then
    raise exception 'First-review evidence is unavailable';
  end if;

  if v_user_id = any(v_snapshot.first_reviewer_ids) then
    raise exception 'A different Administrator must activate this state pack';
  end if;

  insert into public.state_rule_pack_activation_events (
    pack_candidate_id,
    state_code,
    inventory_generated_at,
    activator_id,
    first_reviewer_ids,
    verified_source_count,
    source_snapshot_sha256,
    activated_on,
    notes,
    evidence
  )
  values (
    v_pack.id,
    v_pack.state_code,
    v_pack.inventory_generated_at,
    v_user_id,
    v_snapshot.first_reviewer_ids,
    v_snapshot.verified_source_count,
    v_snapshot.source_snapshot_sha256,
    current_date,
    v_notes,
    jsonb_build_object(
      'control', 'independent_second_validation',
      'state_code', v_pack.state_code,
      'inventory_generated_at', v_pack.inventory_generated_at,
      'verified_source_count', v_snapshot.verified_source_count,
      'first_reviewer_count', array_length(v_snapshot.first_reviewer_ids, 1)
    )
  )
  returning id into v_event_id;

  v_result := public.refresh_state_rule_pack_activation(
    v_pack.state_code,
    v_pack.inventory_generated_at
  );

  return v_result || jsonb_build_object(
    'activation_event_id', v_event_id,
    'activated_on', current_date
  );
exception
  when unique_violation then
    raise exception 'This exact state-pack source snapshot is already activated';
end;
$$;

revoke all on function public.activate_state_rule_pack(uuid, text) from public, anon;
grant execute on function public.activate_state_rule_pack(uuid, text) to authenticated;

create or replace function public.state_rule_pack_activation_readiness()
returns table (
  pack_candidate_id uuid,
  state_code text,
  inventory_generated_at timestamptz,
  pack_status text,
  sources_ready boolean,
  activation_recorded boolean,
  first_reviewer_count integer,
  viewer_is_first_reviewer boolean,
  viewer_can_activate boolean,
  validated_on date,
  activated_on date
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  ) then
    raise exception 'Active Manager or Administrator authority required';
  end if;

  select exists (
    select 1
    from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level = 'admin'
  ) into v_is_admin;

  return query
  select
    pack.id,
    pack.state_code,
    pack.inventory_generated_at,
    pack.status,
    snapshot.sources_ready,
    activation.id is not null,
    coalesce(array_length(snapshot.first_reviewer_ids, 1), 0),
    v_user_id = any(snapshot.first_reviewer_ids),
    (
      v_is_admin
      and snapshot.sources_ready
      and activation.id is null
      and coalesce(array_length(snapshot.first_reviewer_ids, 1), 0) > 0
      and not (v_user_id = any(snapshot.first_reviewer_ids))
    ),
    pack.validated_on,
    activation.activated_on
  from public.state_rule_pack_candidates pack
  cross join lateral public.state_rule_pack_source_snapshot(pack.id) snapshot
  left join lateral (
    select event.id, event.activated_on
    from public.state_rule_pack_activation_events event
    where event.pack_candidate_id = pack.id
      and event.source_snapshot_sha256 = snapshot.source_snapshot_sha256
    order by event.created_at desc
    limit 1
  ) activation on true
  where pack.state_code <> 'US'
  order by pack.state_code;
end;
$$;

revoke all on function public.state_rule_pack_activation_readiness() from public, anon;
grant execute on function public.state_rule_pack_activation_readiness() to authenticated;

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

comment on table public.state_rule_pack_activation_events is
  'Immutable stage-2 evidence for independent state rule-pack activation. Operational UI hides reviewer and activator emails.';
