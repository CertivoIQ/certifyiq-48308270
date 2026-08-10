-- Vertical compliance slice: uploads -> extracted facts with citations -> deterministic
-- findings -> persisted human review decisions.

create table if not exists public.certification_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  status text not null default 'queued' check (status in ('queued','processing','completed','partial','failed')),
  source_name text not null,
  total_files int not null default 0,
  processed_files int not null default 0,
  duplicate_files int not null default 0,
  finding_count int not null default 0,
  error_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select, insert, update, delete on public.certification_import_jobs to authenticated;
grant all on public.certification_import_jobs to service_role;
alter table public.certification_import_jobs enable row level security;
create policy "users manage own import jobs" on public.certification_import_jobs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.certification_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.certification_import_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text,
  status text not null default 'queued' check (status in ('queued','processing','completed','duplicate','failed')),
  extraction_provider text,
  extracted_data jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists certification_import_items_user_idx
  on public.certification_import_items (user_id, created_at desc);
grant select, insert, update, delete on public.certification_import_items to authenticated;
grant all on public.certification_import_items to service_role;
alter table public.certification_import_items enable row level security;
create policy "users manage own import items" on public.certification_import_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Each extracted fact keeps its own citation back to the source document/page.
create table if not exists public.certification_facts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.certification_import_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text not null,
  field_name text not null,
  field_value jsonb,
  source_document_ref text not null,
  source_page int,
  source_snippet text,
  confidence numeric(5,4) not null default 0,
  human_verified boolean not null default false,
  required_for_decision boolean not null default true,
  extraction_provider text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists certification_facts_item_field_idx
  on public.certification_facts (item_id, field_name);
grant select, insert, update, delete on public.certification_facts to authenticated;
grant all on public.certification_facts to service_role;
alter table public.certification_facts enable row level security;
create policy "users manage own facts" on public.certification_facts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deterministic engine output. AI never writes here directly.
create table if not exists public.compliance_findings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.certification_import_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text not null,
  rule_id text not null,
  rule_version text not null,
  rule_pack_id text not null,
  rule_pack_version text not null,
  jurisdiction text not null,
  status text not null check (status in ('PASS','FAIL','UNABLE_TO_DETERMINE')),
  severity text not null default 'major' check (severity in ('critical','major','minor','info')),
  explanation text not null,
  blocking_reasons jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  engine_build text not null,
  review_state text not null default 'pending_review'
    check (review_state in ('pending_review','approved','remediation_requested','unable_to_determine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compliance_findings_item_idx
  on public.compliance_findings (item_id, created_at desc);
create unique index if not exists compliance_findings_unique_rule_idx
  on public.compliance_findings (item_id, rule_id, rule_version);
grant select, insert, update, delete on public.compliance_findings to authenticated;
grant all on public.compliance_findings to service_role;
alter table public.compliance_findings enable row level security;
create policy "users manage own findings" on public.compliance_findings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Append-only reviewer audit trail.
create table if not exists public.finding_reviews (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.compliance_findings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','remediation_requested','unable_to_determine')),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists finding_reviews_finding_idx on public.finding_reviews (finding_id, created_at desc);
grant select, insert on public.finding_reviews to authenticated;
grant all on public.finding_reviews to service_role;
alter table public.finding_reviews enable row level security;
create policy "users read own review trail" on public.finding_reviews
  for select to authenticated using (user_id = auth.uid());
create policy "reviewers append own decisions" on public.finding_reviews
  for insert to authenticated with check (user_id = auth.uid() and reviewer_id = auth.uid());

create or replace function public.block_finding_review_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Reviewer decisions are append-only.';
end;
$$;
drop trigger if exists t_finding_reviews_immutable on public.finding_reviews;
create trigger t_finding_reviews_immutable before update or delete on public.finding_reviews
  for each row execute function public.block_finding_review_mutation();

drop trigger if exists t_certification_import_jobs_updated on public.certification_import_jobs;
create trigger t_certification_import_jobs_updated before update on public.certification_import_jobs
  for each row execute function public.touch_updated_at();
drop trigger if exists t_certification_import_items_updated on public.certification_import_items;
create trigger t_certification_import_items_updated before update on public.certification_import_items
  for each row execute function public.touch_updated_at();
drop trigger if exists t_compliance_findings_updated on public.compliance_findings;
create trigger t_compliance_findings_updated before update on public.compliance_findings
  for each row execute function public.touch_updated_at();