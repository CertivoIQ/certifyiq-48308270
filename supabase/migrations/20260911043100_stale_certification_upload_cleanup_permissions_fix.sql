-- Keep stale-upload cleanup audit records and identity sequence service-only.
revoke all on table public.stale_certification_upload_purge_events from public;
revoke all on sequence public.stale_certification_upload_purge_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.stale_certification_upload_purge_events_id_seq to service_role;
