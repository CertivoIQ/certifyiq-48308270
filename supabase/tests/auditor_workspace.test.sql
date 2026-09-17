begin;
insert into auth.users(id,email) values
 ('a4600000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('a4600000-0000-4000-8000-000000000002','auditor@example.invalid'),
 ('a4600000-0000-4000-8000-000000000003','other@example.invalid'),
 ('a4600000-0000-4000-8000-000000000004','auditor2@example.invalid'),
 ('a4600000-0000-4000-8000-000000000005','auditor3@example.invalid');

insert into public.enterprise_licenses(id,organization_id,license_kind,status,paid_through) values
 ('a4600000-0000-4000-8000-000000000090','a4600000-0000-4000-8000-000000000091',
  'multifamily_enterprise','active',now()+interval '30 days');
insert into public.enterprise_license_members(license_id,user_id,role) values
 ('a4600000-0000-4000-8000-000000000090','a4600000-0000-4000-8000-000000000001','admin');
insert into public.portfolio_properties(id,user_id,name) values
 ('a4600000-0000-4000-8000-000000000010','a4600000-0000-4000-8000-000000000001','Owner Property'),
 ('a4600000-0000-4000-8000-000000000011','a4600000-0000-4000-8000-000000000003','Other Property');
insert into public.certification_import_items(
 id,user_id,property_id,created_at,original_file_name,mime_type,size_bytes,status,
 sha256,extracted_data,findings,program_codes
) values
 ('a4600000-0000-4000-8000-000000000020','a4600000-0000-4000-8000-000000000001',
  'a4600000-0000-4000-8000-000000000010','2026-01-10','owner.pdf','application/pdf',100,
  'completed',repeat('a',64),'{}','[]',array['LIHTC']),
 ('a4600000-0000-4000-8000-000000000021','a4600000-0000-4000-8000-000000000003',
  'a4600000-0000-4000-8000-000000000011','2026-01-10','other.pdf','application/pdf',100,
  'completed',repeat('b',64),'{}','[]',array['LIHTC']);
insert into public.certification_workflow_cases(
 id,certification_item_id,status,approved_on,audit_filed_at
) values
 ('a4600000-0000-4000-8000-000000000030','a4600000-0000-4000-8000-000000000020',
  'approved_filed','2026-01-11','2026-01-11'),
 ('a4600000-0000-4000-8000-000000000031','a4600000-0000-4000-8000-000000000021',
  'approved_filed','2026-01-11','2026-01-11');
insert into public.compliance_findings(
 id,item_id,user_id,organization_id,rule_id,rule_version,rule_pack_id,rule_pack_version,
 status,severity,explanation,evidence_refs,engine_build,created_at,jurisdiction,review_state
) values
 ('a4600000-0000-4000-8000-000000000040','a4600000-0000-4000-8000-000000000020',
  'a4600000-0000-4000-8000-000000000001','org-owner','rule-owner','1','pack','1',
  'resolved','major','Owner finding','[]','engine','2026-01-10','FEDERAL','approved'),
 ('a4600000-0000-4000-8000-000000000041','a4600000-0000-4000-8000-000000000021',
  'a4600000-0000-4000-8000-000000000003','org-other','rule-other','1','pack','1',
  'resolved','major','Other finding','[]','engine','2026-01-10','FEDERAL','approved');
insert into public.evidence_manifests(
 id,review_id,user_id,organization_id,property_id,certification_id,outcome,
 engine_build,manifest,manifest_sha256,created_at
) values
 ('a4600000-0000-4000-8000-000000000050','owner-review',
  'a4600000-0000-4000-8000-000000000001','org-owner',
  'a4600000-0000-4000-8000-000000000010','a4600000-0000-4000-8000-000000000020',
  'APPROVED','engine','{}',repeat('c',64),'2026-01-11'),
 ('a4600000-0000-4000-8000-000000000051','other-review',
  'a4600000-0000-4000-8000-000000000003','org-other',
  'a4600000-0000-4000-8000-000000000011','a4600000-0000-4000-8000-000000000021',
  'APPROVED','engine','{}',repeat('d',64),'2026-01-11');
insert into public.compliance_remediation_actions(
 id,finding_id,finding_ref,citation,severity,status,remediation_plan,created_at
) values
 ('a4600000-0000-4000-8000-000000000060','a4600000-0000-4000-8000-000000000040',
  'owner-finding','24 CFR 5.609','major','closed','Correct and verify','2026-01-10'),
 ('a4600000-0000-4000-8000-000000000061','a4600000-0000-4000-8000-000000000041',
  'other-finding','Other citation','major','closed','Other plan','2026-01-10');

set local role authenticated;
select set_config('request.jwt.claim.sub','a4600000-0000-4000-8000-000000000001',true);
select public.create_auditor_access_grant(
 'a4600000-0000-4000-8000-000000000001','org-owner',
 'a4600000-0000-4000-8000-000000000002','property',null,
 array['a4600000-0000-4000-8000-000000000010'],array['LIHTC'],
 '2026-01-01','2026-01-31',now()+interval '7 days'
) as grant_id \gset
select set_config('test.grant_id', :'grant_id', true);

do $
declare ids uuid[];
begin
 ids:=public.create_auditor_access_grants(
   'a4600000-0000-4000-8000-000000000001','ignored-client-org',
   array[
     'a4600000-0000-4000-8000-000000000004'::uuid,
     'a4600000-0000-4000-8000-000000000005'::uuid
   ],
   'property',null,array['a4600000-0000-4000-8000-000000000010'],array['LIHTC'],
   '2026-01-01','2026-01-31',now()+interval '7 days'
 );
 if cardinality(ids) <> 2 then raise exception 'Bulk auditor grant count failed'; end if;
 if (select count(*) from public.auditor_access_grants
     where owner_user_id='a4600000-0000-4000-8000-000000000001') <> 3
 then raise exception 'Multiple authorized auditors were capped'; end if;
 if exists(
   select 1 from public.auditor_access_grants
   where owner_user_id='a4600000-0000-4000-8000-000000000001'
     and organization_id <> 'a4600000-0000-4000-8000-000000000091'
 ) then raise exception 'Auditor grant organization was not bound to paid enterprise license'; end if;
end $;

do $ begin
 if has_table_privilege('authenticated','public.auditor_access_grants','INSERT')
   or has_table_privilege('authenticated','public.auditor_access_events','UPDATE')
 then raise exception 'Auditor tables are directly writable'; end if;
 if has_function_privilege('anon','public.auditor_workspace_snapshot(uuid)','EXECUTE')
 then raise exception 'Anonymous auditor workspace execution'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4600000-0000-4000-8000-000000000002',true);
do $$
declare s jsonb;
begin
 s:=public.auditor_workspace_snapshot(current_setting('test.grant_id')::uuid);
 if jsonb_array_length(s->'approved_certifications') <> 1
   or s->'approved_certifications'->0->>'file_name' <> 'owner.pdf'
 then raise exception 'Approved certification scope failed'; end if;
 if jsonb_array_length(s->'evidence_records') <> 1
   or jsonb_array_length(s->'findings') <> 1
   or jsonb_array_length(s->'remediation') <> 1
   or jsonb_array_length(s->'regulatory_citations') <> 1
 then raise exception 'Auditor snapshot selection failed'; end if;
 if s::text like '%other.pdf%' or s::text like '%rule-other%'
 then raise exception 'Cross-customer auditor visibility'; end if;
 if s->'grant'->>'read_only' <> 'true'
 then raise exception 'Workspace is not marked read-only'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4600000-0000-4000-8000-000000000003',true);
do $ begin
 begin
   perform public.create_auditor_access_grant(
     'a4600000-0000-4000-8000-000000000003','org-other',
     'a4600000-0000-4000-8000-000000000004','property',null,
     array['a4600000-0000-4000-8000-000000000011'],array['LIHTC'],
     '2026-01-01','2026-01-31',now()+interval '7 days'
   );
   raise exception 'Unpaid account created auditor access';
 exception when raise_exception then
   if sqlerrm <> 'An active paid Multifamily Enterprise license administrator is required' then raise; end if;
 end;
 begin
   perform public.auditor_workspace_snapshot(current_setting('test.grant_id')::uuid);
   raise exception 'Unscoped account opened auditor workspace';
 exception when raise_exception then
   if sqlerrm <> 'auditor grant does not authorize this account' then raise; end if;
 end;
 if exists(select 1 from public.auditor_access_grants)
 then raise exception 'Unauthorized grant visibility'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4600000-0000-4000-8000-000000000001',true);
select public.revoke_auditor_access_grant(:'grant_id');
do $$ begin
 if (select count(*) from public.auditor_access_events where grant_id=current_setting('test.grant_id')::uuid) <> 3
 then raise exception 'Grant access log is incomplete'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a4600000-0000-4000-8000-000000000002',true);
do $$ begin
 begin
   perform public.auditor_workspace_snapshot(current_setting('test.grant_id')::uuid);
   raise exception 'Revoked auditor access remained usable';
 exception when raise_exception then
   if sqlerrm <> 'auditor grant revoked' then raise; end if;
 end;
end $$;
reset role;

set local role service_role;
do $$ begin
 begin
   delete from public.auditor_access_events where grant_id=current_setting('test.grant_id')::uuid;
   raise exception 'Auditor access log was mutable';
 exception when raise_exception then
   if sqlerrm <> 'Auditor access history is immutable.' then raise; end if;
 end;
end $$;
reset role;
rollback;
