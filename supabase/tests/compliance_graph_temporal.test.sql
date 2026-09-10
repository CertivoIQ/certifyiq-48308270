begin;
insert into auth.users(id, email) values
  ('a4400000-0000-4000-8000-000000000001', 'graph-owner@example.invalid'),
  ('a4400000-0000-4000-8000-000000000002', 'graph-other@example.invalid');
insert into public.evidence_manifests(id, user_id, manifest_sha256) values
  ('a4400000-0000-4000-8000-000000000010', 'a4400000-0000-4000-8000-000000000001', repeat('a', 64));

insert into public.compliance_graph_nodes
  (id, user_id, organization_id, node_kind, canonical_key, label, effective_from)
values
  ('a4400000-0000-4000-8000-000000000011', 'a4400000-0000-4000-8000-000000000001', 'org-owner', 'authority', 'hud-notice-1', 'HUD notice', date '2026-01-01'),
  ('a4400000-0000-4000-8000-000000000012', 'a4400000-0000-4000-8000-000000000001', 'org-owner', 'rule', 'income-rule-1', 'Income rule', date '2026-01-01'),
  ('a4400000-0000-4000-8000-000000000013', 'a4400000-0000-4000-8000-000000000001', 'org-owner', 'finding', 'finding-1', 'Income finding', date '2026-01-01'),
  ('a4400000-0000-4000-8000-000000000014', 'a4400000-0000-4000-8000-000000000001', 'org-owner', 'evidence_record', 'manifest-1', 'Existing Evidence Record', date '2026-01-01');

insert into public.compliance_graph_edges
  (user_id, organization_id, from_node_id, to_node_id, relationship_type, effective_from)
values
  ('a4400000-0000-4000-8000-000000000001', 'org-owner', 'a4400000-0000-4000-8000-000000000011', 'a4400000-0000-4000-8000-000000000012', 'governs', date '2026-01-01'),
  ('a4400000-0000-4000-8000-000000000001', 'org-owner', 'a4400000-0000-4000-8000-000000000012', 'a4400000-0000-4000-8000-000000000013', 'determines', date '2026-01-01'),
  ('a4400000-0000-4000-8000-000000000001', 'org-owner', 'a4400000-0000-4000-8000-000000000014', 'a4400000-0000-4000-8000-000000000013', 'records', date '2026-01-01');

insert into public.compliance_graph_events
  (user_id, organization_id, node_id, event_type, event_sha256)
values ('a4400000-0000-4000-8000-000000000001', 'org-owner', 'a4400000-0000-4000-8000-000000000013', 'recorded', repeat('b', 64));

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4400000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select count(*) from public.compliance_graph_nodes) <> 4 then raise exception 'Owner graph read failed'; end if;
  if (select count(*) from public.compliance_finding_why_chain('a4400000-0000-4000-8000-000000000013', date '2026-06-01')) <> 4 then
    raise exception 'Why chain did not include authority, rule, finding, and evidence';
  end if;
  if has_table_privilege('authenticated', 'public.compliance_graph_nodes', 'INSERT')
     or has_table_privilege('authenticated', 'public.compliance_graph_nodes', 'UPDATE')
     or has_table_privilege('authenticated', 'public.compliance_graph_nodes', 'DELETE')
     or has_table_privilege('authenticated', 'public.compliance_graph_edges', 'INSERT')
     or has_table_privilege('authenticated', 'public.compliance_graph_events', 'INSERT') then
    raise exception 'Authenticated users received mutable graph privileges';
  end if;
  if has_function_privilege('anon', 'public.compliance_finding_why_chain(uuid,date)', 'EXECUTE')
     or has_function_privilege('public', 'public.compliance_finding_why_chain(uuid,date)', 'EXECUTE') then
    raise exception 'Why-chain execution leaked beyond authenticated users';
  end if;
  if to_regclass('public.compliance_graph_nodes_supersedes_idx') is null
     or to_regclass('public.compliance_graph_edges_from_node_idx') is null
     or to_regclass('public.compliance_graph_edges_to_node_idx') is null
     or to_regclass('public.compliance_graph_edges_evidence_manifest_idx') is null
     or to_regclass('public.compliance_graph_events_node_idx') is null
     or to_regclass('public.compliance_graph_events_edge_idx') is null then
    raise exception 'Compliance graph foreign-key indexes are incomplete';
  end if;
end $$;
reset role;

set local role service_role;
do $$ begin
  begin
    update public.compliance_graph_nodes set label = 'changed' where id = 'a4400000-0000-4000-8000-000000000013';
    raise exception 'Graph history was mutable for service writers';
  exception when raise_exception then
    if sqlerrm <> 'Compliance graph history is immutable.' then raise; end if;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4400000-0000-4000-8000-000000000002', true);
do $$ begin
  if exists (select 1 from public.compliance_graph_nodes) then raise exception 'Cross-tenant graph read'; end if;
  if exists (select 1 from public.compliance_finding_why_chain('a4400000-0000-4000-8000-000000000013', date '2026-06-01')) then
    raise exception 'Cross-tenant why chain';
  end if;
end $$;
reset role;
rollback;
