create or replace function private.can_access_correction_evidence(_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  with parts as (select string_to_array(_object_name, '/') as p),
  sub as (
    select case
      when (select p[1] from parts) ~ '^[0-9a-fA-F-]{36}$'
      then (select (p[1])::uuid from parts)
    end as submission_id
  )
  select exists (
    select 1
    from public.hfa_submissions s, sub
    where s.id = sub.submission_id
      and (
        s.owner_user_id = auth.uid()
        or private.is_agency_member(s.agency_id, auth.uid())
        or public.has_role(auth.uid(), 'staff'::public.app_role)
      )
  )
$$;

revoke all on function private.can_access_correction_evidence(text) from public;
grant execute on function private.can_access_correction_evidence(text) to authenticated, service_role;

drop policy if exists "correction_evidence_select" on storage.objects;
drop policy if exists "correction_evidence_insert" on storage.objects;
drop policy if exists "correction_evidence_update" on storage.objects;
drop policy if exists "correction_evidence_delete" on storage.objects;

create policy "correction_evidence_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'correction-evidence' and private.can_access_correction_evidence(name));

create policy "correction_evidence_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'correction-evidence' and private.can_access_correction_evidence(name));

create policy "correction_evidence_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'correction-evidence' and private.can_access_correction_evidence(name))
  with check (bucket_id = 'correction-evidence' and private.can_access_correction_evidence(name));

create policy "correction_evidence_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'correction-evidence' and private.can_access_correction_evidence(name));