begin;
insert into auth.users(id,email) values
 ('a4500000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('a4500000-0000-4000-8000-000000000002','other@example.invalid');
insert into public.certification_import_items(
 id,user_id,property_id,created_at,processed_at,original_file_name,mime_type,size_bytes,
 status,sha256,extracted_data,findings,confidence,extraction_provider
) values (
 'a4500000-0000-4000-8000-000000000010','a4500000-0000-4000-8000-000000000001',
 'a4500000-0000-4000-8000-000000000020','2026-01-01T00:00:00Z','2026-01-02T00:00:00Z',
 'certification.pdf','application/pdf',1200,'completed',repeat('a',64),
 '{"annual_income":42000}'::jsonb,'[]'::jsonb,0.99,'deterministic-v3'
);
insert into public.certification_document_instances(
 id,certification_item_id,user_id,organization_id,detected_form_code,detected_revision,
 recognition_status,confidence,document_sha256,review_status,created_at,source_page
) values (
 'a4500000-0000-4000-8000-000000000030','a4500000-0000-4000-8000-000000000010',
 'a4500000-0000-4000-8000-000000000001','org-owner','HUD-50059','2025-06',
 'recognized',0.98,repeat('b',64),'verified','2026-01-03T00:00:00Z',1
);
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at
) values (
 'a4500000-0000-4000-8000-000000000040','a4500000-0000-4000-8000-000000000010',
 'a4500000-0000-4000-8000-000000000001','org-owner','income-limit','2026.1',
 'hud-mfh','2026.1','FAIL','major','Income exceeds limit','[{"page":1}]','engine-7',
 '2026-01-04T00:00:00Z'
);
insert into public.certification_workflow_cases(id,certification_item_id) values
 ('a4500000-0000-4000-8000-000000000050','a4500000-0000-4000-8000-000000000010');
insert into public.certification_workflow_events(case_id,finding_id,actor_id,event_type,detail,occurred_at)
values ('a4500000-0000-4000-8000-000000000050','a4500000-0000-4000-8000-000000000040',
 'a4500000-0000-4000-8000-000000000001','manager_final_approved','{"basis":"reviewed"}',
 '2026-01-05T00:00:00Z');
insert into public.finding_reviews(
 id,finding_id,user_id,reviewer_id,decision,reason,created_at,manifest_sha256
) values (
 'a4500000-0000-4000-8000-000000000060','a4500000-0000-4000-8000-000000000040',
 'a4500000-0000-4000-8000-000000000001','a4500000-0000-4000-8000-000000000001',
 'approved','verified correction','2026-01-06T00:00:00Z',repeat('c',64)
);
insert into public.evidence_manifests(
 id,review_id,user_id,organization_id,property_id,certification_id,outcome,engine_build,
 manifest,manifest_sha256,created_at
) values (
 'a4500000-0000-4000-8000-000000000070','review-1',
 'a4500000-0000-4000-8000-000000000001','org-owner',
 'a4500000-0000-4000-8000-000000000020','a4500000-0000-4000-8000-000000000010',
 'APPROVED','engine-7','{"rule_version":"2026.1","source_version":"hud-2026",
 "calculation_inputs":{"annual_income":42000}}',repeat('d',64),'2026-01-07T00:00:00Z'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','a4500000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.audit_replay_timeline(
   'a4500000-0000-4000-8000-000000000010','2026-12-31')) <> 9
 then raise exception 'Complete replay timeline was not reconstructed'; end if;
 if (select count(*) from public.audit_replay_timeline(
   'a4500000-0000-4000-8000-000000000010','2026-01-04T00:00:00Z')) <> 6
 then raise exception 'As-of replay leaked future events'; end if;
 if not exists (
   select 1 from public.audit_replay_events where event_type='finding_created'
   and rule_version='2026.1' and source_version='2026.1'
   and engine_version='engine-7' and calculation_inputs ? 'annual_income'
 ) then raise exception 'Finding version snapshot is incomplete'; end if;
 if not exists (
   select 1 from public.audit_replay_events where event_type='evidence_record_finalized'
   and evidence_manifest_id='a4500000-0000-4000-8000-000000000070'
   and source_version='hud-2026'
 ) then raise exception 'Existing Evidence Record was not linked'; end if;
 if has_table_privilege('authenticated','public.audit_replay_events','INSERT')
   or has_table_privilege('authenticated','public.audit_replay_events','UPDATE')
   or has_table_privilege('authenticated','public.audit_replay_events','DELETE')
 then raise exception 'Replay history is writable by clients'; end if;
 if has_function_privilege('anon','public.audit_replay_timeline(uuid,timestamptz)','EXECUTE')
 then raise exception 'Anonymous replay execution is enabled'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4500000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists (select 1 from public.audit_replay_events)
 then raise exception 'Cross-tenant replay visibility'; end if;
end $$;
reset role;

set local role service_role;
do $$ begin
 begin
   update public.audit_replay_events set event_snapshot='{}';
   raise exception 'Replay history was mutable';
 exception when raise_exception then
   if sqlerrm <> 'Audit Replay history is immutable.' then raise; end if;
 end;
end $$;
reset role;
rollback;
