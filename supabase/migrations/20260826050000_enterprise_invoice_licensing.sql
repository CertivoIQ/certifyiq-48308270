-- CertivoIQ enterprise invoice-first licensing.
-- The license belongs to an organization, never to an individual user.

create table if not exists public.enterprise_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  crm_account_id uuid,
  product_code text not null default 'certivoiq_enterprise',
  status text not null default 'pending' check (status in ('pending','active','past_due','suspended','expired','cancelled')),
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_code)
);

create unique index if not exists enterprise_licenses_stripe_invoice_uq
  on public.enterprise_licenses (stripe_invoice_id)
  where stripe_invoice_id is not null;

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

alter table public.enterprise_licenses enable row level security;
alter table public.enterprise_license_members enable row level security;
alter table public.enterprise_invoice_events enable row level security;

-- Service-role webhook code owns writes. Authenticated users may only read a
-- license when they are a member of that license.
create policy "license members can read license"
  on public.enterprise_licenses for select to authenticated
  using (
    exists (
      select 1 from public.enterprise_license_members m
      where m.license_id = enterprise_licenses.id
        and m.user_id = auth.uid()
    )
  );

create policy "license members can read membership"
  on public.enterprise_license_members for select to authenticated
  using (user_id = auth.uid());

comment on table public.enterprise_licenses is
  'Organization-level CertivoIQ annual licenses provisioned from enterprise invoice events.';
comment on table public.enterprise_invoice_events is
  'Idempotent audit ledger for invoice-first license automation and exception routing.';
