-- Remove the legacy permissive policy that bypasses the subscription/job gate
-- and constrain correction evidence to supported document/image payloads.

drop policy if exists "users manage own certification imports"
  on storage.objects;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
where id = 'correction-evidence';

do $$
declare
  import_policies integer;
  bucket_public boolean;
begin
  select count(*) into import_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'users manage import storage';
  if import_policies <> 1 then
    raise exception 'Certification import storage policy reconciliation failed';
  end if;

  select public into bucket_public
  from storage.buckets where id = 'correction-evidence';
  if bucket_public is distinct from false then
    raise exception 'Correction evidence bucket must remain private';
  end if;
end
$$;
