-- Founder-only exception to the state-rule-pack second-verifier separation-of-duties rule.
--
-- Scope is deliberately narrow: the founder may activate a source snapshot that they
-- also first-reviewed, but this does NOT bypass exact-source verification, source
-- completeness, deterministic release validation, conflict controls, or fixtures.

create table if not exists public.founder_state_rule_activation_authority (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email_snapshot text not null unique,
  authority_scope text not null default 'SECOND_VERIFIER_BYPASS_ONLY'
    check (authority_scope = 'SECOND_VERIFIER_BYPASS_ONLY'),
  granted_at timestamptz not null default now(),
  check (email_snapshot = lower(email_snapshot))
);

alter table public.founder_state_rule_activation_authority enable row level security;
revoke all on table public.founder_state_rule_activation_authority from anon, authenticated;
grant select, insert, update, delete on table public.founder_state_rule_activation_authority to service_role;

insert into public.founder_state_rule_activation_authority (user_id, email_snapshot)
select u.id, lower(u.email)
from auth.users u
where lower(u.email) = 'rjwatkins@certivoiq.com'
on conflict (user_id) do update
set email_snapshot = excluded.email_snapshot,
    authority_scope = 'SECOND_VERIFIER_BYPASS_ONLY';

-- The old CHECK could not express a single-account exception. Replace it with a
-- database trigger so the separation rule remains enforced below the application.
alter table public.state_rule_pack_activation_events
  drop constraint if exists state_rule_pack_activation_events_distinct_activator;

create or replace function public.enforce_state_rule_pack_activation_actor()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_is_founder boolean := false;
begin
  select exists (
    select 1
    from public.founder_state_rule_activation_authority authority
    where authority.user_id = new.activator_id
      and authority.email_snapshot = 'rjwatkins@certivoiq.com'
      and authority.authority_scope = 'SECOND_VERIFIER_BYPASS_ONLY'
  ) into v_is_founder;

  if new.activator_id = any(new.first_reviewer_ids) and not v_is_founder then
    raise exception 'A different Administrator must activate this state pack';
  end if;

  if v_is_founder and new.activator_id = any(new.first_reviewer_ids) then
    new.evidence := coalesce(new.evidence, '{}'::jsonb) || jsonb_build_object(
      'founder_single_operator_override', true,
      'founder_override_scope', 'second_verifier_only',
      'founder_override_account', 'rjwatkins@certivoiq.com'
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_state_rule_pack_activation_actor() from public;

drop trigger if exists enforce_state_rule_pack_activation_actor
  on public.state_rule_pack_activation_events;
create trigger enforce_state_rule_pack_activation_actor
before insert on public.state_rule_pack_activation_events
for each row execute function public.enforce_state_rule_pack_activation_actor();

create or replace function public.activate_state_rule_pack(
  p_pack_candidate_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_pack public.state_rule_pack_candidates%rowtype;
  v_snapshot record;
  v_notes text := trim(coalesce(p_notes, ''));
  v_event_id uuid;
  v_result jsonb;
  v_is_founder boolean := false;
  v_is_first_reviewer boolean := false;
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

  select exists (
    select 1
    from public.founder_state_rule_activation_authority authority
    where authority.user_id = v_user_id
      and authority.email_snapshot = 'rjwatkins@certivoiq.com'
      and authority.authority_scope = 'SECOND_VERIFIER_BYPASS_ONLY'
  ) into v_is_founder;

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

  v_is_first_reviewer := v_user_id = any(v_snapshot.first_reviewer_ids);

  if v_is_first_reviewer and not v_is_founder then
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
      'control', case
        when v_is_founder and v_is_first_reviewer then 'founder_single_operator_activation'
        else 'independent_second_validation'
      end,
      'state_code', v_pack.state_code,
      'inventory_generated_at', v_pack.inventory_generated_at,
      'verified_source_count', v_snapshot.verified_source_count,
      'first_reviewer_count', array_length(v_snapshot.first_reviewer_ids, 1),
      'founder_override', v_is_founder and v_is_first_reviewer,
      'founder_override_scope', case
        when v_is_founder and v_is_first_reviewer then 'second_verifier_only'
        else null
      end
    )
  )
  returning id into v_event_id;

  v_result := public.refresh_state_rule_pack_activation(
    v_pack.state_code,
    v_pack.inventory_generated_at
  );

  return v_result || jsonb_build_object(
    'activation_event_id', v_event_id,
    'activated_on', current_date,
    'founder_override', v_is_founder and v_is_first_reviewer
  );
exception
  when unique_violation then
    raise exception 'This exact state-pack source snapshot is already activated';
end;
$function$;

create or replace function public.state_rule_pack_activation_readiness()
returns table(
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
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_founder boolean := false;
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

  select exists (
    select 1
    from public.founder_state_rule_activation_authority authority
    where authority.user_id = v_user_id
      and authority.email_snapshot = 'rjwatkins@certivoiq.com'
      and authority.authority_scope = 'SECOND_VERIFIER_BYPASS_ONLY'
  ) into v_is_founder;

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
      and (
        v_is_founder
        or not (v_user_id = any(snapshot.first_reviewer_ids))
      )
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
$function$;
