-- Workspace-profile writes fire a derived PHA control refresh. Run that
-- maintenance as the function owner so a valid customer profile save cannot
-- fail merely because the caller cannot update unrelated PHA control tables.
create or replace function public.refresh_pha_authoritative_controls_from_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.refresh_pha_authoritative_control_snapshots(new.user_id, null);
  return null;
end;
$function$;

-- This immutable helper does not need caller-controlled name resolution.
alter function public.crm_verified_sale_trigger_reason(timestamptz, timestamptz)
  set search_path = pg_catalog;
