-- Harden the PHA function surface after restoring production schema parity.
-- Pin function lookup paths and remove PostgreSQL's default anonymous/PUBLIC execution.

do $$
declare
  f record;
  signature text;
  authenticated_needed boolean;
  service_role_needed boolean;
begin
  for f in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname ilike '%pha%'
  loop
    signature:=format('%I.%I(%s)',f.nspname,f.proname,f.args);
    authenticated_needed:=has_function_privilege('authenticated',f.oid,'execute');
    service_role_needed:=has_function_privilege('service_role',f.oid,'execute');

    execute format('alter function %s set search_path = public, pg_temp',signature);
    execute format('revoke execute on function %s from public, anon',signature);

    if authenticated_needed then
      execute format('grant execute on function %s to authenticated',signature);
    end if;
    if service_role_needed then
      execute format('grant execute on function %s to service_role',signature);
    end if;
  end loop;
end $$;
