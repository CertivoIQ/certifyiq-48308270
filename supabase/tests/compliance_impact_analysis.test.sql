begin;
insert into auth.users(id,email) values
 ('a5000000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('a5000000-0000-4000-8000-000000000002','other@example.invalid');
insert into public.compliance_graph_nodes(
 id,user_id,organization_id,node_kind,canonical_key,label,source_version,effective_from,attributes,recorded_at
) values
 ('a5000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-000000000001','owner-org','source','source:v2','Validated source v2','2','2026-01-01','{"validation_status":"validated"}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000011','a5000000-0000-4000-8000-000000000001','owner-org','property','property:1','Owner property',null,'2026-01-01','{}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000012','a5000000-0000-4000-8000-000000000001','owner-org','unit','unit:1','Owner unit',null,'2026-01-01','{}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000013','a5000000-0000-4000-8000-000000000001','owner-org','workflow','workflow:1','Owner workflow',null,'2026-01-01','{}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000014','a5000000-0000-4000-8000-000000000001','owner-org','source','source:draft','Draft source',null,'2026-01-01','{"validation_status":"draft"}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000020','a5000000-0000-4000-8000-000000000002','other-org','property','property:other','Other property',null,'2026-01-01','{}','2026-01-01');
insert into public.compliance_graph_edges(
 id,user_id,organization_id,from_node_id,to_node_id,relationship_type,effective_from,attributes,recorded_at
) values
 ('a5000000-0000-4000-8000-000000000030','a5000000-0000-4000-8000-000000000001','owner-org','a5000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-000000000011','impacts','2026-01-01','{}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000031','a5000000-0000-4000-8000-000000000001','owner-org','a5000000-0000-4000-8000-000000000011','a5000000-0000-4000-8000-000000000012','contains','2026-01-01','{}','2026-01-01'),
 ('a5000000-0000-4000-8000-000000000032','a5000000-0000-4000-8000-000000000001','owner-org','a5000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-000000000013','impacts','2026-01-01','{}','2026-01-01');

set local role authenticated;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000001',true);
do $$
declare r jsonb; denied boolean:=false;
begin
 r:=public.calculate_compliance_impact('a5000000-0000-4000-8000-000000000010','2026-01-10');
 if (r->'impacted_counts'->>'properties')::int<>1
    or (r->'impacted_counts'->>'units')::int<>1
    or (r->'impacted_counts'->>'workflows')::int<>1
 then raise exception 'Impact counts are incorrect: %',r; end if;
 if jsonb_array_length(r->'drill_down')<>3 or r::text like '%Other property%'
 then raise exception 'Impact drill-down or tenant isolation failed'; end if;
 if (r->>'automatic_activation')::boolean or not (r->>'requires_authorized_review')::boolean
 then raise exception 'Governance boundary failed'; end if;
 begin
   perform public.calculate_compliance_impact('a5000000-0000-4000-8000-000000000014','2026-01-10');
 exception when sqlstate '55000' then denied:=true;
 end;
 if not denied then raise exception 'Draft regulatory source was analyzed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.calculate_compliance_impact(uuid,date)','EXECUTE')
 then raise exception 'Anonymous impact analysis is enabled'; end if;
 if has_table_privilege('authenticated','public.compliance_impact_analyses','INSERT,UPDATE,DELETE')
 then raise exception 'Authenticated callers can mutate impact analyses'; end if;
end $$;
rollback;
