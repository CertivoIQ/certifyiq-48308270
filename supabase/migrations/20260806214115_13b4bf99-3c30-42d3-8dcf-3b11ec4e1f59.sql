create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy "Staff can view all subscriptions"
  on public.subscriptions for select to authenticated
  using (public.has_role(auth.uid(), 'staff'));

create table public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text,
  price_id text,
  status text not null default 'trialing',
  unit_limit integer,
  property_limit integer,
  ai_doc_allowance integer,
  academy_seats integer not null default 0,
  access_until timestamptz,
  files_purge_at timestamptz,
  welcome_sent_at timestamptz,
  launchpad_started_at timestamptz,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.account_access to authenticated;
grant all on public.account_access to service_role;
alter table public.account_access enable row level security;

create policy "Users can view own access"
  on public.account_access for select to authenticated
  using (auth.uid() = user_id);

create policy "Staff can view all access"
  on public.account_access for select to authenticated
  using (public.has_role(auth.uid(), 'staff'));

create trigger t_subscriptions_updated before update on public.subscriptions
  for each row execute function public.touch_updated_at();
create trigger t_account_access_updated before update on public.account_access
  for each row execute function public.touch_updated_at();

create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$$;

revoke all on function public.has_active_subscription(uuid, text) from public, anon;
grant execute on function public.has_active_subscription(uuid, text) to authenticated, service_role;