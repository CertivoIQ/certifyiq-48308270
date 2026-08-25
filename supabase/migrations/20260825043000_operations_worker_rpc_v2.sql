-- Additive PostgREST cache-busting wrapper for the GitHub operations worker.
-- Keeps the original secret-authenticated implementation unchanged.

create or replace function public.operations_github_tick_v2(worker_secret text)
returns jsonb
language sql
security invoker
set search_path = public, extensions
as $$
  select public.operations_github_tick(worker_secret);
$$;

revoke all on function public.operations_github_tick_v2(text) from public;
grant execute on function public.operations_github_tick_v2(text) to anon, service_role;

comment on function public.operations_github_tick_v2(text) is
  'PostgREST-compatible wrapper for the secret-authenticated GitHub Actions worker.';

notify pgrst, 'reload schema';
