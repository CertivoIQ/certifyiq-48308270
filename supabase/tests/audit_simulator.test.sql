begin;
insert into auth.users(id,email) values
 ('a4800000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('a4800000-0000-4000-8000-000000000002','other@example.invalid');
insert into public.certification_import_items(
 id,user_id,created_at,original_file_name,mime_type,size_bytes,status,
 extracted_data,findings,program_codes
) values
 ('a4800000-0000-4000-8000-000000000010','a4800000-0000-4000-8000-000000000001',
  '2026-01-01','owner.pdf','application/pdf',100,'completed','{}','[]',array['LIHTC']),
 ('a4800000-0000-4000-8000-000000000011','a4800000-0000-4000-8000-000000000002',
  '2026-01-01','other.pdf','application/pdf',100,'completed','{}','[]',array['HOME']);
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at,review_state
) values
 ('a4800000-0000-4000-8000-000000000020','a4800000-0000-4000-8000-000000000010',
  'a4800000-0000-4000-8000-000000000001','org-owner','rule-1','1','LIHTC','1',
  'FAIL','critical','Owner confirmed finding','[]','engine','2026-01-01','pending'),
 ('a4800000-0000-4000-8000-000000000021','a4800000-0000-4000-8000-000000000011',
  'a4800000-0000-4000-8000-000000000002','org-other','rule-2','1','HOME','1',
  'FAIL','critical','Other tenant finding','[]','engine','2026-01-01','pending');
insert into public.compliance_remediation_actions(
 id,finding_id,severity,status,remediation_plan,due_at,created_at
) values (
 'a4800000-0000-4000-8000-000000000030','a4800000-0000-4000-8000-000000000020',
 'major','OPEN','Correct owner finding','2026-01-05','2026-01-01'
);
insert into public.pha_family_actions(
 id,user_id,program_code,action_type,due_date,workflow_status,
 verification_complete,current_rule_version_validated,reporting_path_validated
) values (
 'a4800000-0000-4000-8000-000000000040','a4800000-0000-4000-8000-000000000001',
 'HCV','annual_reexamination','2026-01-01','in_progress',false,false,false
);
insert into public.pha_public_housing_leases(
 id,workspace_user_id,lease_start,signature_complete,status
) values (
 'a4800000-0000-4000-8000-000000000050',
 'a4800000-0000-4000-8000-000000000001','2026-01-01',false,'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','a4800000-0000-4000-8000-000000000001',true);
do $$
declare r jsonb;
begin
 r:=public.run_audit_simulation('lihtc_monitoring','{}','{}','2026-01-10');
 if r->>'method' <> 'deterministic-supported-criteria-v1'
 then raise exception 'Simulation method is not explicit'; end if;
 if r->>'sampling_basis' not like 'All in-scope structured records%'
 then raise exception 'Sampling limitation is absent'; end if;
 if (r->'summary'->>'Confirmed Deficiency')::int <> 1
 then raise exception 'Confirmed deficiency mapping failed: %',r; end if;
 if (r->'summary'->>'Potential Exposure')::int <> 1
 then raise exception 'Potential exposure mapping failed: %',r; end if;
 if (r->'summary'->>'Missing Evidence')::int <> 1
 then raise exception 'Missing evidence mapping failed: %',r; end if;
 if r::text like '%Other tenant finding%'
 then raise exception 'Cross-tenant evidence entered report'; end if;
 if r->>'report_sha256' !~ '^[0-9a-f]{64}$'
 then raise exception 'Report integrity hash is invalid'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4800000-0000-4000-8000-000000000002',true);
do $$
declare r jsonb;
begin
 r:=public.run_audit_simulation('internal_qa_review','{}','{}','2026-01-10');
 if r::text like '%Owner confirmed finding%' or r::text like '%Correct owner finding%'
 then raise exception 'Owner data leaked into other tenant simulation'; end if;
 if (select count(*) from public.audit_simulation_reports) <> 1
 then raise exception 'RLS did not isolate preserved reports'; end if;
end $$;
reset role;

do $$ begin
 if has_function_privilege('anon','public.run_audit_simulation(text,text[],text[],date)','EXECUTE')
 then raise exception 'Anonymous simulation is enabled'; end if;
 if has_table_privilege('authenticated','public.audit_simulation_reports','INSERT')
    or has_table_privilege('authenticated','public.audit_simulation_reports','UPDATE')
    or has_table_privilege('authenticated','public.audit_simulation_reports','DELETE')
 then raise exception 'Authenticated callers can mutate simulation reports directly'; end if;
end $$;

do $$
declare report_id uuid;
begin
 select id into report_id from public.audit_simulation_reports limit 1;
 begin
   update public.audit_simulation_reports set as_of='2026-01-11' where id=report_id;
   raise exception 'Immutable report was updated';
 exception when sqlstate '55000' then null;
 end;
end $$;

rollback;
