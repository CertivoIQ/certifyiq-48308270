create table public.certification_review_usage (
 item_id uuid primary key references public.certification_import_items(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 charged_trial boolean not null,
 created_at timestamptz not null default now()
);
alter table public.certification_review_usage enable row level security;
revoke all on public.certification_review_usage from public,anon,authenticated;
grant select on public.certification_review_usage to authenticated;
create policy certification_review_usage_owner on public.certification_review_usage for select to authenticated using ((select auth.uid())=user_id);
create policy certification_review_usage_service on public.certification_review_usage for all to service_role using (true) with check (true);
grant all on public.certification_review_usage to service_role;
create function private.reserve_certification_review(_item_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare _user uuid:=auth.uid(); _access jsonb; _used bigint; _trial boolean; _period timestamptz;
begin
 if _user is null or not coalesce((private.session_window()->>'valid')::boolean,false) then raise exception 'Sign in again before review.';end if;
 perform pg_advisory_xact_lock(hashtextextended('certification-review:'||_user::text,0));
 if not exists(select 1 from public.certification_import_items where id=_item_id and user_id=_user) then raise exception 'Certification unavailable.';end if;
 if exists(select 1 from public.certification_review_usage where item_id=_item_id and user_id=_user) then return jsonb_build_object('allowed',true,'alreadyReserved',true);end if;
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
 insert into public.certification_review_usage(item_id,user_id,charged_trial) values(_item_id,_user,_trial);
 return jsonb_build_object('allowed',true,'alreadyReserved',false,'chargedTrial',_trial);
end $$;
revoke all on function private.reserve_certification_review(uuid) from public,anon;
grant execute on function private.reserve_certification_review(uuid) to authenticated;
create function public.reserve_certification_review(_item_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.reserve_certification_review(_item_id); $$;
revoke all on function public.reserve_certification_review(uuid) from public,anon;
grant execute on function public.reserve_certification_review(uuid) to authenticated;
