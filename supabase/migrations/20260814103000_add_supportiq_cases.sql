alter table public.support_cases
  add column if not exists triage_category text,
  add column if not exists triage_priority text,
  add column if not exists triage_disposition text,
  add column if not exists agent_confidence numeric(5,4),
  add column if not exists human_required boolean not null default true,
  add column if not exists supportiq_metadata jsonb not null default '{}'::jsonb;

create index if not exists support_cases_user_created_idx
  on public.support_cases (user_id, created_at desc);

create index if not exists support_cases_triage_priority_status_idx
  on public.support_cases (triage_priority, status, created_at asc);

alter table public.support_cases enable row level security;

grant select, insert on public.support_cases to authenticated;
grant all on public.support_cases to service_role;

drop policy if exists "users create own support cases" on public.support_cases;
create policy "users create own support cases"
  on public.support_cases
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users read own support cases" on public.support_cases;
create policy "users read own support cases"
  on public.support_cases
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.support_cases is
  'CRM support cases, including SupportIQ-triaged requests. Sensitive actions remain human-gated.';

comment on column public.support_cases.triage_priority is
  'Deterministic SupportIQ priority such as P0_SECURITY or P1_BILLING.';

comment on column public.support_cases.human_required is
  'True when SupportIQ must not independently finalize the request.';
