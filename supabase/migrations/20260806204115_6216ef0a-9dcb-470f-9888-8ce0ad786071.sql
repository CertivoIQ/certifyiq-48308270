create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Only allow callers to probe their own roles, unless they are staff or a
  -- trusted server-side role. Prevents enumeration of other users' roles.
  if _user_id is distinct from auth.uid()
     and auth.uid() is not null
     and not exists (
       select 1 from public.user_roles ur
       where ur.user_id = auth.uid() and ur.role = 'staff'
     )
  then
    return false;
  end if;

  return exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.role = _role
  );
end;
$$;

revoke all on function public.has_role(uuid, app_role) from public;
grant execute on function public.has_role(uuid, app_role) to authenticated, service_role;