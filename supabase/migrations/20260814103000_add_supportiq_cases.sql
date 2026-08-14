create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  priority text not null check (
    priority in (
      'P0_SECURITY',
      'P1_PRODUCTION_UI',
      'P1_BILLING',
      'P2_COMPLIANCE_REVIEW',
      'P2_SUPPORT_REVIEW',
      'P3_ROUTINE'
    )
  ),
  disposition text not null check (
    disposition in (
      'ESCALATE_IMMEDIATE',
      'ESCALATE_HUMAN',
      'QUEUE_REVIEW',
      'AUTO_RESOLVE'
    )
  ),
  subject text,
  message text not null,
  agent_confidence numeric(5,4),
  human_required boolean not null default true,
  status text not null default 'open' check (
    status in ('open', 'triaged', 'waiting_on_customer', 'waiting_on_human', 'resolved', 'closed')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_cases_user_created_idx
  on public.support_cases (user_id, created_at desc);

create index if not exists support_cases_priority_status_idx
  on public.support_cases (priority, status, created_at asc);

alter table public.support_cases enable row level security;

grant select, insert on public.support_cases to authenticated;
grant all on public.support_cases to service_role;

create policy "users create own support cases"
  on public.support_cases
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users read own support cases"
  on public.support_cases
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.support_cases is
  'SupportIQ cases created by deterministic support triage. Sensitive actions remain human-gated.';

comment on column public.support_cases.human_required is
  'True when the support agent must not independently finalize the request.';
