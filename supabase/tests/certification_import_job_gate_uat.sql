-- Rollback-only production-role UAT for the single-file/subscription job gate.
-- Run after 20260829061000_harden_certification_import_jobs.sql.

begin;

insert into auth.users(id)
values ('66666666-6666-4666-8666-666666666666');

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);

do $uat$
declare
  multi_file_blocked boolean := false;
begin
  begin
    insert into public.certification_import_jobs(
      id, user_id, created_by, status, source_name, total_files,
      processed_files, duplicate_files, finding_count, error_count
    ) values (
      '77777777-7777-4777-8777-777777777777',
      '66666666-6666-4666-8666-666666666666',
      '66666666-6666-4666-8666-666666666666',
      'queued', 'multi.zip', 2, 0, 0, 0, 0
    );
  exception when insufficient_privilege or check_violation then
    multi_file_blocked := true;
  end;

  insert into public.certification_import_jobs(
    id, user_id, created_by, status, source_name, total_files,
    processed_files, duplicate_files, finding_count, error_count
  ) values (
    '88888888-8888-4888-8888-888888888888',
    '66666666-6666-4666-8666-666666666666',
    '66666666-6666-4666-8666-666666666666',
    'queued', 'single.pdf', 1, 0, 0, 0, 0
  );

  if not multi_file_blocked then
    raise exception 'Import job UAT failed: unsubscribed multi-file job was accepted';
  end if;
end
$uat$;

rollback;
