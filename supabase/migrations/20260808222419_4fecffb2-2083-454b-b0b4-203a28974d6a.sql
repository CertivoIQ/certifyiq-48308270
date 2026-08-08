CREATE OR REPLACE FUNCTION public.is_agency_member(_agency_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id = _agency_id and m.user_id = _user_id and m.suspended_at is null
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.has_agency_role(_agency_id uuid, _user_id uuid, _roles text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id = _agency_id and m.user_id = _user_id
      and m.suspended_at is null and m.role = any(_roles)
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.agency_can_view_submission(_submission_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id = g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id = g.agency_id and m.user_id = _user_id and m.suspended_at is null
    where g.submission_id = _submission_id
      and g.revoked_at is null
      and s.agency_id = g.agency_id
      and s.status <> 'draft'
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.agency_can_review_submission(_submission_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if _user_id is distinct from auth.uid() and auth.uid() is not null then
    return false;
  end if;
  return exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id = g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id = g.agency_id and m.user_id = _user_id and m.suspended_at is null
    where g.submission_id = _submission_id
      and g.revoked_at is null
      and s.agency_id = g.agency_id
      and s.status <> 'draft'
      and m.role in ('agency_admin','monitor')
  );
end;
$$;

REVOKE ALL ON FUNCTION public.is_agency_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_agency_role(uuid, uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_can_view_submission(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_can_review_submission(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agency_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agency_can_view_submission(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agency_can_review_submission(uuid, uuid) TO authenticated, service_role;