-- Keep NSPIRE release mutations callable through invoker-safe public wrappers.
-- The elevated implementations retain their internal staff, checksum, count,
-- and two-person attestation checks outside the exposed Data API schema.

create schema if not exists private;

alter function public.activate_pha_nspire_standard_release(uuid)
  set schema private;
alter function public.refresh_pha_nspire_release_counts(uuid)
  set schema private;
alter function public.attest_and_activate_pha_nspire_release(uuid, text)
  set schema private;

create function public.activate_pha_nspire_standard_release(target_release_id uuid)
returns void
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.activate_pha_nspire_standard_release(target_release_id);
$$;

create function public.refresh_pha_nspire_release_counts(target_release_id uuid)
returns void
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.refresh_pha_nspire_release_counts(target_release_id);
$$;

create function public.attest_and_activate_pha_nspire_release(
  target_release_id uuid,
  expected_sha256 text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.attest_and_activate_pha_nspire_release(
    target_release_id,
    expected_sha256
  );
$$;

alter function public.prepare_pha_nspire_standard_release()
  set search_path = pg_catalog, public;

revoke all on function public.activate_pha_nspire_standard_release(uuid)
  from public, anon;
revoke all on function public.refresh_pha_nspire_release_counts(uuid)
  from public, anon;
revoke all on function public.attest_and_activate_pha_nspire_release(uuid, text)
  from public, anon;

grant execute on function public.activate_pha_nspire_standard_release(uuid)
  to authenticated, service_role;
grant execute on function public.refresh_pha_nspire_release_counts(uuid)
  to authenticated, service_role;
grant execute on function public.attest_and_activate_pha_nspire_release(uuid, text)
  to authenticated, service_role;

revoke all on function private.activate_pha_nspire_standard_release(uuid)
  from public, anon;
revoke all on function private.refresh_pha_nspire_release_counts(uuid)
  from public, anon;
revoke all on function private.attest_and_activate_pha_nspire_release(uuid, text)
  from public, anon;

grant execute on function private.activate_pha_nspire_standard_release(uuid)
  to authenticated, service_role;
grant execute on function private.refresh_pha_nspire_release_counts(uuid)
  to authenticated, service_role;
grant execute on function private.attest_and_activate_pha_nspire_release(uuid, text)
  to authenticated, service_role;

do $$
declare
  exposed_definers integer;
begin
  select count(*) into exposed_definers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname in (
      'activate_pha_nspire_standard_release',
      'refresh_pha_nspire_release_counts',
      'attest_and_activate_pha_nspire_release'
    );

  if exposed_definers <> 0 then
    raise exception 'NSPIRE RPC hardening incomplete: % exposed definers remain',
      exposed_definers;
  end if;
end
$$;
