-- Supabase may grant anon explicit function execution through default privileges.
-- Remove both PUBLIC-inherited and direct anonymous execution.
revoke all on function public.claim_certivoiq_founder_admin() from public, anon;
grant execute on function public.claim_certivoiq_founder_admin() to authenticated, service_role;
