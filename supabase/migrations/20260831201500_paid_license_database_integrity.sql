-- Launch-critical paid-license integrity controls.
-- Forward-only and idempotent because production may not contain the earlier
-- enterprise-license migrations. Paid onboarding remains fail-closed until
-- this migration is rehearsed, applied, and independently verified.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.certivoiq_state_codes_valid(candidate text[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select cardinality(candidate) > 0
    and candidate <@ array[
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
      'VA','WA','WV','WI','WY','DC'
    ]::text[]
    and cardinality(candidate) = (
      select count(distinct state_code)::integer
      from unnest(candidate) as state_code
    );
$$;

revoke all on function public.certivoiq_state_codes_valid(text[]) from public, anon, authenticated;
grant execute on function public.certivoiq_state_codes_valid(text[]) to service_role;

alter table public.crm_accounts
  add column if not exists license_pricing_class text not null default 'standard';

alter table public.crm_accounts
  drop constraint if exists crm_accounts_license_pricing_class_check;
alter table public.crm_accounts
  add constraint crm_accounts_license_pricing_class_check
  check (license_pricing_class in ('standard', 'pha')) not valid;
alter table public.crm_accounts
  validate constraint crm_accounts_license_pricing_class_check;

comment on column public.crm_accounts.license_pricing_class is
  'Prospective quote classification only: standard = $65,000 per selected state/year; pha = $150,000/year flat. Active entitlement truth is enterprise_licenses.';

create table if not exists public.enterprise_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  crm_account_id uuid,
  product_code text not null default 'certivoiq_enterprise',
  status text not null default 'pending',
  annual_price_cents bigint not null default 6500000,
  currency text not null default 'usd',
  starts_at timestamptz,
  expires_at timestamptz,
  renewal_at timestamptz,
  stripe_customer_id text,
  stripe_invoice_id text,
  payment_method text,
  payment_terms text,
  purchase_order_number text,
  all_features boolean not null default true,
  activated_at timestamptz,
  activated_by text not null default 'automation',
  exception_reason text,
  license_number text,
  license_kind text,
  licensed_state_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_code)
);

alter table public.enterprise_licenses
  add column if not exists license_number text,
  add column if not exists license_kind text,
  add column if not exists licensed_state_codes text[] not null default '{}';

alter table public.enterprise_licenses
  drop constraint if exists enterprise_licenses_status_check,
  drop constraint if exists enterprise_licenses_license_kind_check,
  drop constraint if exists enterprise_licenses_license_state_scope_check,
  drop constraint if exists enterprise_licenses_authoritative_price_check;

alter table public.enterprise_licenses
  add constraint enterprise_licenses_status_check
    check (status in ('pending','active','past_due','suspended','expired','cancelled')) not valid,
  add constraint enterprise_licenses_license_kind_check
    check (license_kind is null or license_kind in ('multifamily_enterprise','pha')) not valid,
  add constraint enterprise_licenses_license_state_scope_check check (
    (license_kind is null and status = 'pending' and exception_reason is not null
      and cardinality(licensed_state_codes) = 0)
    or (license_kind = 'pha'
      and cardinality(licensed_state_codes) = 1
      and public.certivoiq_state_codes_valid(licensed_state_codes))
    or (license_kind = 'multifamily_enterprise'
      and public.certivoiq_state_codes_valid(licensed_state_codes))
  ) not valid,
  add constraint enterprise_licenses_authoritative_price_check check (
    (license_kind is null and status = 'pending' and exception_reason is not null)
    or (license_kind = 'pha' and annual_price_cents = 15000000)
    or (license_kind = 'multifamily_enterprise'
      and annual_price_cents = 6500000 * cardinality(licensed_state_codes))
  ) not valid;

alter table public.enterprise_licenses validate constraint enterprise_licenses_status_check;
alter table public.enterprise_licenses validate constraint enterprise_licenses_license_kind_check;
alter table public.enterprise_licenses validate constraint enterprise_licenses_license_state_scope_check;
alter table public.enterprise_licenses validate constraint enterprise_licenses_authoritative_price_check;

create unique index if not exists enterprise_licenses_stripe_invoice_uq
  on public.enterprise_licenses (stripe_invoice_id)
  where stripe_invoice_id is not null;
create unique index if not exists enterprise_licenses_license_number_uq
  on public.enterprise_licenses (license_number)
  where license_number is not null;

create table if not exists public.enterprise_license_members (
  license_id uuid not null references public.enterprise_licenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (license_id, user_id)
);

create table if not exists public.enterprise_invoice_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_invoice_id text,
  organization_id uuid,
  event_type text not null,
  invoice_status text,
  amount_due_cents bigint,
  amount_paid_cents bigint,
  currency text,
  action text not null check (action in ('recorded','activated','renewed','past_due','exception','ignored')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists enterprise_invoice_events_org_idx
  on public.enterprise_invoice_events (organization_id, created_at desc);

alter table public.account_access
  add column if not exists license_kind text,
  add column if not exists licensed_state_codes text[] not null default '{}';

alter table public.account_access
  drop constraint if exists account_access_license_kind_check,
  drop constraint if exists account_access_license_state_scope_check,
  drop constraint if exists account_access_paid_price_scope_check;

alter table public.account_access
  add constraint account_access_license_kind_check
    check (license_kind is null or license_kind in ('multifamily_enterprise','pha')) not valid,
  add constraint account_access_license_state_scope_check check (
    (license_kind is null and cardinality(licensed_state_codes) = 0)
    or (license_kind = 'pha'
      and cardinality(licensed_state_codes) = 1
      and public.certivoiq_state_codes_valid(licensed_state_codes))
    or (license_kind = 'multifamily_enterprise'
      and public.certivoiq_state_codes_valid(licensed_state_codes))
  ) not valid,
  add constraint account_access_paid_price_scope_check check (
    (price_id is null and license_kind is null)
    or (price_id = 'pha_annual' and license_kind = 'pha')
    or (price_id = 'multifamily_enterprise_annual'
      and license_kind = 'multifamily_enterprise')
  ) not valid;

alter table public.account_access validate constraint account_access_license_kind_check;
alter table public.account_access validate constraint account_access_license_state_scope_check;
alter table public.account_access validate constraint account_access_paid_price_scope_check;

alter table public.enterprise_licenses enable row level security;
alter table public.enterprise_license_members enable row level security;
alter table public.enterprise_invoice_events enable row level security;

drop policy if exists "license members can read license" on public.enterprise_licenses;
create policy "license members can read license"
  on public.enterprise_licenses for select to authenticated
  using (
    exists (
      select 1 from public.enterprise_license_members member
      where member.license_id = enterprise_licenses.id
        and member.user_id = (select auth.uid())
    )
  );

drop policy if exists "license members can read membership" on public.enterprise_license_members;
create policy "license members can read membership"
  on public.enterprise_license_members for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.enterprise_licenses from public, anon, authenticated;
revoke all on public.enterprise_license_members from public, anon, authenticated;
revoke all on public.enterprise_invoice_events from public, anon, authenticated;
grant select on public.enterprise_licenses to authenticated;
grant select on public.enterprise_license_members to authenticated;
grant all on public.enterprise_licenses to service_role;
grant all on public.enterprise_license_members to service_role;
grant all on public.enterprise_invoice_events to service_role;

revoke insert, update, delete, truncate, references, trigger
  on public.account_access from anon, authenticated;
grant select on public.account_access to authenticated;

create sequence if not exists public.enterprise_license_number_seq
  as bigint start with 1 increment by 1 minvalue 1 no maxvalue cache 1;

create or replace function public.assign_enterprise_license_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  license_year text;
  sequence_value bigint;
begin
  if tg_op = 'UPDATE'
     and old.license_number is not null
     and new.license_number is distinct from old.license_number then
    raise exception 'enterprise license number is immutable';
  end if;
  if new.status = 'active' and new.license_number is null then
    license_year := to_char(coalesce(new.activated_at, now()), 'YYYY');
    sequence_value := nextval('public.enterprise_license_number_seq');
    new.license_number := 'CIQ-' || license_year || '-' || lpad(sequence_value::text, 6, '0');
  end if;
  return new;
end;
$$;

revoke all on function public.assign_enterprise_license_number() from public, anon, authenticated;
grant execute on function public.assign_enterprise_license_number() to service_role;

drop trigger if exists assign_enterprise_license_number on public.enterprise_licenses;
create trigger assign_enterprise_license_number
before insert or update of status, activated_at, license_number
on public.enterprise_licenses
for each row execute function public.assign_enterprise_license_number();

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
  (
    access.user_id is not null
    and access.license_kind is not distinct from license.license_kind
    and access.licensed_state_codes is not distinct from license.licensed_state_codes
    and access.price_id = case license.license_kind
      when 'pha' then 'pha_annual'
      when 'multifamily_enterprise' then 'multifamily_enterprise_annual'
    end
    and access.status = 'active'
  ) as entitlement_matches
from public.enterprise_licenses license
left join public.enterprise_license_members member on member.license_id = license.id
left join public.account_access access on access.user_id = member.user_id;

revoke all on public.paid_license_entitlement_reconciliation from public, anon, authenticated;
grant select on public.paid_license_entitlement_reconciliation to service_role;

comment on table public.enterprise_licenses is
  'Authoritative organization-level paid-license record. CRM is prospective; account_access is a derived per-user entitlement.';
comment on view public.paid_license_entitlement_reconciliation is
  'Service-role-only operational check for drift between organization licenses and derived member entitlements.';

