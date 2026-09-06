-- Fixed session lifetime uses the original server-side login, never JWT refresh time.
create or replace function private.session_window()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare deadline timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('valid',false,'remaining_seconds',0); end if;
  select least(s.created_at + interval '168 hours', coalesce(s.not_after, 'infinity'::timestamptz))
    into deadline from auth.sessions s
    where s.id = nullif(auth.jwt()->>'session_id','')::uuid and s.user_id = auth.uid();
  return jsonb_build_object('valid',coalesce(deadline > statement_timestamp(),false),
    'remaining_seconds',greatest(0,coalesce(extract(epoch from deadline-statement_timestamp()),0)));
end $$;
revoke all on function private.session_window() from public, anon, authenticated;
grant execute on function private.session_window() to authenticated;

create or replace function public.get_session_window()
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.session_window(); $$;
revoke all on function public.get_session_window() from public, anon;
grant execute on function public.get_session_window() to authenticated;

-- Enforce the same boundary on direct REST reads/writes, not only route navigation.
create or replace function public.enforce_session_window()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.jwt()->>'role' = 'authenticated'
     and current_setting('request.path', true) is distinct from '/rpc/get_session_window'
     and not (private.session_window()->>'valid')::boolean then
    raise sqlstate 'PT401' using message = 'Your 7-day login session has ended. Please sign in again.';
  end if;
end $$;
revoke all on function public.enforce_session_window() from public, anon, authenticated;
grant execute on function public.enforce_session_window() to anon, authenticated, service_role;
-- Activate the request hook after the matching UI is deployed.

create or replace function private.income_calculator_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account public.account_access; used bigint;
begin
  if auth.uid() is null or not (private.session_window()->>'valid')::boolean then
    return jsonb_build_object('allowed',false,'mode','blocked','remaining',0,'reason','Please sign in again.');
  end if;
  if exists (select 1 from public.user_roles where user_id=auth.uid() and role='staff') then
    return jsonb_build_object('allowed',true,'mode','staff','remaining',null,'reason','Staff access');
  end if;
  select * into account from public.account_access where user_id=auth.uid();
  if account.plan_id is not null and account.status in ('active','trialing','past_due','canceled')
     and (account.access_until > statement_timestamp() or (account.access_until is null and account.status <> 'canceled')) then
    return jsonb_build_object('allowed',true,'mode','paid','remaining',null,'reason','Active platform access');
  end if;
  if account.status='trialing' and account.plan_id is null then
    -- Lifetime balance: neither a calendar rollover nor a different environment resets free access.
    select coalesce(sum(greatest(ai_docs_used,0)),0) into used from public.usage_counters where user_id=auth.uid();
    return jsonb_build_object('allowed',used<3,'mode',case when used<3 then 'trial' else 'blocked' end,
      'remaining',greatest(0,3-used),'reason',case when used<3 then 'Trial calculator access'
      else 'Your 3 free certification reviews have been used. Subscribe to continue using the Income Calculator.' end);
  end if;
  return jsonb_build_object('allowed',false,'mode','blocked','remaining',0,'reason','An active trial or platform subscription is required to use the Income Calculator.');
end $$;
revoke all on function private.income_calculator_access() from public, anon, authenticated;
grant execute on function private.income_calculator_access() to authenticated;
create or replace function public.income_calculator_access()
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.income_calculator_access(); $$;
revoke all on function public.income_calculator_access() from public, anon;
grant execute on function public.income_calculator_access() to authenticated;
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

