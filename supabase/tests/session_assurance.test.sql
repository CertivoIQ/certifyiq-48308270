-- Rollback-only synthetic session/factor tests; never touches existing users.
begin;
insert into auth.users(id,email) values
 ('a2200000-0000-4000-8000-000000000001','mfa-session-test@example.invalid');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('a2200000-0000-4000-8000-000000000002','a2200000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a2200000-0000-4000-8000-000000000002","aal":"aal1"}',true);
select set_config('request.path','/portfolio_properties',true);
do $$ begin
 if not private.mfa_satisfied() then raise exception 'Non-enrolled user blocked'; end if;
 perform public.enforce_session_window();
end $$;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values
 ('a2200000-0000-4000-8000-000000000003','a2200000-0000-4000-8000-000000000001','totp','unverified',now(),now());
do $$ begin
 if not private.mfa_satisfied() then raise exception 'Abandoned enrollment blocks user'; end if;
end $$;
update auth.mfa_factors set status='verified' where id='a2200000-0000-4000-8000-000000000003';
set local role authenticated;
do $$ begin
 if private.mfa_satisfied() then raise exception 'Enrolled AAL1 user accepted'; end if;
 begin perform public.enforce_session_window(); raise exception 'REST MFA bypass';
 exception when sqlstate 'PT403' then null; end;
 perform set_config('request.path','/rpc/get_session_window',true);
 perform public.enforce_session_window();
 if (public.get_session_window()->>'mfa_satisfied')::boolean then raise exception 'Recovery inspection hides challenge'; end if;
 if not (public.get_session_window()->>'valid')::boolean then raise exception 'Recovery lifetime lost'; end if;
 perform set_config('request.path','/portfolio_properties',true);
 perform set_config('request.jwt.claims',jsonb_set(auth.jwt(),'{aal}','"aal2"')::text,true);
 if not private.mfa_satisfied() then raise exception 'AAL2 rejected'; end if;
 perform public.enforce_session_window();
end $$;
reset role;
update auth.sessions set created_at=now()-interval '8 days' where id='a2200000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
 begin perform public.enforce_session_window(); raise exception 'AAL2 extended expired session';
 exception when sqlstate 'PT401' then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
   and policyname='Authenticated storage requires current session assurance' and permissive='RESTRICTIVE'
   and qual like '%session_window%' and qual like '%mfa_satisfied%'
   and with_check like '%session_window%' and with_check like '%mfa_satisfied%') then
   raise exception 'Storage assurance must restrict reads and writes';
 end if;
 if has_function_privilege('anon','private.mfa_satisfied()','EXECUTE') then raise exception 'Anonymous helper exposed'; end if;
end $$;
rollback;
