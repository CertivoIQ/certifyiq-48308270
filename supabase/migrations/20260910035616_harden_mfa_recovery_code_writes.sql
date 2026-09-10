-- Recovery hashes are server-managed credentials, not user-editable profile data.
-- Keep owner-scoped reads for the existing unused-code count; never allow a
-- password-only client to plant a hash or reset a consumed code.
revoke insert, update, delete on public.user_recovery_codes from public, anon, authenticated;
drop policy if exists "Users manage their own recovery codes" on public.user_recovery_codes;
create policy "Users read their own recovery codes" on public.user_recovery_codes
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.user_recovery_codes to authenticated;
grant all on public.user_recovery_codes to service_role;

do $$
begin
  if has_table_privilege('authenticated', 'public.user_recovery_codes', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_recovery_codes', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_recovery_codes', 'DELETE') then
    raise exception 'Recovery code client writes must remain disabled';
  end if;
end $$;
