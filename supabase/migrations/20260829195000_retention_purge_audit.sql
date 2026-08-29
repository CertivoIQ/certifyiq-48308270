create table if not exists public.retention_purge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('completed', 'failed')),
  object_count integer not null default 0 check (object_count >= 0),
  error_detail text,
  executed_at timestamptz not null default now()
);

alter table public.retention_purge_events enable row level security;

revoke all on table public.retention_purge_events from anon, authenticated;
grant all on table public.retention_purge_events to service_role;

create index if not exists idx_retention_purge_events_user_executed
  on public.retention_purge_events (user_id, executed_at desc);

create index if not exists idx_account_access_due_file_purge
  on public.account_access (files_purge_at)
  where files_purge_at is not null and files_purged_at is null;
