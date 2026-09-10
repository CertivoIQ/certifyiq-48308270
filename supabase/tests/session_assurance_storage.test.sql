-- Isolated CI Storage fixture; production has additional ownership policies.
begin;
insert into auth.users(id,email) values ('a3300000-0000-4000-8000-000000000001','storage-mfa@example.invalid');
insert into auth.sessions values ('a3300000-0000-4000-8000-000000000002','a3300000-0000-4000-8000-000000000001',now(),now(),null);
insert into auth.mfa_factors values ('a3300000-0000-4000-8000-000000000003','a3300000-0000-4000-8000-000000000001','totp','verified',now(),now());
insert into storage.objects values ('a3300000-0000-4000-8000-000000000004','a3300000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','a3300000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a3300000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a3300000-0000-4000-8000-000000000002","aal":"aal1"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from storage.objects) <> 0 then raise exception 'AAL1 read bypassed Storage assurance'; end if;
 begin insert into storage.objects values(gen_random_uuid(),auth.uid()); raise exception 'AAL1 inserted object';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_set(auth.jwt(),'{aal}','"aal2"')::text,true);
 if (select count(*) from storage.objects) <> 1 then raise exception 'AAL2 owner read rejected'; end if;
 insert into storage.objects values(gen_random_uuid(),auth.uid());
 begin insert into storage.objects values(gen_random_uuid(),gen_random_uuid()); raise exception 'MFA bypassed owner isolation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.sessions set created_at=now()-interval '8 days' where id='a3300000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
 if (select count(*) from storage.objects) <> 0 then raise exception 'Expired session read Storage'; end if;
end $$;
reset role;
rollback;
