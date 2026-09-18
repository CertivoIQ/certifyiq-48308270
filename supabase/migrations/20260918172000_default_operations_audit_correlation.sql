-- Make operations audit correlation fail-safe at the database boundary.
-- Callers may still provide explicit correlation IDs; omitted values receive a
-- server-generated UUID while the column remains NOT NULL.

alter table public.operations_audit_events
  alter column correlation_id set default gen_random_uuid();

comment on column public.operations_audit_events.correlation_id is
  'Correlation identifier for immutable operations audit events. Explicit caller IDs are preserved; omitted values receive a server-generated UUID.';
