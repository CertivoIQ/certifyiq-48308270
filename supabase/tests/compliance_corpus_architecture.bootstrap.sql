\ir compliance_graph_temporal.bootstrap.sql
create table public.portfolio_properties(id uuid primary key,user_id uuid not null references auth.users(id));
create table public.compliance_findings(id uuid primary key,user_id uuid not null references auth.users(id));
create table public.compliance_remediation_actions(
 id uuid primary key,finding_id uuid not null references public.compliance_findings(id)
);
create table public.finding_reviews(
 id uuid primary key,user_id uuid not null references auth.users(id),finding_id uuid not null references public.compliance_findings(id)
);
create table public.audit_simulation_reports(
 id uuid primary key,user_id uuid not null references auth.users(id)
);
alter table public.portfolio_properties enable row level security;
alter table public.compliance_findings enable row level security;
alter table public.compliance_remediation_actions enable row level security;
alter table public.finding_reviews enable row level security;
alter table public.audit_simulation_reports enable row level security;
grant select on public.portfolio_properties,public.compliance_findings,public.compliance_remediation_actions,
 public.finding_reviews,public.audit_simulation_reports to authenticated;
