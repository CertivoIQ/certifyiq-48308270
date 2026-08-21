-- Persist self-directed customer onboarding progress across sessions and devices.

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
