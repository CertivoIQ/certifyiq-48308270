-- Gate 4 launch hardening: internal CRM staff accounts are company-controlled.
-- Existing accepted beta accounts remain intact. PHA workspace invitations use a
-- separate table and are intentionally unaffected so customer agency users may
-- continue to use their organization email addresses.

create or replace function public.enforce_crm_staff_invitation_launch_domain()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'pending'
     and lower(split_part(new.invite_email, '@', 2)) <> 'certivoiq.com' then
    raise exception 'Internal CRM staff invitations require an @certivoiq.com email address';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_crm_staff_invitation_launch_domain() from public, anon, authenticated;
grant execute on function public.enforce_crm_staff_invitation_launch_domain() to service_role;

drop trigger if exists enforce_crm_staff_invitation_launch_domain
  on public.crm_staff_invitations;
create trigger enforce_crm_staff_invitation_launch_domain
before insert or update of invite_email, status
on public.crm_staff_invitations
for each row
execute function public.enforce_crm_staff_invitation_launch_domain();

alter table public.crm_staff_invitations
  drop constraint if exists crm_staff_pending_invite_certivoiq_domain;
alter table public.crm_staff_invitations
  add constraint crm_staff_pending_invite_certivoiq_domain
  check (
    status <> 'pending'
    or lower(split_part(invite_email, '@', 2)) = 'certivoiq.com'
  );

comment on constraint crm_staff_pending_invite_certivoiq_domain
  on public.crm_staff_invitations
  is 'Gate 4 launch control: new pending internal CRM staff invitations must use @certivoiq.com. PHA workspace invitations are separate customer-facing records.';
