begin;
insert into auth.users(id,email) values
 ('a4900000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('a4900000-0000-4000-8000-000000000002','other@example.invalid');
insert into public.certification_import_items(
 id,user_id,property_id,created_at,original_file_name,mime_type,size_bytes,status,extracted_data,findings
) values
 ('a4900000-0000-4000-8000-000000000010','a4900000-0000-4000-8000-000000000001',
  'a4900000-0000-4000-8000-000000000100','2026-01-01','owner.pdf','application/pdf',100,'completed','{}','[]'),
 ('a4900000-0000-4000-8000-000000000011','a4900000-0000-4000-8000-000000000002',
  'a4900000-0000-4000-8000-000000000101','2026-01-01','other.pdf','application/pdf',100,'completed','{}','[]');
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at
) values
 ('a4900000-0000-4000-8000-000000000020','a4900000-0000-4000-8000-000000000010',
  'a4900000-0000-4000-8000-000000000001','owner-org','rule-one','1','LIHTC','source-1',
  'FAIL','critical','Owner finding','[]','engine-1','2026-01-02'),
 ('a4900000-0000-4000-8000-000000000021','a4900000-0000-4000-8000-000000000011',
  'a4900000-0000-4000-8000-000000000002','other-org','rule-other','1','HOME','source-other',
  'FAIL','critical','Other finding','[]','engine-other','2026-01-02');
insert into public.certification_workflow_cases(id,certification_item_id)
 values('a4900000-0000-4000-8000-000000000030','a4900000-0000-4000-8000-000000000010');
insert into public.certification_workflow_events(case_id,finding_id,event_type,detail,occurred_at)
 values('a4900000-0000-4000-8000-000000000030','a4900000-0000-4000-8000-000000000020',
 'finding_resolved','{}','2026-01-10');
insert into public.portfolio_readiness_snapshots values
 ('a4900000-0000-4000-8000-000000000040','a4900000-0000-4000-8000-000000000001',
  'Owner portfolio',70,2,1,1,1,1,'{}','2026-01-05'),
 ('a4900000-0000-4000-8000-000000000041','a4900000-0000-4000-8000-000000000001',
  'Owner portfolio',90,2,2,0,0,0,'{}','2026-01-12');
insert into public.property_program_applicability values
 ('a4900000-0000-4000-8000-000000000050','a4900000-0000-4000-8000-000000000001',
  'property-owner','LIHTC','property',null,null,'2026-01-01',null,null,null,'2026-01-01','2026-01-01');
insert into public.compliance_graph_nodes(
 id,user_id,organization_id,node_kind,canonical_key,label,jurisdiction,program_code,
 source_version,rule_version,engine_version,effective_from,effective_to,attributes,recorded_at
) values
 ('a4900000-0000-4000-8000-000000000060','a4900000-0000-4000-8000-000000000001',
  'owner-org','rule','rule-one:1','Rule one v1','US','LIHTC','source-1','1','engine-1',
  '2026-01-01','2026-01-08','{}','2026-01-01'),
 ('a4900000-0000-4000-8000-000000000061','a4900000-0000-4000-8000-000000000001',
  'owner-org','rule','rule-one:2','Rule one v2','US','LIHTC','source-2','2','engine-2',
  '2026-01-09',null,'{}','2026-01-09');

set local role authenticated;
select set_config('request.jwt.claim.sub','a4900000-0000-4000-8000-000000000001',true);
do $$
declare early jsonb; late jsonb; compared jsonb;
begin
 early:=public.compliance_time_machine_state('2026-01-05 23:59:59+00');
 late:=public.compliance_time_machine_state('2026-01-12 23:59:59+00');
 compared:=public.compliance_time_machine('2026-01-12 23:59:59+00','2026-01-05 23:59:59+00');
 if (early->'counts'->>'open_findings')::int<>1 or (late->'counts'->>'open_findings')::int<>0
 then raise exception 'Historical finding reconstruction failed: % %',early,late; end if;
 if early->'readiness'->>'score'<>'70' or late->'readiness'->>'score'<>'90'
 then raise exception 'Stored readiness history failed'; end if;
 if early->'applicable_rules'->0->>'rule_version'<>'1' or late->'applicable_rules'->0->>'rule_version'<>'2'
 then raise exception 'Effective rule reconstruction failed'; end if;
 if (compared->'changes'->>'open_findings')::int<>-1
    or (compared->'changes'->>'readiness_score')::int<>20
 then raise exception 'Historical comparison failed: %',compared; end if;
 if early::text like '%Other finding%' then raise exception 'Cross-tenant history leaked'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.compliance_time_machine(timestamptz,timestamptz)','EXECUTE')
 then raise exception 'Anonymous Time Machine execution is enabled'; end if;
end $$;
rollback;
