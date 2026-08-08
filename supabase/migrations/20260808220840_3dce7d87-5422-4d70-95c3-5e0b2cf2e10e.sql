-- Phase 1: HFA Regulatory Console.
-- Adapted to the existing CertivoIQ schema: identity is auth.users, portfolio
-- references (organization/property/certification) are text ids as already used
-- by public.evidence_manifests. No parallel user/org/property models created.

create type public.hfa_submission_status as enum
  ('draft','submitted','in_review','correction_required','accepted','withdrawn');

create type public.correction_case_status as enum
  ('open','owner_responded','agency_review','accepted','reopened');

-- ---------------------------------------------------------------- agencies
create table public.hfa_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code text not null,
  authority_scope jsonb not null default '[]'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.hfa_agencies to authenticated;
grant all on public.hfa_agencies to service_role;
alter table public.hfa_agencies enable row level security;

create table public.hfa_agency_memberships (
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('agency_admin','rule_reviewer','monitor','read_only')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

grant select on public.hfa_agency_memberships to authenticated;
grant all on public.hfa_agency_memberships to service_role;
alter table public.hfa_agency_memberships enable row level security;

-- Security-definer helpers keep policies non-recursive.
create or replace function public.is_agency_member(_agency_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id = _agency_id and m.user_id = _user_id
  );
$$;

revoke all on function public.is_agency_member(uuid, uuid) from public, anon;

create or replace function public.has_agency_role(_agency_id uuid, _user_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id = _agency_id
      and m.user_id = _user_id
      and m.role = any(_roles)
  );
$$;

revoke all on function public.has_agency_role(uuid, uuid, text[]) from public, anon;

create policy "Members and staff read their agency"
  on public.hfa_agencies for select to authenticated
  using (public.is_agency_member(id, auth.uid()) or public.has_role(auth.uid(), 'staff'));

create policy "Users read their own agency membership"
  on public.hfa_agency_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'staff'));

-- ------------------------------------------------------------- submissions
create table public.hfa_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.hfa_agencies(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text not null,
  property_id text not null,
  property_name text,
  certification_id text,
  program text not null,
  reporting_period text not null,
  status public.hfa_submission_status not null default 'draft',
  evidence_manifest_id uuid references public.evidence_manifests(id) on delete set null,
  readiness_score numeric(5,2),
  preflight jsonb not null default '{}'::jsonb,
  previous_submission_id uuid references public.hfa_submissions(id) on delete set null,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hfa_submissions_agency_idx on public.hfa_submissions (agency_id, status);
create index hfa_submissions_owner_idx on public.hfa_submissions (owner_user_id);

grant select, insert, update on public.hfa_submissions to authenticated;
grant all on public.hfa_submissions to service_role;
alter table public.hfa_submissions enable row level security;

create table public.hfa_submission_grants (
  submission_id uuid not null references public.hfa_submissions(id) on delete cascade,
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (submission_id, agency_id)
);

grant select, insert, update, delete on public.hfa_submission_grants to authenticated;
grant all on public.hfa_submission_grants to service_role;
alter table public.hfa_submission_grants enable row level security;

-- Active grant test: the owner explicitly shared this submission, it left
-- draft, and the grant has not been revoked. Agency membership alone is never
-- sufficient, so no portfolio-wide discovery is possible.
create or replace function public.agency_can_view_submission(_submission_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id = g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id = g.agency_id and m.user_id = _user_id
    where g.submission_id = _submission_id
      and g.revoked_at is null
      and s.agency_id = g.agency_id
      and s.status <> 'draft'
  );
$$;

revoke all on function public.agency_can_view_submission(uuid, uuid) from public, anon;

create or replace function public.agency_can_review_submission(_submission_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id = g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id = g.agency_id and m.user_id = _user_id
    where g.submission_id = _submission_id
      and g.revoked_at is null
      and s.agency_id = g.agency_id
      and s.status <> 'draft'
      and m.role in ('agency_admin','monitor')
  );
$$;

revoke all on function public.agency_can_review_submission(uuid, uuid) from public, anon;

create policy "Owners read their own submissions"
  on public.hfa_submissions for select to authenticated
  using (owner_user_id = auth.uid());

create policy "Granted agency members read submitted packages"
  on public.hfa_submissions for select to authenticated
  using (public.agency_can_view_submission(id, auth.uid()));

create policy "Owners create their own submissions"
  on public.hfa_submissions for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "Owners update their unaccepted submissions"
  on public.hfa_submissions for update to authenticated
  using (owner_user_id = auth.uid() and status <> 'accepted')
  with check (owner_user_id = auth.uid());

create policy "Reviewers advance granted submissions"
  on public.hfa_submissions for update to authenticated
  using (public.agency_can_review_submission(id, auth.uid()))
  with check (public.agency_can_review_submission(id, auth.uid()));

create policy "Owners read their own grants"
  on public.hfa_submission_grants for select to authenticated
  using (exists (select 1 from public.hfa_submissions s
                 where s.id = submission_id and s.owner_user_id = auth.uid()));

create policy "Agency members read grants naming their agency"
  on public.hfa_submission_grants for select to authenticated
  using (public.is_agency_member(agency_id, auth.uid()));

create policy "Owners grant access to their own submissions"
  on public.hfa_submission_grants for insert to authenticated
  with check (
    granted_by = auth.uid()
    and exists (select 1 from public.hfa_submissions s
                where s.id = submission_id and s.owner_user_id = auth.uid()
                  and s.agency_id = agency_id)
  );

create policy "Owners revoke their own grants"
  on public.hfa_submission_grants for update to authenticated
  using (exists (select 1 from public.hfa_submissions s
                 where s.id = submission_id and s.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.hfa_submissions s
                      where s.id = submission_id and s.owner_user_id = auth.uid()));

create policy "Owners delete grants for draft submissions"
  on public.hfa_submission_grants for delete to authenticated
  using (exists (select 1 from public.hfa_submissions s
                 where s.id = submission_id and s.owner_user_id = auth.uid()
                   and s.status = 'draft'));

-- -------------------------------------------------------- correction cases
create table public.correction_cases (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.hfa_submissions(id) on delete cascade,
  finding_ref text not null,
  title text not null,
  detail text,
  status public.correction_case_status not null default 'open',
  due_at timestamptz not null,
  owner_response text,
  owner_responded_at timestamptz,
  disposition text,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index correction_cases_submission_idx on public.correction_cases (submission_id, status);

grant select, insert, update on public.correction_cases to authenticated;
grant all on public.correction_cases to service_role;
alter table public.correction_cases enable row level security;

create policy "Owners read corrections on their submissions"
  on public.correction_cases for select to authenticated
  using (exists (select 1 from public.hfa_submissions s
                 where s.id = submission_id and s.owner_user_id = auth.uid()));

create policy "Granted agency members read corrections"
  on public.correction_cases for select to authenticated
  using (public.agency_can_view_submission(submission_id, auth.uid()));

create policy "Reviewers open corrections"
  on public.correction_cases for insert to authenticated
  with check (created_by = auth.uid()
              and public.agency_can_review_submission(submission_id, auth.uid()));

create policy "Reviewers disposition corrections"
  on public.correction_cases for update to authenticated
  using (public.agency_can_review_submission(submission_id, auth.uid()))
  with check (public.agency_can_review_submission(submission_id, auth.uid()));

create policy "Owners respond to open corrections"
  on public.correction_cases for update to authenticated
  using (exists (select 1 from public.hfa_submissions s
                 where s.id = submission_id and s.owner_user_id = auth.uid())
         and status in ('open','reopened'))
  with check (exists (select 1 from public.hfa_submissions s
                      where s.id = submission_id and s.owner_user_id = auth.uid()));

create table public.correction_evidence (
  id uuid primary key default gen_random_uuid(),
  correction_case_id uuid not null references public.correction_cases(id) on delete cascade,
  document_ref text not null,
  document_label text,
  sha256 text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

grant select, insert on public.correction_evidence to authenticated;
grant all on public.correction_evidence to service_role;
alter table public.correction_evidence enable row level security;

create policy "Owners read evidence on their corrections"
  on public.correction_evidence for select to authenticated
  using (exists (select 1 from public.correction_cases c
                 join public.hfa_submissions s on s.id = c.submission_id
                 where c.id = correction_case_id and s.owner_user_id = auth.uid()));

create policy "Granted agency members read correction evidence"
  on public.correction_evidence for select to authenticated
  using (exists (select 1 from public.correction_cases c
                 where c.id = correction_case_id
                   and public.agency_can_view_submission(c.submission_id, auth.uid())));

create policy "Owners attach correction evidence"
  on public.correction_evidence for insert to authenticated
  with check (submitted_by = auth.uid()
              and exists (select 1 from public.correction_cases c
                          join public.hfa_submissions s on s.id = c.submission_id
                          where c.id = correction_case_id and s.owner_user_id = auth.uid()));

-- ------------------------------------------------------------ audit events
create table public.hfa_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('owner','agency','system')),
  agency_id uuid references public.hfa_agencies(id) on delete set null,
  submission_id uuid references public.hfa_submissions(id) on delete cascade,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index hfa_audit_events_submission_idx on public.hfa_audit_events (submission_id, created_at desc);

grant select, insert on public.hfa_audit_events to authenticated;
grant all on public.hfa_audit_events to service_role;
alter table public.hfa_audit_events enable row level security;

create or replace function public.block_hfa_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'HFA audit events are append-only.';
end;
$$;

create trigger t_hfa_audit_events_append_only
  before update or delete on public.hfa_audit_events
  for each row execute function public.block_hfa_audit_mutation();

create policy "Actors record their own audit events"
  on public.hfa_audit_events for insert to authenticated
  with check (actor_id = auth.uid());

create policy "Owners read audit history for their submissions"
  on public.hfa_audit_events for select to authenticated
  using (exists (select 1 from public.hfa_submissions s
                 where s.id = submission_id and s.owner_user_id = auth.uid()));

create policy "Granted agency members read audit history"
  on public.hfa_audit_events for select to authenticated
  using (public.agency_can_view_submission(submission_id, auth.uid()));

-- ---------------------------------------------------------------- triggers
create trigger t_hfa_agencies_updated before update on public.hfa_agencies
  for each row execute function public.touch_updated_at();
create trigger t_hfa_submissions_updated before update on public.hfa_submissions
  for each row execute function public.touch_updated_at();
create trigger t_correction_cases_updated before update on public.correction_cases
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------ synthetic demo agencies
-- Demo-only agencies, flagged is_demo, used exclusively by the isolated demo
-- organization. These are fictional and imply no government relationship.
insert into public.hfa_agencies (id, name, state_code, authority_scope, is_demo)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Demo State Housing Finance Agency (Sample)', 'TX',
   '["LIHTC","BOND"]'::jsonb, true),
  ('00000000-0000-4000-8000-0000000000a2', 'Demo Regional Housing Authority (Sample)', 'NY',
   '["SEC8","HOME"]'::jsonb, true);