-- 1. Security-definer helpers: empty search_path, fully schema-qualified.
create or replace function public.is_agency_member(_agency_id uuid, _user_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id operator(pg_catalog.=) _agency_id
      and m.user_id operator(pg_catalog.=) _user_id
      and m.suspended_at is null
  );
end;
$$;

create or replace function public.has_agency_role(_agency_id uuid, _user_id uuid, _roles text[])
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id operator(pg_catalog.=) _agency_id
      and m.user_id operator(pg_catalog.=) _user_id
      and m.suspended_at is null
      and m.role operator(pg_catalog.=) any(_roles)
  );
end;
$$;

create or replace function public.agency_can_view_submission(_submission_id uuid, _user_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id operator(pg_catalog.=) g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id operator(pg_catalog.=) g.agency_id
     and m.user_id operator(pg_catalog.=) _user_id
     and m.suspended_at is null
    where g.submission_id operator(pg_catalog.=) _submission_id
      and g.revoked_at is null
      and s.agency_id operator(pg_catalog.=) g.agency_id
      and s.status operator(pg_catalog.<>) 'draft'::public.hfa_submission_status
  );
end;
$$;

create or replace function public.agency_can_review_submission(_submission_id uuid, _user_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id operator(pg_catalog.=) g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id operator(pg_catalog.=) g.agency_id
     and m.user_id operator(pg_catalog.=) _user_id
     and m.suspended_at is null
    where g.submission_id operator(pg_catalog.=) _submission_id
      and g.revoked_at is null
      and s.agency_id operator(pg_catalog.=) g.agency_id
      and s.status operator(pg_catalog.<>) 'draft'::public.hfa_submission_status
      and m.role operator(pg_catalog.=) any(array['agency_admin','monitor'])
  );
end;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language plpgsql stable set search_path = '' as $$
begin
  if _user_id is distinct from auth.uid()
     and auth.uid() is not null
     and not exists (
       select 1 from public.user_roles ur
       where ur.user_id operator(pg_catalog.=) auth.uid()
         and ur.role operator(pg_catalog.=) 'staff'::public.app_role
     )
  then
    return false;
  end if;

  return exists (
    select 1 from public.user_roles ur
    where ur.user_id operator(pg_catalog.=) _user_id
      and ur.role operator(pg_catalog.=) _role
  );
end;
$$;

-- Re-assert least-privilege execution.
revoke all on function public.is_agency_member(uuid, uuid) from public, anon;
revoke all on function public.has_agency_role(uuid, uuid, text[]) from public, anon;
revoke all on function public.agency_can_view_submission(uuid, uuid) from public, anon;
revoke all on function public.agency_can_review_submission(uuid, uuid) from public, anon;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;

grant execute on function public.is_agency_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_agency_role(uuid, uuid, text[]) to authenticated, service_role;
grant execute on function public.agency_can_view_submission(uuid, uuid) to authenticated, service_role;
grant execute on function public.agency_can_review_submission(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- 2. Quarantine is the only permitted evidence state: no scanner exists.
update public.correction_evidence set scan_status = 'quarantined' where scan_status is distinct from 'quarantined';
alter table public.correction_evidence
  drop constraint if exists correction_evidence_scan_status_quarantined,
  add constraint correction_evidence_scan_status_quarantined
    check (scan_status = 'quarantined');

-- 3. Closing a correction backed by quarantined documentation requires an
--    explicit reviewer acknowledgement that it was inspected off-platform.
alter table public.correction_cases
  add column if not exists quarantine_ack_by uuid references auth.users(id),
  add column if not exists quarantine_ack_at timestamptz;