begin;
insert into auth.users(id,email) values
 ('fa000000-0000-4000-8000-000000000001','corpus-owner@example.invalid'),
 ('fa000000-0000-4000-8000-000000000002','corpus-other@example.invalid');
insert into public.evidence_manifests(id,user_id,manifest_sha256) values
 ('fa000000-0000-4000-8000-000000000010','fa000000-0000-4000-8000-000000000001',repeat('a',64)),
 ('fa000000-0000-4000-8000-000000000011','fa000000-0000-4000-8000-000000000002',repeat('b',64));
insert into public.compliance_graph_nodes(
 id,user_id,organization_id,node_kind,canonical_key,label,effective_from,attributes
) values
 ('fa000000-0000-4000-8000-000000000020','fa000000-0000-4000-8000-000000000001','owner-org','regulation','reg:owner','Owner regulation','2026-01-01','{}'),
 ('fa000000-0000-4000-8000-000000000021','fa000000-0000-4000-8000-000000000002','other-org','regulation','reg:other','Other regulation','2026-01-01','{}');
insert into public.portfolio_properties(id,user_id) values
 ('fa000000-0000-4000-8000-000000000030','fa000000-0000-4000-8000-000000000001'),
 ('fa000000-0000-4000-8000-000000000031','fa000000-0000-4000-8000-000000000002');
insert into public.compliance_corpus_records(
 id,user_id,organization_id,regulation_node_id,target_kind,target_reference,property_id,
 source_version,structured_facts,provenance,record_sha256
) values
 ('fa000000-0000-4000-8000-000000000040','fa000000-0000-4000-8000-000000000001','owner-org',
  'fa000000-0000-4000-8000-000000000020','property','property:owner','fa000000-0000-4000-8000-000000000030',
  '2026.1','{"relationship":"applies_to"}','{"source_table":"compliance_graph_nodes","source_id":"fa000000-0000-4000-8000-000000000020","captured_at":"2026-02-01T00:00:00Z"}',repeat('c',64)),
 ('fa000000-0000-4000-8000-000000000041','fa000000-0000-4000-8000-000000000002','other-org',
  'fa000000-0000-4000-8000-000000000021','property','property:other','fa000000-0000-4000-8000-000000000031',
  '2026.1','{"relationship":"applies_to"}','{"source_table":"compliance_graph_nodes","source_id":"fa000000-0000-4000-8000-000000000021","captured_at":"2026-02-01T00:00:00Z"}',repeat('d',64));

do $test$
declare denied boolean:=false; immutable boolean:=false;
begin
 begin
  insert into public.compliance_corpus_records(
   user_id,organization_id,regulation_node_id,target_kind,target_reference,property_id,
   source_version,provenance,record_sha256
  ) values (
   'fa000000-0000-4000-8000-000000000001','owner-org','fa000000-0000-4000-8000-000000000020',
   'property','cross-tenant','fa000000-0000-4000-8000-000000000031','2026.1',
   '{"source_table":"test","source_id":"cross","captured_at":"2026-02-01T00:00:00Z"}',repeat('e',64)
  );
 exception when sqlstate '42501' then denied:=true; end;
 begin update public.compliance_corpus_records set source_version='changed' where id='fa000000-0000-4000-8000-000000000040';
 exception when sqlstate '55000' then immutable:=true; end;
 if not denied or not immutable then raise exception 'Corpus tenant validation or immutability failed'; end if;
end $test$;

set local role authenticated;
select set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000001',true);
do $test$
declare r jsonb;
begin
 if (select count(*) from public.compliance_corpus_records)<>1 then raise exception 'Raw cross-tenant data exposed'; end if;
 r:=public.compliance_corpus_status('2026-03-01');
 if r->>'model_training_permission'<>'prohibited'
   or r->>'anonymized_aggregation_permission'<>'prohibited'
   or (r->>'raw_cross_tenant_access')::boolean
   or (r->>'raw_customer_records_model_training_eligible')::boolean
 then raise exception 'Corpus default-deny policy failed: %',r; end if;
end $test$;
reset role;
do $test$ begin
 if has_function_privilege('anon','public.compliance_corpus_status(timestamptz)','EXECUTE')
 then raise exception 'Anonymous corpus status is enabled'; end if;
 if has_table_privilege('authenticated','public.compliance_corpus_records','INSERT,UPDATE,DELETE')
 then raise exception 'Clients can mutate corpus records'; end if;
 if has_table_privilege('authenticated','private.compliance_corpus_aggregate_cells','SELECT')
 then raise exception 'Clients can read cross-tenant aggregates'; end if;
end $test$;
rollback;
