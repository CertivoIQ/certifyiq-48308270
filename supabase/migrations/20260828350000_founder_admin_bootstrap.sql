-- One-time, fail-closed founder activation for the designated CertivoIQ owner.
-- This is separate from customer trial onboarding and can only be claimed by a
-- verified, exact-match organization email while no other active CRM admin exists.

create or replace function public.claim_certivoiq_founder_admin()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
  v_existing_admin uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('claimed', false, 'reason', 'authentication_required');
  end if;

  perform pg_advisory_xact_lock(hashtext('certivoiq_founder_admin_bootstrap'));

  select * into v_user
  from auth.users
  where id = auth.uid();

  if not found or v_user.email_confirmed_at is null then
    return jsonb_build_object('claimed', false, 'reason', 'verified_email_required');
  end if;

  if lower(v_user.email) <> 'rjwatkins@certivoiq.com' then
    return jsonb_build_object('claimed', false, 'reason', 'designated_email_required');
  end if;

  select user_id into v_existing_admin
  from public.crm_staff_access
  where access_level = 'admin' and status = 'active'
  order by granted_at
  limit 1;

  if v_existing_admin is not null and v_existing_admin <> v_user.id then
    return jsonb_build_object('claimed', false, 'reason', 'founder_already_activated');
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    v_user.id,
    lower(v_user.email),
    coalesce(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', 'CertivoIQ Founder')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.user_roles (user_id, role)
  values (v_user.id, 'staff')
  on conflict (user_id, role) do nothing;

  insert into public.crm_staff_access (
    user_id, access_level, status, granted_by, granted_at,
    disabled_by, disabled_at, updated_at
  )
  values (v_user.id, 'admin', 'active', v_user.id, now(), null, null, now())
  on conflict (user_id) do update
  set access_level = 'admin',
      status = 'active',
      granted_by = v_user.id,
      granted_at = now(),
      disabled_by = null,
      disabled_at = null,
      updated_at = now();

  insert into public.account_access (
    user_id, plan_id, price_id, status, unit_limit, property_limit,
    ai_doc_allowance, academy_seats, access_until, files_purge_at,
    environment, trial_started_at, subscribed_at, updated_at
  )
  values (
    v_user.id, 'founder_internal', null, 'active', 1000000, 1000000,
    1000000, 1000, null, null, 'live', null, now(), now()
  )
  on conflict (user_id) do update
  set plan_id = 'founder_internal',
      price_id = null,
      status = 'active',
      unit_limit = 1000000,
      property_limit = 1000000,
      ai_doc_allowance = 1000000,
      academy_seats = 1000,
      access_until = null,
      files_purge_at = null,
      environment = 'live',
      trial_started_at = null,
      subscribed_at = coalesce(public.account_access.subscribed_at, now()),
      updated_at = now();

  if v_existing_admin is null then
    insert into public.crm_staff_access_events (
      actor_id, target_user_id, event_type, access_level, detail
    )
    values (
      v_user.id, v_user.id, 'activated', 'admin',
      jsonb_build_object('source', 'one_time_founder_bootstrap')
    );
  end if;

  return jsonb_build_object(
    'claimed', true,
    'already_active', v_existing_admin = v_user.id,
    'access_level', 'admin'
  );
end;
$$;

revoke all on function public.claim_certivoiq_founder_admin() from public;
grant execute on function public.claim_certivoiq_founder_admin() to authenticated, service_role;

comment on function public.claim_certivoiq_founder_admin() is
  'One-time verified-email founder bootstrap. Fails closed after the first active CRM administrator.';
