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

create table if not exists public.customer_onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step integer not null default 1
    check (current_step between 1 and 10),
  completed_steps integer[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_onboarding_progress is
  'Customer-controlled onboarding checklist progress. Completion is operational setup status, not a training certificate or compliance approval.';

alter table public.customer_onboarding_progress enable row level security;

grant select, insert, update on public.customer_onboarding_progress to authenticated;
grant all on public.customer_onboarding_progress to service_role;

drop policy if exists "Users manage own onboarding progress"
  on public.customer_onboarding_progress;
create policy "Users manage own onboarding progress"
  on public.customer_onboarding_progress
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Staff view onboarding progress"
  on public.customer_onboarding_progress;
create policy "Staff view onboarding progress"
  on public.customer_onboarding_progress
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'staff'));

drop trigger if exists customer_onboarding_progress_touch_updated_at
  on public.customer_onboarding_progress;
create trigger customer_onboarding_progress_touch_updated_at
before update on public.customer_onboarding_progress
for each row
execute function public.touch_updated_at();