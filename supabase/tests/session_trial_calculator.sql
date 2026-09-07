-- Run in a transaction and roll back; uses a non-staff trial account as a fixture.
begin;

do $test$
declare uid uuid; sid uuid := gen_random_uuid(); result jsonb;
begin
 select user_id into uid from public.account_access where status='trialing' and plan_id is null and not exists(select 1 from public.user_roles ur where ur.user_id=account_access.user_id and ur.role='staff') limit 1;
 if uid is null then raise exception 'No trial fixture available'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,uid,statement_timestamp()-interval '6 days',statement_timestamp());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','session_id',sid)::text,true);
 if not (public.get_session_window()->>'valid')::boolean then raise exception 'Six-day session rejected'; end if;
 delete from public.usage_counters where user_id=uid;
 result=public.income_calculator_access();
 if not (result->>'allowed')::boolean or (result->>'remaining')::integer is distinct from 3 then raise exception 'New trial access failed: %',result; end if;
 insert into public.usage_counters(user_id,period_start,environment,ai_docs_used) values(uid,'2026-08-01','sandbox',2);
 result=public.income_calculator_access();
 if not (result->>'allowed')::boolean or (result->>'remaining')::integer is distinct from 1 then raise exception 'Two-review access failed: %',result; end if;
 insert into public.usage_counters(user_id,period_start,environment,ai_docs_used) values(uid,'2026-09-01','live',1);
 result=public.income_calculator_access(); if (result->>'allowed')::boolean then raise exception 'Lifetime cap did not block third review: %, usage: %', result, (select jsonb_agg(jsonb_build_object('used',ai_docs_used,'env',environment,'period',period_start)) from public.usage_counters where user_id=uid); end if;
 update public.account_access set plan_id='multifamily_enterprise',status='active',access_until=statement_timestamp()+interval '30 days' where user_id=uid;
 if not (public.income_calculator_access()->>'allowed')::boolean then raise exception 'Paid upgrade did not restore access'; end if;
 update public.account_access set status='canceled',access_until=statement_timestamp()-interval '1 day' where user_id=uid;
 if (public.income_calculator_access()->>'allowed')::boolean then raise exception 'Expired subscription allowed'; end if;
 update auth.sessions set created_at=statement_timestamp()-interval '7 days' where id=sid;
 if (public.get_session_window()->>'valid')::boolean then raise exception 'Exact seven-day boundary not expired'; end if;
 begin
  perform public.enforce_session_window();
  raise exception 'REST request not rejected after seven days';
 exception when sqlstate 'PT401' then null;
 end;
 update auth.sessions set created_at=statement_timestamp()-interval '6 days', refreshed_at=statement_timestamp() where id=sid;
 if not (public.get_session_window()->>'valid')::boolean then raise exception 'Valid session refresh rejected'; end if;
 update auth.sessions set created_at=statement_timestamp()-interval '8 days' where id=sid;
 if (public.get_session_window()->>'valid')::boolean then raise exception 'Token refresh extended original login'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','session_id',sid)::text,true);
 if (public.get_session_window()->>'valid')::boolean then raise exception 'Another user session accepted'; end if;
 if not has_function_privilege('authenticated','private.session_window()','execute') then raise exception 'Authenticated session window execution is required'; end if;
 if has_function_privilege('anon','private.session_window()','execute') then raise exception 'Anonymous session window execution exposed'; end if;
 if has_function_privilege('anon','public.income_calculator_access()','execute') then raise exception 'Anonymous calculator access exposed'; end if;
end $test$;

rollback;
