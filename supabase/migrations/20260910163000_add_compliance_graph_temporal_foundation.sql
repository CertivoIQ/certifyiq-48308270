-- Phase 2–4: executable graph and temporal foundation.
-- This migration is additive. It links, but never replaces, the existing
-- immutable Evidence Record in public.evidence_manifests.

create table public.compliance_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  node_kind text not null check (node_kind in (
    'authority','regulation','guidance','state_qap','compliance_manual','notice',
    'form','program','property','unit','household','certification','document',
    'data_element','calculation','rule','finding','remediation','approval',
    'evidence_record'
  )),
  canonical_key text not null,
  label text not null,
  jurisdiction text,
  program_code text,
  source_table text,
  source_id text,
  evidence_manifest_id uuid references public.evidence_manifests(id) on delete restrict,
  source_version text,
  rule_version text,
  engine_version text,
  effective_from date not null,
  effective_to date,
  supersedes_node_id uuid references public.compliance_graph_nodes(id) on delete restrict,
  attributes jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (user_id, node_kind, canonical_key, effective_from)
);

create index compliance_graph_nodes_owner_effective_idx
  on public.compliance_graph_nodes (user_id, effective_from, effective_to);
create index compliance_graph_nodes_evidence_manifest_idx
  on public.compliance_graph_nodes (evidence_manifest_id)
  where evidence_manifest_id is not null;
create index compliance_graph_nodes_source_idx
  on public.compliance_graph_nodes (source_table, source_id)
  where source_table is not null and source_id is not null;

create table public.compliance_graph_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  from_node_id uuid not null references public.compliance_graph_nodes(id) on delete restrict,
  to_node_id uuid not null references public.compliance_graph_nodes(id) on delete restrict,
  relationship_type text not null check (relationship_type in (
    'governs','interprets','supersedes','applies_to','contains','documents',
    'supports','calculates','determines','finds','remediates','approves',
    'records','derived_from'
  )),
  source_version text,
  effective_from date not null,
  effective_to date,
  evidence_manifest_id uuid references public.evidence_manifests(id) on delete restrict,
  attributes jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  check (from_node_id <> to_node_id),
  check (effective_to is null or effective_to >= effective_from),
  unique (from_node_id, to_node_id, relationship_type, effective_from)
);

create index compliance_graph_edges_owner_to_effective_idx
  on public.compliance_graph_edges (user_id, to_node_id, effective_from, effective_to);
create index compliance_graph_edges_owner_from_effective_idx
  on public.compliance_graph_edges (user_id, from_node_id, effective_from, effective_to);

-- An append-only timeline records material graph creation and replacement
-- events without mutating the historical node or edge rows.
create table public.compliance_graph_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id text not null,
  node_id uuid references public.compliance_graph_nodes(id) on delete restrict,
  edge_id uuid references public.compliance_graph_edges(id) on delete restrict,
  event_type text not null check (event_type in ('recorded','superseded','linked','validated')),
  occurred_at timestamptz not null default now(),
  event_sha256 text not null check (event_sha256 ~ '^[a-f0-9]{64}$'),
  detail jsonb not null default '{}'::jsonb,
  check (node_id is not null or edge_id is not null)
);

create index compliance_graph_events_owner_occurred_idx
  on public.compliance_graph_events (user_id, occurred_at desc);

alter table public.compliance_graph_nodes enable row level security;
alter table public.compliance_graph_edges enable row level security;
alter table public.compliance_graph_events enable row level security;

grant select on public.compliance_graph_nodes, public.compliance_graph_edges,
  public.compliance_graph_events to authenticated;
grant all on public.compliance_graph_nodes, public.compliance_graph_edges,
  public.compliance_graph_events to service_role;

create policy "Users read own compliance graph nodes"
  on public.compliance_graph_nodes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Staff read compliance graph nodes"
  on public.compliance_graph_nodes for select to authenticated
  using (public.has_role((select auth.uid()), 'staff'));
create policy "Users read own compliance graph edges"
  on public.compliance_graph_edges for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Staff read compliance graph edges"
  on public.compliance_graph_edges for select to authenticated
  using (public.has_role((select auth.uid()), 'staff'));
create policy "Users read own compliance graph events"
  on public.compliance_graph_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Staff read compliance graph events"
  on public.compliance_graph_events for select to authenticated
  using (public.has_role((select auth.uid()), 'staff'));

create or replace function public.block_compliance_graph_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Compliance graph history is immutable.';
end;
$$;

create trigger compliance_graph_nodes_immutable
  before update or delete on public.compliance_graph_nodes
  for each row execute function public.block_compliance_graph_mutation();
create trigger compliance_graph_edges_immutable
  before update or delete on public.compliance_graph_edges
  for each row execute function public.block_compliance_graph_mutation();
create trigger compliance_graph_events_immutable
  before update or delete on public.compliance_graph_events
  for each row execute function public.block_compliance_graph_mutation();

-- Reverse traversal follows an authority → determination graph from a finding
-- back to its supporting authority, bounded to avoid cyclic-data exhaustion.
create or replace function public.compliance_finding_why_chain(
  _finding_node_id uuid,
  _as_of date default current_date
)
returns table (
  depth integer,
  node_id uuid,
  node_kind text,
  label text,
  relationship_type text,
  effective_from date,
  effective_to date,
  source_version text,
  rule_version text,
  engine_version text,
  evidence_manifest_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive chain as (
    select
      0 as depth,
      n.id,
      n.node_kind,
      n.label,
      null::text as relationship_type,
      n.effective_from,
      n.effective_to,
      n.source_version,
      n.rule_version,
      n.engine_version,
      n.evidence_manifest_id,
      array[n.id] as visited
    from public.compliance_graph_nodes n
    where n.id = _finding_node_id
      and n.node_kind = 'finding'
      and n.effective_from <= _as_of
      and (n.effective_to is null or n.effective_to >= _as_of)
    union all
    select
      c.depth + 1,
      parent.id,
      parent.node_kind,
      parent.label,
      e.relationship_type,
      parent.effective_from,
      parent.effective_to,
      parent.source_version,
      parent.rule_version,
      parent.engine_version,
      parent.evidence_manifest_id,
      c.visited || parent.id
    from chain c
    join public.compliance_graph_edges e on e.to_node_id = c.id
    join public.compliance_graph_nodes parent on parent.id = e.from_node_id
    where c.depth < 24
      and not parent.id = any(c.visited)
      and e.effective_from <= _as_of
      and (e.effective_to is null or e.effective_to >= _as_of)
      and parent.effective_from <= _as_of
      and (parent.effective_to is null or parent.effective_to >= _as_of)
  )
  select depth, id, node_kind, label, relationship_type, effective_from,
    effective_to, source_version, rule_version, engine_version, evidence_manifest_id
  from chain
  order by depth;
$$;

grant execute on function public.compliance_finding_why_chain(uuid, date) to authenticated;
revoke all on function public.block_compliance_graph_mutation() from public, anon, authenticated;
