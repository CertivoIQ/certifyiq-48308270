\ir audit_replay.bootstrap.sql
alter table public.certification_import_items
  add column program_codes text[] not null default '{}';
alter table public.certification_workflow_cases
  add column status text not null default 'processing',
  add column approved_on date,
  add column audit_filed_at timestamptz;
alter table public.compliance_findings
  add column jurisdiction text not null default 'FEDERAL',
  add column review_state text not null default 'pending';
create table public.portfolio_properties(
  id uuid primary key,user_id uuid not null references auth.users(id),
  name text not null,created_at timestamptz not null default now()
);
create table public.compliance_remediation_actions(
  id uuid primary key,finding_id uuid references public.compliance_findings(id),
  finding_ref text not null,citation text not null,severity text not null,
  status text not null,remediation_plan text not null,due_at timestamptz,
  verified_at timestamptz,closed_at timestamptz,created_at timestamptz not null
);
create or replace function private.certification_is_manager(_actor uuid,_owner uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select _actor=_owner; $$;
grant all on public.portfolio_properties,public.compliance_remediation_actions
  to authenticated,service_role;
