begin;
insert into auth.users(id,email) values
 ('a4700000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('a4700000-0000-4000-8000-000000000002','other@example.invalid');
insert into public.certification_import_items(
 id,user_id,created_at,original_file_name,mime_type,size_bytes,status,
 extracted_data,findings,program_codes
) values
 ('a4700000-0000-4000-8000-000000000010','a4700000-0000-4000-8000-000000000001',
  '2026-01-01','owner.pdf','application/pdf',100,'completed','{}','[]',array['LIHTC']),
 ('a4700000-0000-4000-8000-000000000011','a4700000-0000-4000-8000-000000000002',
  '2026-01-01','other.pdf','application/pdf',100,'completed','{}','[]',array['HOME']);
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at,review_state
) values
 ('a4700000-0000-4000-8000-000000000020','a4700000-0000-4000-8000-000000000010',
  'a4700000-0000-4000-8000-000000000001','org-owner','rule-1','1','LIHTC','1',
  'FAIL','critical','Critical owner finding','[]','engine','2026-01-01','pending'),
 ('a4700000-0000-4000-8000-000000000021','a4700000-0000-4000-8000-000000000011',
  'a4700000-0000-4000-8000-000000000002','org-other','rule-2','1','HOME','1',
  'FAIL','critical','Other finding','[]','engine','2026-01-01','pending');
insert into public.compliance_remediation_actions(
 id,finding_id,severity,status,remediation_plan,due_at,created_at
) values (
 'a4700000-0000-4000-8000-000000000030','a4700000-0000-4000-8000-000000000020',
 'major','OPEN','Correct owner finding','2026-01-05','2026-01-01'
);
insert into public.pha_family_actions(
 id,user_id,program_code,action_type,due_date,workflow_status,
 verification_complete,current_rule_version_validated,reporting_path_validated
) values
 ('a4700000-0000-4000-8000-000000000040','a4700000-0000-4000-8000-000000000001',
  'HCV','annual_reexamination','2026-01-01','in_progress',false,false,false),
 ('a4700000-0000-4000-8000-000000000041','a4700000-0000-4000-8000-000000000001',
  'HCV','interim','2026-01-20','in_progress',true,true,true);
insert into public.pha_public_housing_leases(
 id,workspace_user_id,lease_start,signature_complete,status
) values (
 'a4700000-0000-4000-8000-000000000050',
 'a4700000-0000-4000-8000-000000000001','2026-01-01',false,'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','a4700000-0000-4000-8000-000000000001',true);
do $$
declare s jsonb;
begin
 s:=public.audit_readiness_score('2026-01-10');
 if (s->>'score')::int <> 34 or (s->>'total_deduction')::int <> 66
 then raise exception 'Deterministic score is incorrect: %',s; end if;
 if jsonb_array_length(s->'deductions') <> 8
 then raise exception 'Concrete deduction inventory is incomplete'; end if;
 if jsonb_array_length(s->'get_me_to_100') <> 8
 then raise exception 'Get me to 100 queue is incomplete'; end if;
 if s::text like '%Other finding%'
 then raise exception 'Cross-tenant data entered readiness score'; end if;
 if s->>'method' <> 'deterministic-v1'
 then raise exception 'Readiness method is not explicit'; end if;
 if not exists (
   select 1 from jsonb_array_elements(s->'deductions') d
   where d->>'deduction_code'='stale_rule_pack_coverage'
     and d ? 'entity_id' and d ? 'remediation'
 ) then raise exception 'Deduction drill-down is incomplete'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4700000-0000-4000-8000-000000000002',true);
do $$
declare s jsonb;
begin
 s:=public.audit_readiness_score('2026-01-10');
 if (s->>'score')::int <> 85 or jsonb_array_length(s->'deductions') <> 1
 then raise exception 'Tenant-specific readiness score failed'; end if;
end $$;
reset role;

do $$ begin
 if has_function_privilege('anon','public.audit_readiness_score(date)','EXECUTE')
 then raise exception 'Anonymous readiness scoring is enabled'; end if;
end $$;
rollback;
