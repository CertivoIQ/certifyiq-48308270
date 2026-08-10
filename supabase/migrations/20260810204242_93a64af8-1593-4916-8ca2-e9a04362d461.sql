create policy "users manage own certification imports" on storage.objects
  for all to authenticated
  using (bucket_id = 'certification-imports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'certification-imports' and (storage.foldername(name))[1] = auth.uid()::text);