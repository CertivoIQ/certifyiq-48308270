begin;
insert into auth.users(id,email) values
 ('c7000000-0000-4000-8000-000000000001','portfolio-owner@example.invalid'),
 ('c7000000-0000-4000-8000-000000000002','portfolio-other@example.invalid');
insert into public.certification_import_items(
 id,user_id,property_id,created_at,original_file_name,mime_type,size_bytes,status,program_codes
) values
 ('c7000000-0000-4000-8000-000000000010','c7000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000100','2026-03-01','a.pdf','application/pdf',10,'processed','{LIHTC}'),
 ('c7000000-0000-4000-8000-000000000011','c7000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000100','2026-03-02','b.pdf','application/pdf',10,'processed','{LIHTC}'),
 ('c7000000-0000-4000-8000-000000000012','c7000000-0000-4000-8000-000000000002','c7000000-0000-4000-8000-000000000200','2026-03-02','other.pdf','application/pdf',10,'processed','{HOME}');
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at,review_state
) values
 ('c7000000-0000-4000-8000-000000000020','c7000000-0000-4000-8000-000000000010','c7000000-0000-4000-8000-000000000001','portfolio-org','income','1','lihtc','1','open','critical','Income issue','[]','engine-1','2026-03-03','pending'),
 ('c7000000-0000-4000-8000-000000000021','c7000000-0000-4000-8000-000000000011','c7000000-0000-4000-8000-000000000001','portfolio-org','income','1','lihtc','1','resolved','major','Income issue','["doc"]','engine-1','2026-03-04','approved'),
 ('c7000000-0000-4000-8000-000000000022','c7000000-0000-4000-8000-000000000012','c7000000-0000-4000-8000-000000000002','other-org','other-rule','1','home','1','open','critical','Other tenant','[]','engine-1','2026-03-04','pending');
insert into public.certification_workflow_cases(id,certification_item_id)
values ('c7000000-0000-4000-8000-000000000030','c7000000-0000-4000-8000-000000000011');
insert into public.certification_workflow_events(case_id,finding_id,event_type,occurred_at)
values ('c7000000-0000-4000-8000-000000000030','c7000000-0000-4000-8000-000000000021','finding_resolved','2026-03-06');
insert into public.compliance_remediation_actions(id,finding_id,severity,status,remediation_plan,created_at)
values ('c7000000-0000-4000-8000-000000000040','c7000000-0000-4000-8000-000000000021','major','CLOSED','Correct','2026-03-05');

set local role authenticated;
select set_config('request.jwt.claim.sub','c7000000-0000-4000-8000-000000000001',true);
do $test$
declare r jsonb;
begin
 r:=public.portfolio_compliance_intelligence('2026-03-01','2026-03-31');
 if (r->'summary'->>'certifications')::int<>2
    or (r->'summary'->>'findings')::int<>2
    or (r->'summary'->>'findings_per_100_certifications')::numeric<>100
    or (r->'summary'->>'open_critical_findings')::int<>1
 then raise exception 'Portfolio summary failed or leaked tenant data: %',r; end if;
 if jsonb_array_length(r->'repeat_deficiency_patterns')<>1
    or r->'benchmarking'->>'status'<>'not_enabled'
    or r::text like '%other-rule%'
 then raise exception 'Patterns or confidentiality boundary failed: %',r; end if;
end
$test$;
reset role;
do $test$
begin
 if has_function_privilege('anon','public.portfolio_compliance_intelligence(date,date)','EXECUTE')
 then raise exception 'Anonymous portfolio analytics is enabled'; end if;
end
$test$;
rollback;
