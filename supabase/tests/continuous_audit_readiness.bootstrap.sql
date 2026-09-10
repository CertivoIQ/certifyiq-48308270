\ir audit_replay.bootstrap.sql
alter table public.certification_import_items add column program_codes text[] not null default '{}';
alter table public.compliance_findings
  add column review_state text not null default 'pending';
create table public.compliance_remediation_actions(
  id uuid primary key,finding_id uuid references public.compliance_findings(id),
  severity text not null,status text not null,remediation_plan text not null,
  remediation_summary text,due_at timestamptz,created_at timestamptz not null
);
create table public.pha_family_actions(
  id uuid primary key,user_id uuid not null references auth.users(id),
  program_code text not null,action_type text not null,due_date date not null,
  workflow_status text not null,verification_complete boolean not null,
  current_rule_version_validated boolean not null,
  reporting_path_validated boolean not null
);
create table public.pha_public_housing_leases(
  id uuid primary key,workspace_user_id uuid not null references auth.users(id),
  lease_start date not null,signature_complete boolean not null,status text not null
);
alter table public.certification_import_items enable row level security;
alter table public.compliance_findings enable row level security;
alter table public.compliance_remediation_actions enable row level security;
alter table public.pha_family_actions enable row level security;
alter table public.pha_public_housing_leases enable row level security;
create policy owner_items on public.certification_import_items for select to authenticated
  using ((select auth.uid())=user_id);
create policy owner_findings on public.compliance_findings for select to authenticated
  using ((select auth.uid())=user_id);
create policy owner_remediation on public.compliance_remediation_actions for select to authenticated
  using (exists(select 1 from public.compliance_findings f where f.id=finding_id and f.user_id=(select auth.uid())));
create policy owner_actions on public.pha_family_actions for select to authenticated
  using ((select auth.uid())=user_id);
create policy owner_leases on public.pha_public_housing_leases for select to authenticated
  using ((select auth.uid())=workspace_user_id);
grant select on public.certification_import_items,public.compliance_findings,
  public.compliance_remediation_actions,public.pha_family_actions,
  public.pha_public_housing_leases to authenticated;
