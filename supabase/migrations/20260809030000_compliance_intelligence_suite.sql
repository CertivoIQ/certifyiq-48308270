-- Compliance intelligence foundation. GitHub-only; no Lovable changes.
-- Uses the repository's established user-scoped authorization model.
create table if not exists public.certification_import_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_by uuid not null default auth.uid(),
 status text not null default 'queued' check(status in('queued','processing','completed','partial','failed')),
 source_name text not null, total_files int not null default 0, processed_files int not null default 0,
 duplicate_files int not null default 0, finding_count int not null default 0, error_count int not null default 0,
 created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.certification_import_items (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.certification_import_jobs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, storage_path text not null, original_file_name text not null, mime_type text not null,
 size_bytes bigint not null, sha256 text, status text not null default 'queued' check(status in('queued','processing','completed','duplicate','failed')),
 matched_certification_id uuid, extracted_data jsonb not null default '{}'::jsonb, historical_changes jsonb not null default '[]'::jsonb,
 findings jsonb not null default '[]'::jsonb, confidence numeric(5,4), error_message text, created_at timestamptz not null default now(), processed_at timestamptz
);
create index if not exists certification_import_items_user_idx on public.certification_import_items(user_id,created_at desc);
create unique index if not exists certification_import_items_hash_idx on public.certification_import_items(user_id,sha256) where sha256 is not null;
create table if not exists public.mock_audit_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, property_id uuid, created_by uuid not null default auth.uid(),
 scope text not null check(scope in('property','portfolio','organization')), jurisdiction text not null,
 framework text not null check(framework in('federal','state','custom')), status text not null default 'queued' check(status in('queued','running','completed','failed')),
 readiness_score numeric(5,2), critical_count int not null default 0, major_count int not null default 0, minor_count int not null default 0,
 findings jsonb not null default '[]'::jsonb, evidence_manifest jsonb not null default '[]'::jsonb, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.authority_submissions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, property_id uuid, certification_id uuid,
 authority_name text not null, authority_type text not null default 'housing_authority', approval_required boolean not null default true,
 approved_by uuid references auth.users(id), approved_at timestamptz, status text not null default 'draft' check(status in('draft','approved','submitted','accepted','rejected','failed')),
 delivery_method text check(delivery_method in('portal','email','api','manual')), submission_package jsonb not null default '{}'::jsonb,
 external_reference text, receipt_path text, response_notes text, submitted_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.portfolio_readiness_snapshots (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, portfolio_name text,
 readiness_score numeric(5,2) not null default 0, property_count int not null default 0, audit_ready_count int not null default 0,
 at_risk_count int not null default 0, critical_findings int not null default 0, open_corrective_actions int not null default 0,
 metrics jsonb not null default '{}'::jsonb, calculated_at timestamptz not null default now()
);
create table if not exists public.pms_sync_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, provider text not null,
 status text not null default 'credentials_pending' check(status in('credentials_pending','health_check_pending','reconciliation_pending','live','disabled')),
 credentials_secret_name text, last_successful_sync_at timestamptz, cursor text, records_imported int not null default 0,
 records_reconciled int not null default 0, records_failed int not null default 0, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,provider)
);
create index if not exists mock_audit_runs_user_idx on public.mock_audit_runs(user_id,created_at desc);
create index if not exists authority_submissions_user_idx on public.authority_submissions(user_id,created_at desc);
create index if not exists readiness_user_idx on public.portfolio_readiness_snapshots(user_id,calculated_at desc);
create index if not exists pms_connections_user_idx on public.pms_sync_connections(user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('certification-imports','certification-imports',false,52428800,array['application/pdf','image/png','image/jpeg','image/webp','application/zip','application/octet-stream']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.certification_import_jobs enable row level security;
alter table public.certification_import_items enable row level security;
alter table public.mock_audit_runs enable row level security;
alter table public.authority_submissions enable row level security;
alter table public.portfolio_readiness_snapshots enable row level security;
alter table public.pms_sync_connections enable row level security;

create policy "users manage import jobs" on public.certification_import_jobs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users manage import items" on public.certification_import_items for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users manage mock audits" on public.mock_audit_runs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users manage submissions" on public.authority_submissions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users manage readiness" on public.portfolio_readiness_snapshots for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users manage pms" on public.pms_sync_connections for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users manage import storage" on storage.objects for all to authenticated using(bucket_id='certification-imports' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='certification-imports' and (storage.foldername(name))[1]=auth.uid()::text);
