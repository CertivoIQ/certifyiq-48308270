-- Secure PHA user invitation lifecycle. Invitations are email-bound, expire automatically,
-- and become agency memberships only after the authenticated user's email matches.

create table if not exists public.pha_workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  invite_email text not null,
  agency_role text not null check (agency_role in (
    'executive','agency_admin','compliance_admin','hcv_pbv_specialist','public_housing_specialist','inspection_staff'
  )),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid not null default auth.uid() references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (invite_email = lower(trim(invite_email)))
);

create unique index if not exists pha_workspace_pending_invite_email_uidx
  on public.pha_workspace_invitations(workspace_user_id, lower(invite_email))
  where status = 'pending';

alter table public.pha_workspace_invitations enable row level security;
grant select, insert, update, delete on public.pha_workspace_invitations to authenticated;
grant all on public.pha_workspace_invitations to service_role;

create or replace function public.pha_workspace_admin_access(target_workspace_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_pha_workspace_owner(target_workspace_user_id)
    or public.has_role(auth.uid(), 'staff')
    or exists (
      select 1 from public.pha_workspace_memberships m
       where m.workspace_user_id = target_workspace_user_id
         and m.member_user_id = auth.uid()
         and m.active = true
         and m.agency_role = 'agency_admin'
    )
$$;

drop policy if exists "PHA admins manage invitations" on public.pha_workspace_invitations;
create policy "PHA admins manage invitations" on public.pha_workspace_invitations
for all to authenticated
using (public.pha_workspace_admin_access(workspace_user_id))
with check (
  public.pha_workspace_admin_access(workspace_user_id)
  and invite_email = lower(trim(invite_email))
  and expires_at > now()
);

drop policy if exists "Invitees read own pending invitations" on public.pha_workspace_invitations;
create policy "Invitees read own pending invitations" on public.pha_workspace_invitations
for select to authenticated
using (
  status = 'pending'
  and expires_at > now()
  and lower(invite_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create trigger pha_workspace_invitations_touch_updated_at
before update on public.pha_workspace_invitations
for each row execute function public.touch_updated_at();

create or replace function public.accept_pha_workspace_invitation(target_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  invitation public.pha_workspace_invitations%rowtype;
  signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or signed_in_email = '' then
    raise exception 'Authentication with a verified email is required';
  end if;

  select * into invitation from public.pha_workspace_invitations where id = target_invitation_id for update;
  if not found then raise exception 'PHA invitation not found'; end if;
  if invitation.status <> 'pending' then raise exception 'PHA invitation is no longer pending'; end if;
  if invitation.expires_at <= now() then
    update public.pha_workspace_invitations set status = 'expired', updated_at = now() where id = invitation.id;
    raise exception 'PHA invitation has expired';
  end if;
  if lower(invitation.invite_email) <> signed_in_email then
    raise exception 'PHA invitation email does not match the signed-in user';
  end if;
  if invitation.workspace_user_id = auth.uid() then
    raise exception 'PHA workspace owner cannot accept a self invitation';
  end if;

  insert into public.pha_workspace_memberships (workspace_user_id, member_user_id, agency_role, active, created_by)
  values (invitation.workspace_user_id, auth.uid(), invitation.agency_role, true, invitation.created_by)
  on conflict (workspace_user_id, member_user_id) do update
    set agency_role = excluded.agency_role, active = true, updated_at = now();

  update public.pha_workspace_invitations
     set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
   where id = invitation.id;

  return invitation.workspace_user_id;
end;
$$;

grant execute on function public.accept_pha_workspace_invitation(uuid) to authenticated;

-- Owners and agency admins can manage memberships; agency_admin may not promote another user to agency_admin.
drop policy if exists "PHA owners manage memberships" on public.pha_workspace_memberships;
create policy "PHA owners manage memberships" on public.pha_workspace_memberships
for all to authenticated
using (public.pha_workspace_admin_access(workspace_user_id))
with check (
  public.pha_workspace_admin_access(workspace_user_id)
  and workspace_user_id <> member_user_id
  and (
    public.is_pha_workspace_owner(workspace_user_id)
    or public.has_role(auth.uid(), 'staff')
    or agency_role <> 'agency_admin'
  )
);
