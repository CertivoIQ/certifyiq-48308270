-- State rule packs use one authorized human approver. Automated source and
-- document gates remain mandatory and production activation stays fail closed.

create or replace function public.enforce_sole_state_rule_pack_approver()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_authorized boolean := false;
begin
  select exists (
    select 1
    from auth.users user_account
    join public.crm_staff_access access on access.user_id = user_account.id
    where user_account.id = new.activator_id
      and lower(trim(user_account.email)) = 'rjwatkins@certivoiq.com'
      and user_account.email_confirmed_at is not null
      and access.status = 'active'
      and access.access_level = 'admin'
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Sole Authorized State Rule Approver authority required';
  end if;

  new.evidence := (
    coalesce(new.evidence, '{}'::jsonb)
      - 'founder_single_operator_override'
      - 'founder_override_scope'
      - 'founder_override_account'
      - 'founder_override'
  ) || jsonb_build_object(
    'control', 'sole_authorized_state_rule_approver',
    'approval_model', 'single_human_approval_with_automated_validation',
    'authorized_approver_id', new.activator_id,
    'source_snapshot_sha256', new.source_snapshot_sha256,
    'automated_source_gates_required', true,
    'independent_verification_claimed', false
  );

  return new;
end;
$function$;

revoke all on function public.enforce_sole_state_rule_pack_approver() from public;

drop trigger if exists enforce_sole_state_rule_pack_approver
  on public.state_rule_pack_activation_events;
create trigger enforce_sole_state_rule_pack_approver
before insert on public.state_rule_pack_activation_events
for each row execute function public.enforce_sole_state_rule_pack_approver();

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
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_authorized_approver boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.crm_staff_access access
    where access.user_id = v_user_id
      and access.status = 'active'
      and access.access_level in ('manager', 'admin')
  ) then
    raise exception 'Active Manager or Administrator authority required';
  end if;

  select exists (
    select 1
    from auth.users user_account
    join public.crm_staff_access access on access.user_id = user_account.id
    where user_account.id = v_user_id
      and lower(trim(user_account.email)) = 'rjwatkins@certivoiq.com'
      and user_account.email_confirmed_at is not null
      and access.status = 'active'
      and access.access_level = 'admin'
  ) into v_is_authorized_approver;

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
      v_is_authorized_approver
      and snapshot.sources_ready
      and activation.id is null
      and coalesce(array_length(snapshot.first_reviewer_ids, 1), 0) > 0
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

revoke all on function public.state_rule_pack_activation_readiness() from public;
grant execute on function public.state_rule_pack_activation_readiness() to authenticated;

