-- The legacy one-argument final approval RPC cannot satisfy the signed Final Review Confirmation requirement.
revoke all on function public.approve_certification_final(uuid)
  from public, anon, authenticated;
grant execute on function public.approve_certification_final(uuid)
  to service_role;
