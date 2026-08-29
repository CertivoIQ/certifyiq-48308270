-- Remove the legacy permissive job policy that bypasses the multi-file
-- subscription gate enforced by "users manage import jobs".

drop policy if exists "users manage own import jobs"
  on public.certification_import_jobs;

do $$
declare
  enforced_policies integer;
  legacy_policies integer;
begin
  select count(*) into enforced_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'certification_import_jobs'
    and policyname = 'users manage import jobs';

  select count(*) into legacy_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'certification_import_jobs'
    and policyname = 'users manage own import jobs';

  if enforced_policies <> 1 or legacy_policies <> 0 then
    raise exception 'Certification import job policy reconciliation failed';
  end if;
end
$$;
