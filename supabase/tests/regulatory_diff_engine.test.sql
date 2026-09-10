begin;
insert into auth.users(id,email) values
 ('b6000000-0000-4000-8000-000000000001','diff-owner@example.invalid'),
 ('b6000000-0000-4000-8000-000000000002','diff-other@example.invalid');
insert into public.compliance_graph_nodes(
 id,user_id,organization_id,node_kind,canonical_key,label,source_version,
 effective_from,supersedes_node_id,attributes,recorded_at
) values
 ('b6000000-0000-4000-8000-000000000010','b6000000-0000-4000-8000-000000000001','diff-org','source','notice:42:v1','Notice 42 v1','1','2025-01-01',null,
  '{"validation_status":"validated","source_family":"notice:42","source_text":"Old eligibility text","requirements":["income-limit","signature"],"impacted_rule_mappings":["eligibility"]}','2025-01-01'),
 ('b6000000-0000-4000-8000-000000000011','b6000000-0000-4000-8000-000000000001','diff-org','source','notice:42:v2','Notice 42 v2','2','2026-01-01','b6000000-0000-4000-8000-000000000010',
  '{"validation_status":"approved","source_family":"notice:42","source_text":"New eligibility and verification text","requirements":["income-limit","verification"],"impacted_rule_mappings":["eligibility","verification"]}','2026-01-01'),
 ('b6000000-0000-4000-8000-000000000012','b6000000-0000-4000-8000-000000000001','diff-org','property','property:diff','Diff property',null,'2025-01-01',null,'{}','2025-01-01'),
 ('b6000000-0000-4000-8000-000000000013','b6000000-0000-4000-8000-000000000002','other-org','source','notice:42:v3','Other tenant source','3','2026-01-01',null,
  '{"validation_status":"validated","source_family":"notice:42","source_text":"Other","requirements":[]}','2026-01-01');
insert into public.compliance_graph_edges(
 id,user_id,organization_id,from_node_id,to_node_id,relationship_type,effective_from,attributes,recorded_at
) values
 ('b6000000-0000-4000-8000-000000000020','b6000000-0000-4000-8000-000000000001','diff-org',
  'b6000000-0000-4000-8000-000000000011','b6000000-0000-4000-8000-000000000012','impacts','2026-01-01','{}','2026-01-01');

set local role authenticated;
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000001',true);
do $test$
declare r jsonb; denied boolean:=false;
begin
 r:=public.compare_regulatory_source_versions(
   'b6000000-0000-4000-8000-000000000010',
   'b6000000-0000-4000-8000-000000000011','2026-02-01');
 if not (r->'changes'->>'substantive_text_changed')::boolean
    or not (r->'changes'->>'effective_date_changed')::boolean
    or not (r->'changes'->>'supersession_declared')::boolean
 then raise exception 'Core regulatory diff failed: %',r; end if;
 if r->'changes'->'requirements_added'<>'["verification"]'::jsonb
    or r->'changes'->'requirements_removed'<>'["signature"]'::jsonb
 then raise exception 'Requirement diff failed: %',r; end if;
 if (r->'impacted_counts'->>'properties')::int<>1
    or (r->>'automatic_activation')::boolean
    or r->>'diff_status'<>'awaiting_authorized_review'
 then raise exception 'Impact or governance failed: %',r; end if;
 begin
   perform public.compare_regulatory_source_versions(
     'b6000000-0000-4000-8000-000000000010',
     'b6000000-0000-4000-8000-000000000013','2026-02-01');
 exception when sqlstate '42501' then denied:=true;
 end;
 if not denied then raise exception 'Cross-tenant comparison was permitted'; end if;
end
$test$;
reset role;
do $test$
begin
 if has_function_privilege('anon','public.compare_regulatory_source_versions(uuid,uuid,date)','EXECUTE')
 then raise exception 'Anonymous regulatory comparison is enabled'; end if;
 if has_table_privilege('authenticated','public.regulatory_diff_reports','INSERT,UPDATE,DELETE')
 then raise exception 'Authenticated callers can mutate diff reports'; end if;
end
$test$;
rollback;
