create type hfa_submission_status as enum ('draft','submitted','in_review','correction_required','accepted','withdrawn');
create type correction_case_status as enum ('open','owner_responded','agency_review','accepted','reopened');
create type rule_release_status as enum ('draft','expert_validated','agency_reviewed','agency_certified','suspended');

create table hfa_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code text not null,
  authority_scope jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table hfa_agency_memberships (
  agency_id uuid not null references hfa_agencies(id),
  user_id uuid not null,
  role text not null check (role in ('agency_admin','rule_reviewer','monitor','read_only')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table hfa_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references hfa_agencies(id),
  submitting_organization_id uuid not null,
  property_id uuid not null,
  program text not null,
  reporting_period text not null,
  status hfa_submission_status not null default 'draft',
  evidence_manifest_id uuid,
  readiness_score numeric(5,2),
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table hfa_submission_grants (
  submission_id uuid not null references hfa_submissions(id) on delete cascade,
  agency_id uuid not null references hfa_agencies(id),
  granted_by uuid not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (submission_id, agency_id)
);

create table hfa_rule_releases (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references hfa_agencies(id),
  state_code text not null,
  program text not null,
  version text not null,
  effective_from date not null,
  effective_to date,
  status rule_release_status not null default 'draft',
  source_manifest jsonb not null,
  validation_report jsonb,
  approved_by uuid,
  approved_at timestamptz,
  unique (agency_id, state_code, program, version)
);

create table hfa_sampling_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references hfa_agencies(id),
  policy_version text not null,
  random_seed text not null,
  criteria jsonb not null,
  population_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table hfa_sampling_selections (
  sampling_run_id uuid not null references hfa_sampling_runs(id) on delete cascade,
  certification_id uuid not null,
  selection_reason jsonb not null,
  primary key (sampling_run_id, certification_id)
);

create table correction_cases (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references hfa_submissions(id),
  finding_id uuid not null,
  status correction_case_status not null default 'open',
  due_at timestamptz not null,
  owner_response text,
  disposition text,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table correction_evidence (
  id uuid primary key default gen_random_uuid(),
  correction_case_id uuid not null references correction_cases(id) on delete cascade,
  document_id uuid not null,
  sha256 text not null,
  submitted_by uuid not null,
  submitted_at timestamptz not null default now()
);

-- Lovable must adapt foreign keys to the existing user, organization, property,
-- certification, finding, document and evidence-manifest tables. Do not create
-- parallel identity or portfolio models. Enable RLS and implement policies from
-- authenticated memberships plus active submission grants. Agency membership
-- alone must never grant portfolio-wide owner access.

