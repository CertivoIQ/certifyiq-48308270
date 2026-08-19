create table if not exists public.hfa_transmission_tokens (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.hfa_submissions(id) on delete cascade,
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  manifest_sha256 text not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint hfa_transmission_tokens_expiry_check
    check (expires_at > issued_at)
);

create index if not exists hfa_transmission_tokens_submission_idx
  on public.hfa_transmission_tokens(submission_id, created_at desc);

create index if not exists hfa_transmission_tokens_active_idx
  on public.hfa_transmission_tokens(
    submission_id,
    agency_id,
    manifest_sha256,
    expires_at
  )
  where consumed_at is null and revoked_at is null;

grant select on public.hfa_transmission_tokens to authenticated;
grant all on public.hfa_transmission_tokens to service_role;

alter table public.hfa_transmission_tokens enable row level security;

drop policy if exists "Owners read their transmission tokens"
  on public.hfa_transmission_tokens;

create policy "Owners read their transmission tokens"
on public.hfa_transmission_tokens
for select
to authenticated
using (
  exists (
    select 1
    from public.hfa_submissions s
    where s.id = hfa_transmission_tokens.submission_id
      and s.owner_user_id = auth.uid()
  )
);
