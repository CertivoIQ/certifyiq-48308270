-- Controlled cleanup for abandoned certification-upload objects.
-- Objects are eligible only when they are older than the safety window,
-- have no certification_import_items source binding, and their owning job is
-- either absent, terminal, or itself stale. Deletion still occurs through the
-- Storage API in operations-worker so backend object bytes are removed correctly.

create table if not exists public.stale_certification_upload_purge_events (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  cutoff_hours integer not null,
  candidate_object_count integer not null default 0,
  deleted_object_count integer not null default 0,
  marked_job_count integer not null default 0,
  status text not null check (status in ('completed','failed')),
  error_detail text
);

alter table public.stale_certification_upload_purge_events enable row level security;
revoke all on public.stale_certification_upload_purge_events from anon, authenticated;
grant all on public.stale_certification_upload_purge_events to service_role;

create or replace function public.operations_stale_certification_objects(
  _older_than_hours integer default 72
)
returns table(storage_path text)
language sql
security definer
set search_path = public, storage, pg_temp
as $$
  with candidates as (
    select
      o.name,
      regexp_replace(o.name, '\.certivoiq-ocr\.json$', '') as source_path,
      split_part(o.name, '/', 2) as job_id_text,
      o.created_at
    from storage.objects o
    where o.bucket_id = 'certification-imports'
      and _older_than_hours between 24 and 720
      and o.created_at <= now() - make_interval(hours => _older_than_hours)
      and o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/.+'
  )
  select c.name as storage_path
  from candidates c
  left join public.certification_import_jobs j
    on j.id::text = c.job_id_text
  where not exists (
      select 1
      from public.certification_import_items i
      where i.storage_path = c.source_path
    )
    and (
      j.id is null
      or j.status in ('completed','partial','failed')
      or (
        j.status in ('queued','processing')
        and j.updated_at <= now() - make_interval(hours => _older_than_hours)
      )
    )
  order by c.created_at asc, c.name asc
  limit 500;
$$;

revoke all on function public.operations_stale_certification_objects(integer) from public, anon, authenticated;
grant execute on function public.operations_stale_certification_objects(integer) to service_role;

create or replace function public.operations_mark_stale_certification_jobs(
  _older_than_hours integer default 72
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _count integer := 0;
begin
  if _older_than_hours < 24 or _older_than_hours > 720 then
    raise exception 'older_than_hours out of range';
  end if;

  with updated as (
    update public.certification_import_jobs j
       set status = 'failed',
           error_count = j.error_count + 1,
           completed_at = coalesce(j.completed_at, now()),
           updated_at = now()
     where j.status in ('queued','processing')
       and j.updated_at <= now() - make_interval(hours => _older_than_hours)
       and not exists (
         select 1
         from public.certification_import_items i
         where i.job_id = j.id
       )
    returning 1
  )
  select count(*) into _count from updated;

  return _count;
end;
$$;

revoke all on function public.operations_mark_stale_certification_jobs(integer) from public, anon, authenticated;
grant execute on function public.operations_mark_stale_certification_jobs(integer) to service_role;
