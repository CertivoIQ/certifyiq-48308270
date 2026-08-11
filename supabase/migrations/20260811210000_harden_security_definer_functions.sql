-- Security hardening: eliminate SECURITY DEFINER from functions that are
-- intentionally callable from authenticated application paths.
--
-- These functions do not need elevated table privileges:
--   * has_role() only checks the caller's own role in normal RLS usage.
--   * generate_support_case_number() only advances a sequence for which
--     authenticated callers already have USAGE/SELECT privileges.
--
-- Keeping them SECURITY INVOKER removes the authenticated SECURITY DEFINER
-- exposure flagged by Supabase's database linter while preserving behavior.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.generate_support_case_number()
returns text
language sql
security invoker
set search_path = public
as $$
  select 'SC-' || nextval('public.support_case_number_seq')::text;
$$;

revoke all on function public.generate_support_case_number() from public, anon;
grant execute on function public.generate_support_case_number() to authenticated, service_role;
