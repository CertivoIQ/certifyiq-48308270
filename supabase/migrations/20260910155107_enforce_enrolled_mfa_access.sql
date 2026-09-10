-- Preserve opt-in MFA while enforcing verified factors beyond client routing.
create or replace function private.mfa_satisfied()
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (
   coalesce(auth.jwt()->>'aal' = 'aal2', false)
   or not exists (select 1 from auth.mfa_factors f
     where f.user_id = auth.uid() and f.status = 'verified')
 );
$$;
revoke all on function private.mfa_satisfied() from public, anon, authenticated;
grant execute on function private.mfa_satisfied() to authenticated;

-- Additive response is compatible with existing lifetime-only clients.
create or replace function public.get_session_window()
returns jsonb language sql stable security invoker set search_path = '' as $$
 select private.session_window() || jsonb_build_object('mfa_satisfied',private.mfa_satisfied());
$$;

create or replace function public.enforce_session_window()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
 if auth.jwt()->>'role' = 'authenticated'
    and current_setting('request.path',true) is distinct from '/rpc/get_session_window' then
   if not coalesce((private.session_window()->>'valid')::boolean,false) then
     raise sqlstate 'PT401' using message = 'Your 7-day login session has ended. Please sign in again.';
   end if;
   if not private.mfa_satisfied() then
     raise sqlstate 'PT403' using message = 'Verify your authenticator to continue.';
   end if;
 end if;
end $$;

-- Storage does not execute the PostgREST request hook. Restrictive policy adds
-- assurance/lifetime requirements to, rather than replacing, owner/role rules.
create policy "Authenticated storage requires current session assurance"
on storage.objects as restrictive for all to authenticated
using ((select coalesce((private.session_window()->>'valid')::boolean,false) and private.mfa_satisfied()))
with check ((select coalesce((private.session_window()->>'valid')::boolean,false) and private.mfa_satisfied()));

notify pgrst, 'reload schema';
