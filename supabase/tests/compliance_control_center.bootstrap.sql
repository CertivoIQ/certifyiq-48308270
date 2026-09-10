\ir continuous_audit_readiness.bootstrap.sql
create table public.portfolio_properties(
  id uuid primary key,user_id uuid not null references auth.users(id),name text not null
);
create table public.portfolio_units(
  id uuid primary key,user_id uuid not null references auth.users(id),
  property_id uuid not null references public.portfolio_properties(id),unit_number text not null
);
create table public.regulatory_diff_reports(
  id uuid primary key,user_id uuid not null references auth.users(id),
  current_source_node_id uuid not null,diff_status text not null,compared_at timestamptz not null
);
alter table public.portfolio_properties enable row level security;
alter table public.portfolio_units enable row level security;
alter table public.regulatory_diff_reports enable row level security;
create policy owner_properties on public.portfolio_properties for select to authenticated using ((select auth.uid())=user_id);
create policy owner_units on public.portfolio_units for select to authenticated using ((select auth.uid())=user_id);
create policy owner_diffs on public.regulatory_diff_reports for select to authenticated using ((select auth.uid())=user_id);
grant select on public.portfolio_properties,public.portfolio_units,public.regulatory_diff_reports to authenticated;
