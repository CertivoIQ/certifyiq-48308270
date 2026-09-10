-- Rollback-only checks; uses synthetic identities and no real recovery secrets.
begin;
insert into auth.users (id, email) values
 ('a1100000-0000-4000-8000-000000000001', 'mfa-owner@example.invalid'),
 ('a1100000-0000-4000-8000-000000000002', 'mfa-other@example.invalid');
insert into public.user_recovery_codes (user_id, code_hash) values
 ('a1100000-0000-4000-8000-000000000001', repeat('a',64)),
 ('a1100000-0000-4000-8000-000000000002', repeat('b',64));
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
do $$
begin
 if (select count(*) from public.user_recovery_codes) <> 1 then
   raise exception 'Owner read or cross-tenant isolation failed';
 end if;
 begin
   insert into public.user_recovery_codes (user_id,code_hash) values (auth.uid(),repeat('c',64));
   raise exception 'Client planted a recovery credential';
 exception when insufficient_privilege then null; end;
 begin
   update public.user_recovery_codes set used_at = null where user_id=auth.uid();
   raise exception 'Client reset recovery consumption';
 exception when insufficient_privilege then null; end;
 begin
   delete from public.user_recovery_codes where user_id=auth.uid();
   raise exception 'Client deleted server-managed credentials';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
begin
 if not has_table_privilege('service_role','public.user_recovery_codes','INSERT,UPDATE,DELETE') then
   raise exception 'Recovery service lost write access';
 end if;
 if has_table_privilege('anon','public.user_recovery_codes','INSERT') then
   raise exception 'Anonymous recovery writes remain enabled';
 end if;
end $$;
rollback;
