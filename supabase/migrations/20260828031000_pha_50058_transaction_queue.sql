create table if not exists public.pha_50058_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  family_reference text not null,
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  transaction_type text not null check (transaction_type in ('admission','annual_reexamination','interim_reexamination','portability','other')),
  effective_date date not null,
  program_applicability_validated boolean not null default false,
  controlled_source_release_approved boolean not null default false,
  current_rule_version_validated boolean not null default false,
  source_status_conflict boolean not null default false,
  full_hotma_policy_set_validated boolean not null default false,
  reporting_path_validated boolean not null default false,
  software_compatibility_validated boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pha_50058_transactions_user_date_idx
  on public.pha_50058_transactions(user_id, effective_date);
create index if not exists pha_50058_transactions_user_program_idx
  on public.pha_50058_transactions(user_id, program_code);

alter table public.pha_50058_transactions enable row level security;

grant select, insert, update, delete on public.pha_50058_transactions to authenticated;
grant all on public.pha_50058_transactions to service_role;

drop policy if exists "Users manage own PHA 50058 transactions" on public.pha_50058_transactions;
create policy "Users manage own PHA 50058 transactions"
  on public.pha_50058_transactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and created_by = auth.uid());

drop policy if exists "Staff view PHA 50058 transactions" on public.pha_50058_transactions;
create policy "Staff view PHA 50058 transactions"
  on public.pha_50058_transactions for select to authenticated
  using (public.has_role(auth.uid(), 'staff'));
