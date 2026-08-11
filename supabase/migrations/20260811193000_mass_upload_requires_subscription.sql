-- Free users may submit one certification at a time for the 3 FREE review offer.
-- Mass Certification Review (2+ files in one job) requires an active paid platform subscription.
-- Enforce this at the database/storage layer so the restriction cannot be bypassed by the client.

alter table public.certification_import_jobs drop policy if exists "users manage import jobs";
create policy "users manage import jobs"
  on public.certification_import_jobs
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      total_files <= 1
      or public.has_active_subscription(auth.uid(), 'live')
      or public.has_active_subscription(auth.uid(), 'sandbox')
    )
  );

alter table public.certification_import_items drop policy if exists "users manage import items";
create policy "users manage import items"
  on public.certification_import_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from public.certification_import_jobs j
        where j.id = job_id
          and j.user_id = auth.uid()
          and (j.total_files <= 1
            or public.has_active_subscription(auth.uid(), 'live')
            or public.has_active_subscription(auth.uid(), 'sandbox'))
      )
    )
  );

alter table storage.objects drop policy if exists "users manage import storage";
create policy "users manage import storage"
  on storage.objects
  for all to authenticated
  using (
    bucket_id = 'certification-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'certification-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      exists (
        select 1
        from public.certification_import_jobs j
        where j.id::text = (storage.foldername(name))[2]
          and j.user_id = auth.uid()
          and (j.total_files <= 1
            or public.has_active_subscription(auth.uid(), 'live')
            or public.has_active_subscription(auth.uid(), 'sandbox'))
      )
    )
  );
