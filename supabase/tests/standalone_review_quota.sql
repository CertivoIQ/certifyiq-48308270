begin;
do $test$
declare uid uuid; sid uuid:=gen_random_uuid(); jid uuid:=gen_random_uuid(); iid uuid; first_id uuid; r jsonb; n integer;
begin
 select user_id into uid from public.account_access a where status='trialing' and plan_id is null and not exists(select 1 from public.user_roles ur where ur.user_id=a.user_id and ur.role='staff') limit 1;
 if uid is null then raise exception 'No isolated trial fixture available';end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,uid,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','session_id',sid)::text,true);
 delete from public.certification_review_usage where user_id=uid;
 delete from public.usage_counters where user_id=uid;
 insert into public.certification_import_jobs(id,user_id,created_by,status,source_name,total_files) values(jid,uid,uid,'processing','Synthetic quota validation',4);
 for n in 1..4 loop
  iid:=gen_random_uuid();
  insert into public.certification_import_items(id,job_id,user_id,storage_path,original_file_name,mime_type,size_bytes,sha256,status,extracted_data) values(iid,jid,uid,uid::text||'/'||jid::text||'/synthetic-'||n||'.pdf','synthetic.pdf','application/pdf',100,md5(iid::text)||md5(jid::text),'processing','{}');
  if n=1 then first_id:=iid;end if;
  if n<=3 then
   r:=public.reserve_certification_review(iid);
   if not (r->>'chargedTrial')::boolean then raise exception 'Trial review not metered';end if;
  else
   begin perform public.reserve_certification_review(iid);raise exception 'FOURTH_REVIEW_ACCEPTED';
   exception when others then if sqlerrm='FOURTH_REVIEW_ACCEPTED' or sqlerrm not ilike '%3%free%reviews%' then raise;end if;end;
  end if;
 end loop;
 r:=public.reserve_certification_review(first_id);
 if not (r->>'alreadyReserved')::boolean then raise exception 'Retry charged twice';end if;
 if (select sum(ai_docs_used) from public.usage_counters where user_id=uid)<>3 then raise exception 'Expected exactly three lifetime uses';end if;
 if (public.income_calculator_access()->>'allowed')::boolean then raise exception 'Calculator should stop after the third free review';end if;
 update public.certification_import_items set sha256=md5(sid::text)||md5(first_id::text) where id=first_id;
 begin perform public.reserve_certification_review(first_id);raise exception 'CHANGED_SOURCE_REUSED_CREDIT';
 exception when others then if sqlerrm='CHANGED_SOURCE_REUSED_CREDIT' or sqlerrm not ilike '%source changed%' then raise;end if;end;
 if has_function_privilege('anon','public.reserve_certification_review(uuid)','execute') then raise exception 'Anonymous quota RPC exposed';end if;
 if has_table_privilege('authenticated','public.certification_review_usage','insert') then raise exception 'Client ledger writes exposed';end if;
end $test$;
rollback;