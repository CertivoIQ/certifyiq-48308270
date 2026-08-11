-- 1) Certification evidence + compliance decisions become read-only for end users.
--    All writes flow through audited server functions using the service role.

drop policy if exists "users manage own facts" on public.certification_facts;
create policy "users read own facts"
  on public.certification_facts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "users manage own findings" on public.compliance_findings;
create policy "users read own findings"
  on public.compliance_findings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "reviewers append own decisions" on public.finding_reviews;

revoke insert, update, delete on public.certification_facts from authenticated;
revoke insert, update, delete on public.compliance_findings from authenticated;
revoke insert, update, delete on public.finding_reviews from authenticated;
grant select on public.certification_facts to authenticated;
grant select on public.compliance_findings to authenticated;
grant select on public.finding_reviews to authenticated;
grant all on public.certification_facts to service_role;
grant all on public.compliance_findings to service_role;
grant all on public.finding_reviews to service_role;

-- 2) SECURITY DEFINER helpers move out of the API-exposed schema.
create schema if not exists private;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_agency_member(_agency_id uuid, _user_id uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $$
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

create or replace function private.has_agency_role(_agency_id uuid, _user_id uuid, _roles text[])
returns boolean language plpgsql stable security definer set search_path to '' as $$
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

create or replace function private.agency_can_view_submission(_submission_id uuid, _user_id uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $$
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

create or replace function private.agency_can_review_submission(_submission_id uuid, _user_id uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $$
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

revoke all on function private.is_agency_member(uuid, uuid) from public;
revoke all on function private.has_agency_role(uuid, uuid, text[]) from public;
revoke all on function private.agency_can_view_submission(uuid, uuid) from public;
revoke all on function private.agency_can_review_submission(uuid, uuid) from public;
grant execute on function private.is_agency_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.has_agency_role(uuid, uuid, text[]) to authenticated, service_role;
grant execute on function private.agency_can_view_submission(uuid, uuid) to authenticated, service_role;
grant execute on function private.agency_can_review_submission(uuid, uuid) to authenticated, service_role;

-- Repoint every policy at the private helpers.
drop policy if exists "Members and staff read their agency" on public.hfa_agencies;
create policy "Members and staff read their agency" on public.hfa_agencies for select to authenticated
  using (private.is_agency_member(id, auth.uid()) or public.has_role(auth.uid(), 'staff'::public.app_role));

drop policy if exists "Granted agency members read submitted packages" on public.hfa_submissions;
create policy "Granted agency members read submitted packages" on public.hfa_submissions for select to authenticated
  using (private.agency_can_view_submission(id, auth.uid()));

drop policy if exists "Reviewers advance granted submissions" on public.hfa_submissions;
create policy "Reviewers advance granted submissions" on public.hfa_submissions for update to authenticated
  using (private.agency_can_review_submission(id, auth.uid()))
  with check (private.agency_can_review_submission(id, auth.uid()));

drop policy if exists "Agency members read grants naming their agency" on public.hfa_submission_grants;
create policy "Agency members read grants naming their agency" on public.hfa_submission_grants for select to authenticated
  using (private.is_agency_member(agency_id, auth.uid()));

drop policy if exists "Granted agency members read corrections" on public.correction_cases;
create policy "Granted agency members read corrections" on public.correction_cases for select to authenticated
  using (private.agency_can_view_submission(submission_id, auth.uid()));

drop policy if exists "Reviewers disposition corrections" on public.correction_cases;
create policy "Reviewers disposition corrections" on public.correction_cases for update to authenticated
  using (private.agency_can_review_submission(submission_id, auth.uid()))
  with check (private.agency_can_review_submission(submission_id, auth.uid()));

drop policy if exists "Reviewers open corrections" on public.correction_cases;
create policy "Reviewers open corrections" on public.correction_cases for insert to authenticated
  with check (created_by = auth.uid() and private.agency_can_review_submission(submission_id, auth.uid()));

drop policy if exists "Granted agency members read correction evidence" on public.correction_evidence;
create policy "Granted agency members read correction evidence" on public.correction_evidence for select to authenticated
  using (exists (
    select 1 from public.correction_cases c
    where c.id = correction_evidence.correction_case_id
      and private.agency_can_view_submission(c.submission_id, auth.uid())
  ));

drop policy if exists "Granted agency members read audit history" on public.hfa_audit_events;
create policy "Granted agency members read audit history" on public.hfa_audit_events for select to authenticated
  using (private.agency_can_view_submission(submission_id, auth.uid()));

drop policy if exists "Agency admins and staff read their agency invitations" on public.hfa_agency_invitations;
create policy "Agency admins and staff read their agency invitations" on public.hfa_agency_invitations for select to authenticated
  using (private.has_agency_role(agency_id, auth.uid(), array['agency_admin'::text]) or public.has_role(auth.uid(), 'staff'::public.app_role));

drop function if exists public.is_agency_member(uuid, uuid);
drop function if exists public.has_agency_role(uuid, uuid, text[]);
drop function if exists public.agency_can_view_submission(uuid, uuid);
drop function if exists public.agency_can_review_submission(uuid, uuid);