-- Additive, nullable measurements keep legacy rows valid and add no index/write amplification.
alter table public.certification_import_items
  add column if not exists upload_duration_ms bigint,
  add column if not exists extraction_duration_ms bigint,
  add column if not exists total_intake_duration_ms bigint,
  add column if not exists upload_transport text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'certification_import_items_performance_duration_check'
      and conrelid = 'public.certification_import_items'::regclass
  ) then
    alter table public.certification_import_items
      add constraint certification_import_items_performance_duration_check
      check (
        (upload_duration_ms is null or upload_duration_ms >= 0)
        and (extraction_duration_ms is null or extraction_duration_ms >= 0)
        and (total_intake_duration_ms is null or total_intake_duration_ms >= 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'certification_import_items_upload_transport_check'
      and conrelid = 'public.certification_import_items'::regclass
  ) then
    alter table public.certification_import_items
      add constraint certification_import_items_upload_transport_check
      check (upload_transport is null or upload_transport in ('standard', 'tus'));
  end if;
end
$$;


