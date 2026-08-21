-- Verified first-sale monitoring.
-- A Closed Won stage is not a sale signal by itself. The account must be
-- non-demo and have either an executed contract or payment independently verified.

alter table public.crm_accounts
  add column if not exists is_demo boolean not null default false,
  add column if not exists contract_verified_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists closed_won_at timestamptz;

comment on column public.crm_accounts.is_demo is
  'True for demo, seed, test, training, and synthetic CRM accounts. Demo accounts never trigger first-sale workflows.';
comment on column public.crm_accounts.contract_verified_at is
  'When an executed customer contract was independently verified.';
comment on column public.crm_accounts.payment_verified_at is
  'When an initial customer payment was independently verified.';
comment on column public.crm_accounts.closed_won_at is
  'When the account first satisfied all verified Closed Won requirements.';

-- Classify the known synthetic launch dataset so the historical Wallick
-- Closed Won row cannot be mistaken for CertivoIQ's first real customer.
update public.crm_accounts
set is_demo = true,
    contract_verified_at = null,
    payment_verified_at = null,
    closed_won_at = null
where created_by is null
  and name in (
    'Greystar Real Estate Partners',
    'The Michaels Organization',
    'WinnCompanies',
    'The NRP Group',
    'Dominium',
    'Pennrose',
    'LDG Development',
    'Fairstead',
    'Wallick Communities',
    'McCormack Baron Salazar',
    'National Church Residences',
    'Vitus Group'
  );

create table if not exists public.crm_post_sale_checklists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.crm_accounts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'completed', 'cancelled')),
  trigger_reason text not null
    check (trigger_reason in ('contract_verified', 'payment_verified', 'contract_and_payment_verified')),
  detected_at timestamptz not null default now(),
  surfaced_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.crm_post_sale_checklists is
  'One internal post-sale checklist per verified real customer account.';

alter table public.crm_post_sale_checklists enable row level security;

drop policy if exists "Staff can manage post-sale checklists" on public.crm_post_sale_checklists;
create policy "Staff can manage post-sale checklists"
  on public.crm_post_sale_checklists
  for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

grant select, insert, update on public.crm_post_sale_checklists to authenticated;

create or replace function public.crm_verified_sale_trigger_reason(
  p_contract_verified_at timestamptz,
  p_payment_verified_at timestamptz
)
returns text
language sql
immutable
as $$
  select case
    when p_contract_verified_at is not null and p_payment_verified_at is not null
      then 'contract_and_payment_verified'
    when p_contract_verified_at is not null then 'contract_verified'
    when p_payment_verified_at is not null then 'payment_verified'
    else null
  end;
$$;

create or replace function public.crm_prepare_verified_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qualifies boolean;
begin
  qualifies := new.stage = 'won'
    and not new.is_demo
    and (new.contract_verified_at is not null or new.payment_verified_at is not null);

  if qualifies and new.closed_won_at is null then
    new.closed_won_at := now();
  elsif not qualifies then
    new.closed_won_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_prepare_verified_sale_trigger on public.crm_accounts;
create trigger crm_prepare_verified_sale_trigger
before insert or update of stage, is_demo, contract_verified_at, payment_verified_at
on public.crm_accounts
for each row
execute function public.crm_prepare_verified_sale();

create or replace function public.crm_sync_post_sale_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qualifies boolean;
  reason text;
begin
  qualifies := new.stage = 'won'
    and not new.is_demo
    and (new.contract_verified_at is not null or new.payment_verified_at is not null);
  reason := public.crm_verified_sale_trigger_reason(
    new.contract_verified_at,
    new.payment_verified_at
  );

  if qualifies then
    insert into public.crm_post_sale_checklists (
      account_id,
      status,
      trigger_reason,
      detected_at,
      cancelled_at,
      updated_at
    ) values (
      new.id,
      'pending',
      reason,
      coalesce(new.closed_won_at, now()),
      null,
      now()
    )
    on conflict (account_id) do update
      set status = case
        when public.crm_post_sale_checklists.status = 'completed' then 'completed'
        else 'pending'
      end,
      trigger_reason = excluded.trigger_reason,
      detected_at = case
        when public.crm_post_sale_checklists.status = 'completed'
          then public.crm_post_sale_checklists.detected_at
        else excluded.detected_at
      end,
      cancelled_at = null,
      updated_at = now();
  else
    update public.crm_post_sale_checklists
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
    where account_id = new.id
      and status <> 'completed';
  end if;

  return new;
end;
$$;

drop trigger if exists crm_sync_post_sale_checklist_trigger on public.crm_accounts;
create trigger crm_sync_post_sale_checklist_trigger
after insert or update of stage, is_demo, contract_verified_at, payment_verified_at
on public.crm_accounts
for each row
execute function public.crm_sync_post_sale_checklist();

drop trigger if exists crm_post_sale_checklists_touch_updated_at on public.crm_post_sale_checklists;
create trigger crm_post_sale_checklists_touch_updated_at
before update on public.crm_post_sale_checklists
for each row
execute function public.touch_updated_at();

-- Run existing Closed Won rows through the new rules after demo classification.
update public.crm_accounts
set stage = stage
where stage = 'won';
