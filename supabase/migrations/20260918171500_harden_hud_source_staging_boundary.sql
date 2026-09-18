-- HUD source staging now uses the OIDC-authenticated Operations Worker.
-- Keep the historical database RPC service-role only so it is not exposed through
-- the anonymous PostgREST surface.

revoke all on function public.operations_stage_hud_source_v1(
  text,text,text,text,timestamptz,text,bigint,text,jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.operations_stage_hud_source_v1(
  text,text,text,text,timestamptz,text,bigint,text,jsonb
) to service_role;

comment on function public.operations_stage_hud_source_v1(
  text,text,text,text,timestamptz,text,bigint,text,jsonb
) is 'Legacy service-role-only HUD staging RPC. GitHub source monitoring uses the OIDC-authenticated Operations Worker route.';
