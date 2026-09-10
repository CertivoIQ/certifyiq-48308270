-- Isolated CI only: minimum Supabase-compatible certification lifecycle.
create schema if not exists auth;
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
alter role service_role bypassrls;
create table auth.users(id uuid primary key,email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create or replace function public.has_role(_user_id uuid,_role text)
returns boolean language sql stable as $$ select false; $$;

create table public.certification_import_items(
  id uuid primary key,user_id uuid not null references auth.users(id),
  property_id uuid,matched_certification_id uuid,created_at timestamptz not null,
  processed_at timestamptz,original_file_name text not null,mime_type text not null,
  size_bytes bigint not null,status text not null,sha256 text,extracted_data jsonb not null default '{}',
  findings jsonb not null default '[]',confidence numeric,extraction_provider text
);
create table public.certification_document_instances(
  id uuid primary key,certification_item_id uuid not null references public.certification_import_items(id),
  user_id uuid not null references auth.users(id),organization_id text not null,
  detected_form_code text,detected_revision text,recognition_status text not null,
  confidence numeric,document_sha256 text not null,review_status text not null,
  reviewed_at timestamptz,created_at timestamptz not null,source_page integer
);
create table public.compliance_findings(
  id uuid primary key,item_id uuid not null references public.certification_import_items(id),
  user_id uuid not null references auth.users(id),organization_id text not null,
  rule_id text not null,rule_version text not null,rule_pack_id text not null,
  rule_pack_version text not null,status text not null,severity text not null,
  explanation text not null,evidence_refs jsonb not null default '[]',
  engine_build text not null,created_at timestamptz not null
);
create table public.certification_workflow_cases(
  id uuid primary key,certification_item_id uuid not null references public.certification_import_items(id)
);
create table public.certification_workflow_events(
  id bigint generated always as identity primary key,case_id uuid not null references public.certification_workflow_cases(id),
  finding_id uuid references public.compliance_findings(id),actor_id uuid,
  event_type text not null,detail jsonb not null default '{}',occurred_at timestamptz not null
);
create table public.finding_reviews(
  id uuid primary key,finding_id uuid not null references public.compliance_findings(id),
  user_id uuid not null references auth.users(id),reviewer_id uuid not null,
  decision text not null,reason text,created_at timestamptz not null,
  manifest_sha256 text,expires_at timestamptz,revoked_at timestamptz
);
create table public.evidence_manifests(
  id uuid primary key,review_id text not null,user_id uuid not null references auth.users(id),
  organization_id text not null,property_id text,certification_id text,
  outcome text not null,engine_build text not null,manifest jsonb not null,
  manifest_sha256 text not null,created_at timestamptz not null
);
grant usage on schema public,auth,private,extensions to authenticated,anon,service_role;
grant all on all tables in schema public to authenticated,service_role;
grant usage,select on all sequences in schema public to authenticated,service_role;
