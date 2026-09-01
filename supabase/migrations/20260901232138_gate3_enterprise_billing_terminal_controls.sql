begin;

alter table public.enterprise_licenses
  add column if not exists last_billing_event_id text;

alter table public.enterprise_invoice_events
  add column if not exists processing_state text not null default 'completed',
  add column if not exists attempt_count integer not null default 1,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.enterprise_invoice_events
  drop constraint if exists enterprise_invoice_events_action_check,
  drop constraint if exists enterprise_invoice_events_processing_state_check,
  drop constraint if exists enterprise_invoice_events_attempt_count_check;

alter table public.enterprise_invoice_events
  add constraint enterprise_invoice_events_action_check check (
    action in (
      'recorded', 'activated', 'renewed', 'past_due', 'exception', 'ignored',
      'cancelled', 'credited', 'refunded', 'revoked'
    )
  ) not valid,
  add constraint enterprise_invoice_events_processing_state_check
    check (processing_state in ('processing', 'completed', 'failed')) not valid,
  add constraint enterprise_invoice_events_attempt_count_check
    check (attempt_count >= 1) not valid;

alter table public.enterprise_invoice_events
  validate constraint enterprise_invoice_events_action_check;
alter table public.enterprise_invoice_events
  validate constraint enterprise_invoice_events_processing_state_check;
alter table public.enterprise_invoice_events
  validate constraint enterprise_invoice_events_attempt_count_check;

create index if not exists enterprise_invoice_events_processing_idx
  on public.enterprise_invoice_events (processing_state, processing_started_at)
  where processing_state <> 'completed';

create or replace function public.claim_enterprise_billing_event(
  p_stripe_event_id text,
  p_stripe_invoice_id text,
  p_organization_id uuid,
  p_event_type text,
  p_invoice_status text,
  p_amount_due_cents bigint,
  p_amount_paid_cents bigint,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_state text;
  current_started_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if nullif(btrim(p_stripe_event_id), '') is null then
    raise exception 'stripe event id is required' using errcode = '22023';
  end if;

  insert into public.enterprise_invoice_events (
    stripe_event_id,
    stripe_invoice_id,
    organization_id,
    event_type,
    invoice_status,
    amount_due_cents,
    amount_paid_cents,
    currency,
    action,
    processing_state,
    attempt_count,
    processing_started_at,
    processed_at,
    last_error,
    updated_at
  ) values (
    p_stripe_event_id,
    p_stripe_invoice_id,
    p_organization_id,
    coalesce(nullif(p_event_type, ''), 'unknown'),
    p_invoice_status,
    p_amount_due_cents,
    p_amount_paid_cents,
    p_currency,
    'recorded',
    'processing',
    1,
    now(),
    null,
    null,
    now()
  )
  on conflict (stripe_event_id) do nothing;

  if found then
    return 'claimed';
  end if;

  select processing_state, processing_started_at
    into current_state, current_started_at
  from public.enterprise_invoice_events
  where stripe_event_id = p_stripe_event_id
  for update;

  if current_state = 'completed' then
    return 'duplicate';
  end if;

  if current_state = 'failed'
     or (current_state = 'processing' and current_started_at < now() - interval '5 minutes') then
    update public.enterprise_invoice_events
    set processing_state = 'processing',
        attempt_count = attempt_count + 1,
        processing_started_at = now(),
        processed_at = null,
        last_error = null,
        updated_at = now()
    where stripe_event_id = p_stripe_event_id;
    return 'claimed';
  end if;

  return 'in_progress';
end;
$$;

revoke all on function public.claim_enterprise_billing_event(
  text, text, uuid, text, text, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.claim_enterprise_billing_event(
  text, text, uuid, text, text, bigint, bigint, text
) to service_role;

create or replace view public.paid_license_entitlement_reconciliation
with (security_invoker = true)
as
select
  license.id as license_id,
  license.organization_id,
  license.crm_account_id,
  license.status as license_status,
  license.license_kind,
  license.licensed_state_codes,
  license.annual_price_cents,
  member.user_id,
  access.status as access_status,
  access.license_kind as access_license_kind,
  access.licensed_state_codes as access_state_codes,
  access.price_id as access_price_id,
  access.access_until,
  case
    when license.status = 'active' then (
      access.user_id is not null
      and access.license_kind is not distinct from license.license_kind
      and access.licensed_state_codes is not distinct from license.licensed_state_codes
      and access.price_id = case license.license_kind
        when 'pha' then 'certivoiq_pha_monthly'
        when 'multifamily_enterprise' then 'certivoiq_multifamily_state_monthly'
      end
      and access.status = 'active'
    )
    when license.status = 'past_due' then (
      access.user_id is not null
      and access.status in ('active', 'past_due')
      and access.license_kind is not distinct from license.license_kind
      and access.licensed_state_codes is not distinct from license.licensed_state_codes
    )
    when license.status in ('suspended', 'expired', 'cancelled') then (
      member.user_id is null
      or access.user_id is null
      or (
        access.status = 'canceled'
        and access.access_until is not null
        and access.access_until <= now()
      )
    )
    else false
  end as entitlement_matches,
  license.last_billing_event_id
from public.enterprise_licenses license
left join public.enterprise_license_members member on member.license_id = license.id
left join public.account_access access on access.user_id = member.user_id;

revoke all on public.paid_license_entitlement_reconciliation from public, anon, authenticated;
grant select on public.paid_license_entitlement_reconciliation to service_role;

comment on function public.claim_enterprise_billing_event(
  text, text, uuid, text, text, bigint, bigint, text
) is 'Atomically claims each Stripe enterprise billing event. Completed duplicates do not re-run and failed or stale claims can be recovered.';
comment on column public.enterprise_licenses.last_billing_event_id is
  'Stripe event whose authoritative entitlement mutation was last applied; prevents retry-driven installment duplication.';
comment on view public.paid_license_entitlement_reconciliation is
  'Service-role-only drift check covering active, grace-period, cancelled, expired, and financially reversed enterprise entitlements.';

commit;

