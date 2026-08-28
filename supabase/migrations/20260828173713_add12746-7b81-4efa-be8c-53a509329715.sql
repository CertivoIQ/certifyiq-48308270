-- CRM employee access is invitation-controlled and managed only by active CertivoIQ administrators or managers.

create table if not exists public.crm_staff_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_level text not null check (access_level in ('employee','manager','admin')),
  status text not null default 'active' check (status in ('active','disabled')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  disabled_by uuid references auth.users(id) on delete set null,
  disabled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and disabled_by is null and disabled_at is null)
    or
    (status = 'disabled' and disabled_at is not null)
  )
);

create table if not exists public.crm_staff_invitations (
  id uuid primary key default gen_random_uuid(),
  invite_email text not null check (
    invite_email = lower(trim(invite_email))
    and split_part(invite_email, '@', 2) = 'certivoiq.com'
  ),
  access_level text not null check (access_level in ('employee','manager','admin')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  auth_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','suppressed')),
  delivery_attempt_count integer not null default 0 check (delivery_attempt_count >= 0),
  delivery_attempted_at timestamptz,
  delivered_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null))
);

create unique index if not exists crm_staff_invitations_one_pending_email
  on public.crm_staff_invitations (invite_email)
  where status = 'pending';

create table if not exists public.crm_staff_access_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  invitation_id uuid references public.crm_staff_invitations(id) on delete set null,
  event_type text not null check (event_type in (
    'invited','resent','accepted','revoked','activated','deactivated','role_changed'
  )),
  access_level text check (access_level is null or access_level in ('employee','manager','admin')),
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.crm_staff_access enable row level security;
alter table public.crm_staff_invitations enable row level security;
alter table public.crm_staff_access_events enable row level security;

grant select on public.crm_staff_access, public.crm_staff_invitations, public.crm_staff_access_events to authenticated;
grant all on public.crm_staff_access, public.crm_staff_invitations, public.crm_staff_access_events to service_role;
grant usage, select on sequence public.crm_staff_access_events_id_seq to service_role;

create or replace function public.crm_staff_can_manage(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'staff')
    and exists (
      select 1
      from public.crm_staff_access access
      where access.user_id = _user_id
        and access.status = 'active'
        and access.access_level in ('manager','admin')
    )
$$;

create or replace function public.crm_staff_is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'staff')
    and exists (
      select 1
      from public.crm_staff_access access
      where access.user_id = _user_id
        and access.status = 'active'
        and access.access_level = 'admin'
    )
$$;

revoke all on function public.crm_staff_can_manage(uuid) from public;
revoke all on function public.crm_staff_is_admin(uuid) from public;
grant execute on function public.crm_staff_can_manage(uuid), public.crm_staff_is_admin(uuid) to authenticated, service_role;

create policy "staff read own CRM access"
on public.crm_staff_access for select to authenticated
using (user_id = auth.uid() or public.crm_staff_can_manage(auth.uid()));

create policy "CRM managers read invitations"
on public.crm_staff_invitations for select to authenticated
using (public.crm_staff_can_manage(auth.uid()));

create policy "CRM managers read access audit"
on public.crm_staff_access_events for select to authenticated
using (public.crm_staff_can_manage(auth.uid()));

create or replace function public.prevent_crm_staff_access_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'CRM staff access events are append-only';
end;
$$;

drop trigger if exists prevent_crm_staff_access_event_update on public.crm_staff_access_events;
create trigger prevent_crm_staff_access_event_update
before update or delete on public.crm_staff_access_events
for each row execute function public.prevent_crm_staff_access_event_mutation();

drop trigger if exists touch_crm_staff_access_updated_at on public.crm_staff_access;
create trigger touch_crm_staff_access_updated_at
before update on public.crm_staff_access
for each row execute function public.touch_updated_at();

drop trigger if exists touch_crm_staff_invitation_updated_at on public.crm_staff_invitations;
create trigger touch_crm_staff_invitation_updated_at
before update on public.crm_staff_invitations
for each row execute function public.touch_updated_at();

-- Preserve every existing staff account. The CertivoIQ owner is the initial administrator.
insert into public.crm_staff_access (user_id, access_level, status, granted_by)
select roles.user_id,
       case when lower(profiles.email) = 'rjwatkins@certivoiq.com' then 'admin' else 'employee' end,
       'active',
       roles.user_id
from public.user_roles roles
join public.profiles profiles on profiles.id = roles.user_id
where roles.role = 'staff'
on conflict (user_id) do nothing;

-- New domain accounts receive CRM access only through an unexpired invitation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_trial_end timestamptz;
  invitation public.crm_staff_invitations%rowtype;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do update set email = excluded.email;

  if new.email_confirmed_at is not null
     and lower(split_part(new.email, '@', 2)) = 'certivoiq.com' then
    select *
      into invitation
      from public.crm_staff_invitations
     where invite_email = lower(new.email)
       and status = 'pending'
       and expires_at > now()
     order by created_at desc
     limit 1;

    if found then
      insert into public.user_roles (user_id, role)
      values (new.id, 'staff')
      on conflict (user_id, role) do nothing;

      insert into public.crm_staff_access (
        user_id, access_level, status, granted_by, granted_at,
        disabled_by, disabled_at, updated_at
      )
      values (
        new.id, invitation.access_level, 'active', invitation.invited_by, now(),
        null, null, now()
      )
      on conflict (user_id) do update
        set access_level = excluded.access_level,
            status = 'active',
            granted_by = excluded.granted_by,
            granted_at = now(),
            disabled_by = null,
            disabled_at = null,
            updated_at = now();

      update public.crm_staff_invitations
         set status = 'accepted',
             auth_user_id = new.id,
             accepted_at = now(),
             updated_at = now()
       where id = invitation.id;

      insert into public.crm_staff_access_events (
        actor_id, target_user_id, invitation_id, event_type, access_level
      )
      values (
        invitation.invited_by, new.id, invitation.id, 'accepted', invitation.access_level
      );
    end if;
  end if;

  -- Preserve standard account setup after verified sign-in.
  if new.email_confirmed_at is not null then
    v_trial_end := new.email_confirmed_at + interval '7 days';
    insert into public.account_access (
      user_id, status, plan_id, price_id,
      unit_limit, property_limit, ai_doc_allowance, academy_seats,
      access_until, files_purge_at, trial_started_at, launchpad_started_at
    )
    values (
      new.id, 'trialing', null, null,
      250, 3, 25, 0,
      v_trial_end, v_trial_end + interval '14 days', new.email_confirmed_at, new.email_confirmed_at
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

-- auth.users rows are created before an invited employee confirms the email. The confirmation is
-- claimed by the signed-in account itself through this audited security-definer routine, so no
-- trigger is added to the managed auth schema.
create or replace function public.claim_crm_staff_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user auth.users%rowtype;
  invitation public.crm_staff_invitations%rowtype;
begin
  select * into v_user from auth.users where id = auth.uid();
  if not found or v_user.email_confirmed_at is null then
    return jsonb_build_object('claimed', false, 'reason', 'unconfirmed');
  end if;

  if lower(split_part(v_user.email, '@', 2)) <> 'certivoiq.com' then
    return jsonb_build_object('claimed', false, 'reason', 'domain');
  end if;

  select * into invitation
    from public.crm_staff_invitations
   where invite_email = lower(v_user.email)
     and status = 'pending'
     and expires_at > now()
   order by created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'no_pending_invitation');
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user.id, 'staff')
  on conflict (user_id, role) do nothing;

  insert into public.crm_staff_access (
    user_id, access_level, status, granted_by, granted_at, disabled_by, disabled_at, updated_at
  )
  values (
    v_user.id, invitation.access_level, 'active', invitation.invited_by, now(), null, null, now()
  )
  on conflict (user_id) do update
    set access_level = excluded.access_level,
        status = 'active',
        granted_by = excluded.granted_by,
        granted_at = now(),
        disabled_by = null,
        disabled_at = null,
        updated_at = now();

  update public.crm_staff_invitations
     set status = 'accepted',
         auth_user_id = v_user.id,
         accepted_at = now(),
         updated_at = now()
   where id = invitation.id;

  insert into public.crm_staff_access_events (
    actor_id, target_user_id, invitation_id, event_type, access_level
  )
  values (
    invitation.invited_by, v_user.id, invitation.id, 'accepted', invitation.access_level
  );

  return jsonb_build_object('claimed', true, 'access_level', invitation.access_level);
end;
$function$;

revoke all on function public.claim_crm_staff_invitation() from public;
grant execute on function public.claim_crm_staff_invitation() to authenticated, service_role;

comment on table public.crm_staff_access is 'Current internal CRM access level and activation status.';
comment on table public.crm_staff_invitations is 'Audited CertivoIQ-domain staff invitations created only through the server-side CRM access workflow.';
comment on table public.crm_staff_access_events is 'Append-only evidence for internal CRM invitations and access changes.';