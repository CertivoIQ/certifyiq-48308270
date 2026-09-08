-- Unit-linked, append-only tenant history. Existing tenant records remain intact.
create schema if not exists private;

create table public.portfolio_tenant_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid not null,
  unit_id uuid not null,
  tenant_profile_id uuid not null,
  actor_id uuid,
  event_type text not null check (event_type in ('created','updated','deleted')),
  occurred_at timestamptz not null default clock_timestamp(),
  before_record jsonb,
  after_record jsonb
);
create index portfolio_tenant_events_unit_time on public.portfolio_tenant_events(user_id,unit_id,occurred_at desc,id);
alter table public.portfolio_tenant_events enable row level security;
revoke all on public.portfolio_tenant_events from public,anon,authenticated;
grant select on public.portfolio_tenant_events to authenticated;
create policy "owners read tenant history" on public.portfolio_tenant_events
  for select to authenticated using (user_id=(select auth.uid()));

create function private.capture_portfolio_tenant_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  tenant_row public.portfolio_tenant_profiles;
begin
  if TG_OP='DELETE' then tenant_row:=OLD; else tenant_row:=NEW; end if;
  if auth.uid() is not null and auth.uid()<>tenant_row.user_id then
    raise exception 'Tenant history owner does not match the authenticated user';
  end if;
  if TG_OP='UPDATE' and OLD.user_id<>NEW.user_id then
    raise exception 'Tenant ownership cannot be reassigned';
  end if;
  if TG_OP='UPDATE' and (to_jsonb(OLD)-'updated_at')=(to_jsonb(NEW)-'updated_at') then return NEW; end if;
  insert into public.portfolio_tenant_events(user_id,property_id,unit_id,tenant_profile_id,actor_id,event_type,before_record,after_record)
  values(tenant_row.user_id,tenant_row.property_id,tenant_row.unit_id,tenant_row.id,auth.uid(),
    case TG_OP when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    case when TG_OP<>'INSERT' then to_jsonb(OLD) end,
    case when TG_OP<>'DELETE' then to_jsonb(NEW) end);
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
revoke all on function private.capture_portfolio_tenant_event() from public,anon,authenticated;
create trigger portfolio_tenant_history after insert or update or delete on public.portfolio_tenant_profiles
for each row execute function private.capture_portfolio_tenant_event();

create function private.prevent_portfolio_history_change() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Tenant history is append-only'; end $$;
revoke all on function private.prevent_portfolio_history_change() from public,anon,authenticated;
create trigger portfolio_tenant_history_immutable before update or delete on public.portfolio_tenant_events
for each row execute function private.prevent_portfolio_history_change();

-- Serialize tenant writes against the unit lock used by assignment, including CSV writes.
create function private.lock_portfolio_tenant_unit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.portfolio_units where id=NEW.unit_id and user_id=NEW.user_id and property_id=NEW.property_id for update;
  if not found then raise exception 'Unit is unavailable'; end if;
  return NEW;
end $$;
revoke all on function private.lock_portfolio_tenant_unit() from public,anon,authenticated;
create trigger portfolio_tenant_unit_lock before insert or update on public.portfolio_tenant_profiles
for each row execute function private.lock_portfolio_tenant_unit();

create function public.assign_portfolio_unit_tenant(
  p_unit_id uuid, p_tenant_id uuid, p_external_id text, p_household_name text, p_move_in_date date
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  unit_row public.portfolio_units;
  existing public.portfolio_tenant_profiles;
  actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Sign in to assign a tenant'; end if;
  if p_tenant_id is null or nullif(btrim(p_external_id),'') is null or length(btrim(p_external_id))>160
     or nullif(btrim(p_household_name),'') is null or length(btrim(p_household_name))>240
     or p_move_in_date is null or p_move_in_date>current_date then
    raise exception 'Provide a tenant reference, household name and valid move-in date no later than today';
  end if;
  select * into unit_row from public.portfolio_units where id=p_unit_id and user_id=actor for update;
  if not found then raise exception 'Unit is unavailable'; end if;
  select * into existing from public.portfolio_tenant_profiles where id=p_tenant_id and user_id=actor;
  if found then
    if existing.unit_id=p_unit_id and existing.external_id=btrim(p_external_id)
       and existing.household_name=btrim(p_household_name) and existing.move_in_date=p_move_in_date then
      return existing.id;
    end if;
    raise exception 'This request was already used for different tenant details';
  end if;
  if exists(select 1 from public.portfolio_tenant_profiles where unit_id=p_unit_id and user_id=actor) then
    raise exception 'This unit already has a tenant. Refresh the unit list';
  end if;
  if exists(select 1 from public.portfolio_tenant_profiles where external_id=btrim(p_external_id) and user_id=actor) then
    raise exception 'That tenant reference already exists. Use a new reference';
  end if;
  insert into public.portfolio_tenant_profiles(id,user_id,property_id,unit_id,external_id,household_name,move_in_date,source_data)
  values(p_tenant_id,actor,unit_row.property_id,p_unit_id,btrim(p_external_id),btrim(p_household_name),p_move_in_date,
    jsonb_build_object('origin','manual_unit_assignment','createdBy',actor));
  -- The history trigger runs in this same transaction. Failure rolls everything back.
  return p_tenant_id;
end $$;
revoke all on function public.assign_portfolio_unit_tenant(uuid,uuid,text,text,date) from public,anon;
grant execute on function public.assign_portfolio_unit_tenant(uuid,uuid,text,text,date) to authenticated;
