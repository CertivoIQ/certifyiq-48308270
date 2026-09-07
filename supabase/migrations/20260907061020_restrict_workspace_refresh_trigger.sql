-- Trigger-only SECURITY DEFINER functions must not be exposed as RPCs.
revoke execute on function public.refresh_pha_authoritative_controls_from_workspace()
  from public, anon, authenticated;
grant execute on function public.refresh_pha_authoritative_controls_from_workspace()
  to service_role;
