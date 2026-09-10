-- Make the compliance graph privilege boundary explicit in environments where
-- Supabase default privileges grant authenticated table writes and public
-- function execution. RLS already rejected those writes; these revokes enforce
-- least privilege at both database authorization layers.

revoke all on public.compliance_graph_nodes from public, anon, authenticated;
revoke all on public.compliance_graph_edges from public, anon, authenticated;
revoke all on public.compliance_graph_events from public, anon, authenticated;

grant select on public.compliance_graph_nodes, public.compliance_graph_edges,
  public.compliance_graph_events to authenticated;
grant all on public.compliance_graph_nodes, public.compliance_graph_edges,
  public.compliance_graph_events to service_role;

revoke all on function public.compliance_finding_why_chain(uuid, date)
  from public, anon;
grant execute on function public.compliance_finding_why_chain(uuid, date)
  to authenticated;

-- Index every non-leading foreign-key column used by graph traversal,
-- supersession, event replay, and Evidence Record linkage.
create index compliance_graph_nodes_supersedes_idx
  on public.compliance_graph_nodes (supersedes_node_id)
  where supersedes_node_id is not null;
create index compliance_graph_edges_from_node_idx
  on public.compliance_graph_edges (from_node_id);
create index compliance_graph_edges_to_node_idx
  on public.compliance_graph_edges (to_node_id);
create index compliance_graph_edges_evidence_manifest_idx
  on public.compliance_graph_edges (evidence_manifest_id)
  where evidence_manifest_id is not null;
create index compliance_graph_events_node_idx
  on public.compliance_graph_events (node_id)
  where node_id is not null;
create index compliance_graph_events_edge_idx
  on public.compliance_graph_events (edge_id)
  where edge_id is not null;
