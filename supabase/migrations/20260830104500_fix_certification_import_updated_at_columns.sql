-- Existing update triggers require updated_at; add the missing columns so intake finalization and review queue state transitions can execute.
alter table public.certification_import_jobs
  add column if not exists updated_at timestamptz not null default now();

alter table public.certification_import_items
  add column if not exists updated_at timestamptz not null default now();

comment on column public.certification_import_jobs.updated_at is 'Last controlled intake job state transition.';
comment on column public.certification_import_items.updated_at is 'Last certification item or client-controlled review queue state transition.';