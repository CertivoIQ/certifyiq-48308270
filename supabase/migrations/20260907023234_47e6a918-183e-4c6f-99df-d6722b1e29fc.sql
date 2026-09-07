alter table public._nspire_import_chunks enable row level security;
alter table public._nspire_import_chunks force row level security;
revoke all on public._nspire_import_chunks from anon, authenticated;
grant all on public._nspire_import_chunks to service_role;

alter table public.operations_runtime_secrets enable row level security;
alter table public.operations_runtime_secrets force row level security;
revoke all on public.operations_runtime_secrets from anon, authenticated;
grant all on public.operations_runtime_secrets to service_role;

alter view public.operations_health set (security_invoker = true);
revoke all on public.operations_health from anon;