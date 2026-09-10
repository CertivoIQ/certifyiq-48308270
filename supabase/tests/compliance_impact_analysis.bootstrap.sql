\ir compliance_time_machine.bootstrap.sql
create table public.compliance_graph_edges(
 id uuid primary key,user_id uuid not null references auth.users(id),organization_id text not null,
 from_node_id uuid not null references public.compliance_graph_nodes(id),
 to_node_id uuid not null references public.compliance_graph_nodes(id),
 relationship_type text not null,source_version text,effective_from date not null,effective_to date,
 evidence_manifest_id uuid,attributes jsonb not null default '{}',recorded_at timestamptz not null
);
alter table public.compliance_graph_edges enable row level security;
create policy owner_edges on public.compliance_graph_edges for select to authenticated using ((select auth.uid())=user_id);
grant select on public.compliance_graph_edges to authenticated;
