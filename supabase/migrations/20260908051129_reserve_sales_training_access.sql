-- A one-time, verified-email reservation for the requested sales training account.
-- Kept private: clients cannot add reservations or self-assign an internal plan.
create table private.training_access_reservations (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now(),
  reason text not null,
  claimed_user_id uuid,
  claimed_at timestamptz,
  revoked_at timestamptz,
  check ((claimed_user_id is null) = (claimed_at is null))
);
alter table private.training_access_reservations enable row level security;
revoke all on private.training_access_reservations from public, anon, authenticated;
insert into private.training_access_reservations (email, reason)
values ('sales@certivoiq.com', 'Founder-authorized training subscription access across workspace roles');

create function private.claim_verified_training_reservation()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare reservation private.training_access_reservations%rowtype;
begin
  -- Only auth.users verification can activate a reservation; profile metadata is ignored.
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  select * into reservation from private.training_access_reservations
    where email = lower(trim(new.email)) and revoked_at is null and claimed_at is null
    for update;
  if not found then return new; end if;
  update private.training_access_reservations
    set claimed_user_id = new.id, claimed_at = now()
    where email = reservation.email;
  insert into public.account_access (
    user_id, plan_id, price_id, status, unit_limit, property_limit,
    ai_doc_allowance, academy_seats, access_until, files_purge_at,
    environment, trial_started_at, subscribed_at, updated_at
  ) values (
    new.id, 'founder_internal', null, 'active', 1000000, 1000000,
    1000000, 1000, null, null, 'live', null, now(), now()
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id, price_id = null, status = 'active',
    unit_limit = excluded.unit_limit, property_limit = excluded.property_limit,
    ai_doc_allowance = excluded.ai_doc_allowance, academy_seats = excluded.academy_seats,
    access_until = null, files_purge_at = null, trial_started_at = null,
    updated_at = now();
  insert into public.platform_dashboard_access (user_id, dashboard_key, granted_by)
    select new.id, dashboard_key, 'founder_authorized_sales_training'
    from (values ('multifamily'), ('pha'), ('executive_demo')) as modes(dashboard_key)
    on conflict (user_id, dashboard_key) do nothing;
  return new;
end;
$function$;
revoke all on function private.claim_verified_training_reservation() from public, anon, authenticated;

-- Run after normal new-user initialization. Does not grant administrator permissions.
create trigger zzzz_claim_verified_training_reservation
after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.claim_verified_training_reservation();
