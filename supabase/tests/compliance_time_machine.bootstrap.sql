\ir audit_replay.bootstrap.sql

create table public.portfolio_readiness_snapshots(
 id uuid primary key,user_id uuid not null references auth.users(id),
 portfolio_name text not null,readiness_score numeric not null,
 property_count integer not null,audit_ready_count integer not null,
 at_risk_count integer not null,critical_findings integer not null,
 open_corrective_actions integer not null,metrics jsonb not null default '{}',
 calculated_at timestamptz not null
);
create table public.property_program_applicability(
 id uuid primary key,user_id uuid not null references auth.users(id),
 property_id text not null,program_code text not null,coverage_level text not null,
 building_id text,unit_id text,effective_from date not null,effective_to date,
 source_note text,created_by uuid,created_at timestamptz not null,updated_at timestamptz not null
);
create table public.compliance_graph_nodes(
 id uuid primary key,user_id uuid not null references auth.users(id),
 organization_id text not null,node_kind text not null,canonical_key text not null,
 label text not null,jurisdiction text,program_code text,source_table text,source_id text,
 evidence_manifest_id uuid,source_version text,rule_version text,engine_version text,
 applicable_limit_version text,property_election_version text,effective_from date not null,
 effective_to date,supersedes_node_id uuid,attributes jsonb not null default '{}',
 recorded_at timestamptz not null
);
alter table public.portfolio_readiness_snapshots enable row level security;
alter table public.property_program_applicability enable row level security;
alter table public.compliance_graph_nodes enable row level security;
create policy owner_snapshots on public.portfolio_readiness_snapshots for select to authenticated using ((select auth.uid())=user_id);
create policy owner_applicability on public.property_program_applicability for select to authenticated using ((select auth.uid())=user_id);
create policy owner_graph on public.compliance_graph_nodes for select to authenticated using ((select auth.uid())=user_id);
grant select on public.portfolio_readiness_snapshots,public.property_program_applicability,public.compliance_graph_nodes to authenticated;
