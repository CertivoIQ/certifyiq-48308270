alter table public.certification_review_usage add column source_sha256 text;
update public.certification_review_usage r set source_sha256=i.sha256 from public.certification_import_items i where i.id=r.item_id;
alter table public.certification_review_usage alter column source_sha256 set not null;
alter table public.certification_review_usage add constraint certification_review_usage_hash check(source_sha256 ~ '^[a-f0-9]{64}$');
create or replace function private.reserve_certification_review(_item_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare _user uuid:=auth.uid(); _access jsonb; _used bigint; _trial boolean; _period timestamptz; _hash text;
begin
 if _user is null or not coalesce((private.session_window()->>'valid')::boolean,false) then raise exception 'Sign in again before review.';end if;
 perform pg_advisory_xact_lock(hashtextextended('certification-review:'||_user::text,0));
 select sha256 into _hash from public.certification_import_items where id=_item_id and user_id=_user;
 if _hash is null then raise exception 'Certification unavailable.';end if;
 if exists(select 1 from public.certification_review_usage where item_id=_item_id and user_id=_user) then
  if not exists(select 1 from public.certification_review_usage where item_id=_item_id and source_sha256=_hash) then raise exception 'The reviewed source changed. Stage a new certification.';end if;
  return jsonb_build_object('allowed',true,'alreadyReserved',true);end if;
 _access:=private.income_calculator_access();
 if not coalesce((_access->>'allowed')::boolean,false) then raise exception '%',coalesce(_access->>'reason','Review access unavailable.');end if;
 _trial:=_access->>'mode'='trial';
 if _trial then
  select greatest((select coalesce(sum(greatest(ai_docs_used,0)),0) from public.usage_counters where user_id=_user),(select count(*) from public.certification_review_usage where user_id=_user and charged_trial)) into _used;
  if _used>=3 then raise exception 'Your 3 FREE certification reviews have been used.';end if;
  _period:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  insert into public.usage_counters(user_id,period_start,environment,ai_docs_used) values(_user,_period,'live',1)
  on conflict(user_id,period_start,environment) do update set ai_docs_used=public.usage_counters.ai_docs_used+1,updated_at=now();
 end if;
 insert into public.certification_review_usage(item_id,user_id,charged_trial,source_sha256) values(_item_id,_user,_trial,_hash);
 return jsonb_build_object('allowed',true,'alreadyReserved',false,'chargedTrial',_trial);
end $$;
