-- Rollback-only production role UAT for customer-file storage isolation.
-- Run after 20260829060000_harden_customer_file_storage.sql.

begin;

insert into storage.objects(bucket_id, name, owner_id)
values
  ('certification-imports', '44444444-4444-4444-8444-444444444444/existing-a/file.pdf', '44444444-4444-4444-8444-444444444444'),
  ('certification-imports', '55555555-5555-4555-8555-555555555555/existing-b/file.pdf', '55555555-5555-4555-8555-555555555555');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);

do $uat$
declare
  visible_rows integer;
  cross_tenant_blocked boolean := false;
  unbacked_own_blocked boolean := false;
begin
  select count(*) into visible_rows
  from storage.objects
  where name like '%/existing-%/file.pdf';

  begin
    insert into storage.objects(bucket_id, name, owner_id)
    values ('certification-imports', '55555555-5555-4555-8555-555555555555/no-job/cross.pdf', '44444444-4444-4444-8444-444444444444');
  exception when insufficient_privilege or check_violation then
    cross_tenant_blocked := true;
  end;

  begin
    insert into storage.objects(bucket_id, name, owner_id)
    values ('certification-imports', '44444444-4444-4444-8444-444444444444/no-job/own.pdf', '44444444-4444-4444-8444-444444444444');
  exception when insufficient_privilege or check_violation then
    unbacked_own_blocked := true;
  end;

  if visible_rows <> 1 or not cross_tenant_blocked or not unbacked_own_blocked then
    raise exception 'storage UAT failed: visible=%, cross_blocked=%, unbacked_blocked=%',
      visible_rows, cross_tenant_blocked, unbacked_own_blocked;
  end if;
end
$uat$;

rollback;
