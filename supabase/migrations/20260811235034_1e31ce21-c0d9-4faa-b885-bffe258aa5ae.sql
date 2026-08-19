-- Reconstructed HFA base schema.
-- Source: generated Supabase types + HFA server functions.
-- Replaces the original placeholder: -- see /tmp/mig1.sql

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public' and t.typname='hfa_submission_status'
  ) then
    create type public.hfa_submission_status as enum
      ('draft','submitted','in_review','correction_required','accepted','withdrawn');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public' and t.typname='correction_case_status'
  ) then
    create type public.correction_case_status as enum
      ('open','owner_responded','agency_review','accepted','reopened');
  end if;
end $$;

create table if not exists public.hfa_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code text not null,
  authority_scope jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hfa_agency_memberships (
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  invited_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table if not exists public.hfa_agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hfa_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.hfa_agencies(id) on delete restrict,
  certification_id text,
  evidence_manifest_id uuid references public.evidence_manifests(id) on delete restrict,
  organization_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  property_id text not null,
  property_name text,
  program text not null,
  reporting_period text not null,
  status public.hfa_submission_status not null default 'draft',
  preflight jsonb not null default '{}'::jsonb,
  readiness_score numeric,
  previous_submission_id uuid references public.hfa_submissions(id) on delete set null,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hfa_submission_grants (
  submission_id uuid not null references public.hfa_submissions(id) on delete cascade,
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (submission_id, agency_id)
);

create table if not exists public.correction_cases (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.hfa_submissions(id) on delete cascade,
  finding_ref text not null,
  title text not null,
  detail text,
  due_at timestamptz not null,
  status public.correction_case_status not null default 'open',
  disposition text,
  created_by uuid not null references auth.users(id) on delete restrict,
  owner_response text,
  owner_responded_at timestamptz,
  quarantine_ack_at timestamptz,
  quarantine_ack_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.correction_evidence (
  id uuid primary key default gen_random_uuid(),
  correction_case_id uuid not null references public.correction_cases(id) on delete cascade,
  document_ref text not null,
  document_label text,
  sha256 text not null,
  mime_type text,
  byte_size bigint,
  storage_bucket text,
  storage_path text,
  storage_version text,
  scan_status text not null default 'quarantined',
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now()
);

create table if not exists public.hfa_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  agency_id uuid references public.hfa_agencies(id) on delete set null,
  submission_id uuid references public.hfa_submissions(id) on delete cascade,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hfa_agencies_state_code_idx on public.hfa_agencies(state_code);
create index if not exists hfa_agency_memberships_user_idx on public.hfa_agency_memberships(user_id);
create index if not exists hfa_agency_invitations_agency_idx on public.hfa_agency_invitations(agency_id, created_at desc);
create index if not exists hfa_submissions_owner_idx on public.hfa_submissions(owner_user_id, created_at desc);
create index if not exists hfa_submissions_agency_status_idx on public.hfa_submissions(agency_id, status, created_at desc);
create index if not exists hfa_submissions_cert_manifest_idx on public.hfa_submissions(owner_user_id, agency_id, certification_id, evidence_manifest_id, status);
create index if not exists correction_cases_submission_idx on public.correction_cases(submission_id, created_at desc);
create index if not exists correction_evidence_case_idx on public.correction_evidence(correction_case_id, submitted_at desc);
create index if not exists hfa_audit_events_submission_idx on public.hfa_audit_events(submission_id, created_at desc);

drop trigger if exists t_hfa_agencies_updated on public.hfa_agencies;
create trigger t_hfa_agencies_updated before update on public.hfa_agencies
for each row execute function public.touch_updated_at();

drop trigger if exists t_hfa_agency_invitations_updated on public.hfa_agency_invitations;
create trigger t_hfa_agency_invitations_updated before update on public.hfa_agency_invitations
for each row execute function public.touch_updated_at();

drop trigger if exists t_hfa_submissions_updated on public.hfa_submissions;
create trigger t_hfa_submissions_updated before update on public.hfa_submissions
for each row execute function public.touch_updated_at();

drop trigger if exists t_correction_cases_updated on public.correction_cases;
create trigger t_correction_cases_updated before update on public.correction_cases
for each row execute function public.touch_updated_at();

insert into storage.buckets(id,name,public)
values ('correction-evidence','correction-evidence',false)
on conflict(id) do update set public=excluded.public;

grant select on public.hfa_agencies to authenticated;
grant select on public.hfa_agency_memberships to authenticated;
grant select on public.hfa_agency_invitations to authenticated;
grant select,insert,update on public.hfa_submissions to authenticated;
grant select,insert on public.hfa_submission_grants to authenticated;
grant select,insert,update on public.correction_cases to authenticated;
grant select,insert on public.correction_evidence to authenticated;
grant select on public.hfa_audit_events to authenticated;

grant all on public.hfa_agencies, public.hfa_agency_memberships,
  public.hfa_agency_invitations, public.hfa_submissions,
  public.hfa_submission_grants, public.correction_cases,
  public.correction_evidence, public.hfa_audit_events to service_role;

alter table public.hfa_agencies enable row level security;
alter table public.hfa_agency_memberships enable row level security;
alter table public.hfa_agency_invitations enable row level security;
alter table public.hfa_submissions enable row level security;
alter table public.hfa_submission_grants enable row level security;
alter table public.correction_cases enable row level security;
alter table public.correction_evidence enable row level security;
alter table public.hfa_audit_events enable row level security;

drop policy if exists "Owners read their own submissions" on public.hfa_submissions;
create policy "Owners read their own submissions"
on public.hfa_submissions for select to authenticated
using (owner_user_id=auth.uid());

drop policy if exists "Members read their own memberships" on public.hfa_agency_memberships;
create policy "Members read their own memberships"
on public.hfa_agency_memberships for select to authenticated
using (user_id=auth.uid());

drop policy if exists "Staff read agency memberships" on public.hfa_agency_memberships;
create policy "Staff read agency memberships"
on public.hfa_agency_memberships for select to authenticated
using (public.has_role(auth.uid(),'staff'::public.app_role));

drop policy if exists "Owners read their own corrections" on public.correction_cases;
create policy "Owners read their own corrections"
on public.correction_cases for select to authenticated
using (exists (
  select 1 from public.hfa_submissions s
  where s.id=correction_cases.submission_id and s.owner_user_id=auth.uid()
));

drop policy if exists "Owners read their correction evidence" on public.correction_evidence;
create policy "Owners read their correction evidence"
on public.correction_evidence for select to authenticated
using (exists (
  select 1 from public.correction_cases c
  join public.hfa_submissions s on s.id=c.submission_id
  where c.id=correction_evidence.correction_case_id and s.owner_user_id=auth.uid()
));

drop policy if exists "Owners read their HFA audit history" on public.hfa_audit_events;
create policy "Owners read their HFA audit history"
on public.hfa_audit_events for select to authenticated
using (exists (
  select 1 from public.hfa_submissions s
  where s.id=hfa_audit_events.submission_id and s.owner_user_id=auth.uid()
));
