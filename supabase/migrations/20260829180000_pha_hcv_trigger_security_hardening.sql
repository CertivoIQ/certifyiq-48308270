-- Harden the HCV portability trigger function that services PHA tables but
-- predates the pha_ function naming convention.
alter function public.enforce_hcv_portability_family_action()
  set search_path = public, pg_temp;

revoke execute on function public.enforce_hcv_portability_family_action()
  from public, anon, authenticated;
grant execute on function public.enforce_hcv_portability_family_action()
  to service_role;
