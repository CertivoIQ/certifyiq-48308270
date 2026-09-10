begin;
insert into auth.users(id,email) values
 ('d8000000-0000-4000-8000-000000000001','control-owner@example.invalid'),
 ('d8000000-0000-4000-8000-000000000002','control-other@example.invalid');
insert into public.portfolio_properties(id,user_id,name) values
 ('d8000000-0000-4000-8000-000000000010','d8000000-0000-4000-8000-000000000001','At-risk property'),
 ('d8000000-0000-4000-8000-000000000011','d8000000-0000-4000-8000-000000000002','Other property');
insert into public.portfolio_units(id,user_id,property_id,unit_number) values
 ('d8000000-0000-4000-8000-000000000020','d8000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000010','101'),
 ('d8000000-0000-4000-8000-000000000021','d8000000-0000-4000-8000-000000000002','d8000000-0000-4000-8000-000000000011','999');
insert into public.certification_import_items(
 id,user_id,property_id,created_at,original_file_name,mime_type,size_bytes,status,program_codes
) values
 ('d8000000-0000-4000-8000-000000000030','d8000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000010','2026-04-01','open.pdf','application/pdf',10,'reviewing','{LIHTC}'),
 ('d8000000-0000-4000-8000-000000000031','d8000000-0000-4000-8000-000000000002','d8000000-0000-4000-8000-000000000011','2026-04-01','other.pdf','application/pdf',10,'reviewing','{HOME}');
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at,review_state
) values
 ('d8000000-0000-4000-8000-000000000040','d8000000-0000-4000-8000-000000000030','d8000000-0000-4000-8000-000000000001','control-org','signature','1','lihtc','1','open','critical','Signature missing','[]','engine-1','2026-04-01','pending'),
 ('d8000000-0000-4000-8000-000000000041','d8000000-0000-4000-8000-000000000031','d8000000-0000-4000-8000-000000000002','other-org','other','1','home','1','open','critical','Other tenant','[]','engine-1','2026-04-01','pending');
insert into public.compliance_remediation_actions(id,finding_id,severity,status,remediation_plan,due_at,created_at)
values ('d8000000-0000-4000-8000-000000000050','d8000000-0000-4000-8000-000000000040','critical','OPEN','Obtain signature','2026-04-03','2026-04-01');
insert into public.regulatory_diff_reports(id,user_id,current_source_node_id,diff_status,compared_at)
values ('d8000000-0000-4000-8000-000000000060','d8000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000061','awaiting_authorized_review','2026-04-01');

set local role authenticated;
select set_config('request.jwt.claim.sub','d8000000-0000-4000-8000-000000000001',true);
do $test$
declare r jsonb;
begin
 r:=public.compliance_control_center('2026-04-02',80);
 if (r->'summary'->>'portfolio_size')::int<>1
    or (r->'summary'->>'units')::int<>1
    or (r->'summary'->>'certifications_in_progress')::int<>1
    or (r->'summary'->>'critical_findings')::int<>1
    or (r->'summary'->>'regulatory_changes_requiring_attention')::int<>1
    or (r->'summary'->>'remediation_approaching_sla')::int<>1
 then raise exception 'Control Center summary failed or leaked tenant data: %',r; end if;
 if jsonb_array_length(r->'needs_attention_today')<3
    or r::text like '%Other tenant%' or r::text like '%Other property%'
 then raise exception 'Attention queue failed or leaked tenant data: %',r; end if;
end
$test$;
reset role;
do $test$
begin
 if has_function_privilege('anon','public.compliance_control_center(date,integer)','EXECUTE')
 then raise exception 'Anonymous Control Center access is enabled'; end if;
end
$test$;
rollback;
