-- Founder training grants are managed in account_access, independently of billing and workspace roles.
-- Preserve normal subscription behavior and RLS; no client-controlled identity claims grant access.
create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean
language sql stable security invoker
set search_path = public
as $function$
  select (
    user_uuid = auth.uid()
    and check_env in ('live', 'sandbox')
    and exists (
      select 1 from public.account_access
      where user_id = user_uuid
        and plan_id = 'founder_internal'
        and status = 'active'
        and (access_until is null or access_until > now())
    )
  ) or exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$function$;
