begin;
insert into auth.users(id,email) values
 ('e9000000-0000-4000-8000-000000000001','enterprise-owner@example.invalid'),
 ('e9000000-0000-4000-8000-000000000002','plan-member@example.invalid'),
 ('e9000000-0000-4000-8000-000000000003','other@example.invalid');
insert into public.enterprise_licenses(id,organization_id,product_code,status,all_features,license_kind,activated_at,created_at) values
 ('e9000000-0000-4000-8000-000000000010','e9000000-0000-4000-8000-000000000100','certivoiq_enterprise','active',true,'multifamily_enterprise','2026-01-01','2026-01-01'),
 ('e9000000-0000-4000-8000-000000000011','e9000000-0000-4000-8000-000000000101','future_enterprise','active',false,'future_enterprise','2026-01-01','2026-01-01');
insert into public.enterprise_license_members(license_id,user_id,role,created_at) values
 ('e9000000-0000-4000-8000-000000000010','e9000000-0000-4000-8000-000000000001','admin','2026-01-01'),
 ('e9000000-0000-4000-8000-000000000011','e9000000-0000-4000-8000-000000000002','member','2026-01-01');
insert into public.enterprise_plan_capabilities(
 plan_key,capability_key,access_level,governance_status,effective_from,approved_by,approval_reference
) values ('future_enterprise','compliance_intelligence','read','approved','2026-01-01','e9000000-0000-4000-8000-000000000001','product-approval-17');

set local role authenticated;
select set_config('request.jwt.claim.sub','e9000000-0000-4000-8000-000000000001',true);
do $test$
declare r jsonb;
begin
 r:=public.enterprise_capability_matrix('2026-02-01');
 if jsonb_array_length(r->'capabilities')<>6
   or exists(select 1 from jsonb_array_elements(r->'capabilities') c where c->>'access_level'<>'execute')
   or r->>'pricing_logic'<>'none' or (r->>'automatic_package_activation')::boolean
 then raise exception 'Existing all-features enterprise boundary failed: %',r; end if;
end $test$;
select set_config('request.jwt.claim.sub','e9000000-0000-4000-8000-000000000002',true);
do $test$
declare r jsonb;
begin
 r:=public.enterprise_capability_matrix('2026-02-01');
 if (select count(*) from jsonb_array_elements(r->'capabilities') c where c->>'access_level'='read')<>1
   or (select count(*) from jsonb_array_elements(r->'capabilities') c where c->>'access_level'='disabled')<>5
 then raise exception 'Approved plan boundary failed: %',r; end if;
end $test$;
select set_config('request.jwt.claim.sub','e9000000-0000-4000-8000-000000000003',true);
do $test$
declare r jsonb;
begin
 r:=public.enterprise_capability_matrix('2026-02-01');
 if exists(select 1 from jsonb_array_elements(r->'capabilities') c where c->>'access_level'<>'disabled')
 then raise exception 'Unlicensed user received enterprise access: %',r; end if;
end $test$;
reset role;
do $test$ begin
 if has_function_privilege('anon','public.enterprise_capability_matrix(timestamptz)','EXECUTE')
 then raise exception 'Anonymous capability lookup is enabled'; end if;
 if has_table_privilege('authenticated','public.enterprise_plan_capabilities','INSERT,UPDATE,DELETE')
 then raise exception 'Clients can mutate plan capabilities'; end if;
end $test$;
rollback;
