-- Signed final-review gate for state rule-pack activation.
-- Historical source-approval events remain immutable evidence, but they are no longer
-- sufficient to authorize compliance execution. A validated rule release plus a
-- separate signed final-review confirmation are required before ACTIVE.

create table if not exists public.state_rule_pack_final_review_confirmations (
  id uuid primary key default gen_random_uuid(),
  pack_candidate_id uuid not null references public.state_rule_pack_candidates(id) on delete restrict,
  rule_pack_release_id uuid not null references public.state_rule_pack_releases(id) on delete restrict,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  responsible_party_id uuid not null references auth.users(id) on delete restrict,
  responsible_party_signature text not null check (char_length(btrim(responsible_party_signature)) between 2 and 250),
  responsible_party_position text not null check (char_length(btrim(responsible_party_position)) between 2 and 250),
  confirmation_statement text not null check (char_length(btrim(confirmation_statement)) between 20 and 4000),
  confirmed_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now(),
  constraint state_rule_pack_final_review_unique_snapshot_release
    unique (pack_candidate_id, rule_pack_release_id, source_snapshot_sha256)
);

create index if not exists state_rule_pack_final_review_pack_created_idx
  on public.state_rule_pack_final_review_confirmations(pack_candidate_id, created_at desc);

alter table public.state_rule_pack_final_review_confirmations enable row level security;

revoke all on table public.state_rule_pack_final_review_confirmations from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.state_rule_pack_final_review_confirmations from authenticated;
grant select on table public.state_rule_pack_final_review_confirmations to authenticated;
grant all on table public.state_rule_pack_final_review_confirmations to service_role;

drop policy if exists "Managers can view state pack final review confirmations"
  on public.state_rule_pack_final_review_confirmations;
create policy "Managers can view state pack final review confirmations"
on public.state_rule_pack_final_review_confirmations
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

create or replace function public.block_state_rule_pack_final_review_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'State rule pack final-review confirmations are immutable';
end;
$$;

revoke all on function public.block_state_rule_pack_final_review_mutation() from public, anon, authenticated;
grant execute on function public.block_state_rule_pack_final_review_mutation() to service_role;

drop trigger if exists block_state_rule_pack_final_review_mutation
  on public.state_rule_pack_final_review_confirmations;
create trigger block_state_rule_pack_final_review_mutation
before update or delete on public.state_rule_pack_final_review_confirmations
for each row execute function public.block_state_rule_pack_final_review_mutation();

alter table public.state_rule_pack_candidates
  drop constraint if exists state_rule_pack_candidates_status_check;
alter table public.state_rule_pack_candidates
  add constraint state_rule_pack_candidates_status_check
  check (
    status in (
      'queued_for_agent_verification',
      'agent_verification_in_progress',
      'awaiting_second_verification',
      'pending_final_review',
      'blocked',
      'verified',
      'tested',
      'active',
      'rejected'
    )
  );

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
  v_final_review public.state_rule_pack_final_review_confirmations%rowtype;
  v_status text;
  v_active boolean := false;
  v_release_ready boolean := false;
  v_final_review_confirmed boolean := false;
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

  select * into v_snapshot
  from public.state_rule_pack_source_snapshot(v_pack.id);

  select event.*
  into v_source_approval
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id = v_pack.id
    and event.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
  order by event.created_at desc
  limit 1;

  select release.*
  into v_release
  from public.state_rule_pack_releases release
  where release.state_code = v_pack.state_code
    and release.status = 'validated'
    and release.validated_rule_count > 0
    and release.approved_by is not null
    and release.approved_at is not null
    and release.validation_report_id is not null
  order by release.effective_from desc nulls last, release.approved_at desc
  limit 1;

  v_release_ready := v_release.id is not null;

  if v_release_ready then
    select confirmation.*
    into v_final_review
    from public.state_rule_pack_final_review_confirmations confirmation
    where confirmation.pack_candidate_id = v_pack.id
      and confirmation.rule_pack_release_id = v_release.id
      and confirmation.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
    order by confirmation.created_at desc
    limit 1;
  end if;

  v_final_review_confirmed := v_final_review.id is not null;
  v_active := coalesce(v_snapshot.sources_ready, false)
    and v_source_approval.id is not null
    and v_release_ready
    and v_final_review_confirmed;

  v_status := case
    when v_active then 'active'
    when coalesce(v_snapshot.sources_ready, false)
      and v_source_approval.id is not null
      and v_release_ready then 'pending_final_review'
    when coalesce(v_snapshot.sources_ready, false)
      and v_source_approval.id is not null then 'verified'
    when coalesce(v_snapshot.sources_ready, false) then 'awaiting_second_verification'
    when coalesce(v_snapshot.has_blocker, false) then 'blocked'
    when coalesce(v_snapshot.has_progress, false) then 'agent_verification_in_progress'
    else 'queued_for_agent_verification'
  end;

  update public.state_rule_pack_candidates pack
  set status = v_status,
      compliance_activation_allowed = v_active,
      agent_verification_required = not coalesce(v_snapshot.sources_ready, false),
      validated_on = case when v_active then v_final_review.confirmed_at::date else null end,
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
    'release_ready', v_release_ready,
    'rule_pack_release_id', v_release.id,
    'final_review_confirmed', v_final_review_confirmed,
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

create or replace function public.confirm_state_rule_pack_final_review(
  p_pack_candidate_id uuid,
  p_signature text,
  p_position text,
  p_confirmation_statement text
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
  v_source_approval public.state_rule_pack_activation_events%rowtype;
  v_release public.state_rule_pack_releases%rowtype;
  v_signature text := btrim(coalesce(p_signature, ''));
  v_position text := btrim(coalesce(p_position, ''));
  v_statement text := btrim(coalesce(p_confirmation_statement, ''));
  v_confirmation_id uuid;
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

  if char_length(v_signature) < 2 or char_length(v_signature) > 250 then
    raise exception 'Responsible-party signature is required';
  end if;
  if char_length(v_position) < 2 or char_length(v_position) > 250 then
    raise exception 'Responsible-party position is required';
  end if;
  if char_length(v_statement) < 20 or char_length(v_statement) > 4000 then
    raise exception 'Final-review confirmation statement must contain 20 to 4000 characters';
  end if;

  select * into v_pack
  from public.state_rule_pack_candidates pack
  where pack.id = p_pack_candidate_id
  for update;

  if not found then
    raise exception 'State rule pack candidate not found';
  end if;
  if v_pack.state_code = 'US' then
    raise exception 'The shared federal baseline is inherited by state rule packs';
  end if;

  select * into v_snapshot
  from public.state_rule_pack_source_snapshot(v_pack.id);

  if not coalesce(v_snapshot.sources_ready, false) then
    raise exception 'Every required state and shared federal source must be verified';
  end if;

  select event.* into v_source_approval
  from public.state_rule_pack_activation_events event
  where event.pack_candidate_id = v_pack.id
    and event.source_snapshot_sha256 = v_snapshot.source_snapshot_sha256
  order by event.created_at desc
  limit 1;

  if v_source_approval.id is null then
    raise exception 'Independent source-pack approval is required before final review';
  end if;

  select release.* into v_release
  from public.state_rule_pack_releases release
  where release.state_code = v_pack.state_code
    and release.status = 'validated'
    and release.validated_rule_count > 0
    and release.approved_by is not null
    and release.approved_at is not null
    and release.validation_report_id is not null
  order by release.effective_from desc nulls last, release.approved_at desc
  limit 1;

  if v_release.id is null then
    raise exception 'A validated rule release with tested rules and validation report is required before final review';
  end if;

  insert into public.state_rule_pack_final_review_confirmations (
    pack_candidate_id,
    rule_pack_release_id,
    state_code,
    source_snapshot_sha256,
    responsible_party_id,
    responsible_party_signature,
    responsible_party_position,
    confirmation_statement,
    evidence
  ) values (
    v_pack.id,
    v_release.id,
    v_pack.state_code,
    v_snapshot.source_snapshot_sha256,
    v_user_id,
    v_signature,
    v_position,
    v_statement,
    jsonb_build_object(
      'control', 'signed_final_review',
      'source_approval_event_id', v_source_approval.id,
      'rule_pack_release_id', v_release.id,
      'validated_rule_count', v_release.validated_rule_count,
      'validation_report_id', v_release.validation_report_id
    )
  ) returning id into v_confirmation_id;

  v_result := public.refresh_state_rule_pack_activation(v_pack.state_code, v_pack.inventory_generated_at);

  return v_result || jsonb_build_object(
    'final_review_confirmation_id', v_confirmation_id,
    'responsible_party_signature', v_signature,
    'responsible_party_position', v_position
  );
exception
  when unique_violation then
    raise exception 'This exact rule-pack release and source snapshot already has a final-review confirmation';
end;
$$;

revoke all on function public.confirm_state_rule_pack_final_review(uuid,text,text,text) from public, anon;
grant execute on function public.confirm_state_rule_pack_final_review(uuid,text,text,text) to authenticated;

-- The readiness return shape changes, so drop the previous function before recreating it.
drop function if exists public.state_rule_pack_activation_readiness();

create function public.state_rule_pack_activation_readiness()
returns table (
  pack_candidate_id uuid,
  state_code text,
  inventory_generated_at timestamptz,
  pack_status text,
  sources_ready boolean,
  source_approval_recorded boolean,
  release_ready boolean,
  rule_pack_release_id uuid,
  final_review_confirmed boolean,
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
    source_approval.id is not null,
    release.id is not null,
    release.id,
    final_review.id is not null,
    coalesce(array_length(snapshot.first_reviewer_ids, 1), 0),
    v_user_id = any(snapshot.first_reviewer_ids),
    (
      v_is_admin
      and snapshot.sources_ready
      and source_approval.id is not null
      and release.id is not null
      and final_review.id is null
    ),
    pack.validated_on,
    final_review.confirmed_at::date
  from public.state_rule_pack_candidates pack
  cross join lateral public.state_rule_pack_source_snapshot(pack.id) snapshot
  left join lateral (
    select event.id
    from public.state_rule_pack_activation_events event
    where event.pack_candidate_id = pack.id
      and event.source_snapshot_sha256 = snapshot.source_snapshot_sha256
    order by event.created_at desc
    limit 1
  ) source_approval on true
  left join lateral (
    select rule_release.*
    from public.state_rule_pack_releases rule_release
    where rule_release.state_code = pack.state_code
      and rule_release.status = 'validated'
      and rule_release.validated_rule_count > 0
      and rule_release.approved_by is not null
      and rule_release.approved_at is not null
      and rule_release.validation_report_id is not null
    order by rule_release.effective_from desc nulls last, rule_release.approved_at desc
    limit 1
  ) release on true
  left join lateral (
    select confirmation.confirmed_at
    from public.state_rule_pack_final_review_confirmations confirmation
    where confirmation.pack_candidate_id = pack.id
      and confirmation.rule_pack_release_id = release.id
      and confirmation.source_snapshot_sha256 = snapshot.source_snapshot_sha256
    order by confirmation.created_at desc
    limit 1
  ) final_review on true
  where pack.state_code <> 'US'
  order by pack.state_code;
end;
$$;

revoke all on function public.state_rule_pack_activation_readiness() from public, anon;
grant execute on function public.state_rule_pack_activation_readiness() to authenticated;

-- Reconcile every candidate against the stricter release + signed-final-review gate.
do $$
declare
  v_pack record;
begin
  for v_pack in
    select state_code, inventory_generated_at
    from public.state_rule_pack_candidates
  loop
    perform public.refresh_state_rule_pack_activation(v_pack.state_code, v_pack.inventory_generated_at);
  end loop;
end
$$;
