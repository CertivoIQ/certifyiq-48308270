alter table public.tic_handwriting_reads
 add column completed_at timestamptz,
 add column outcome text check (outcome in ('succeeded','rate_limited','failed')),
 add column failure_code text check (length(failure_code)<=64),
 add column provider_status integer,
 add column finish_reason text check (length(finish_reason)<=32),
 add column completion_tokens integer,
 add column field_count integer,
 add column unresolved_count integer;
grant update(completed_at,outcome,failure_code,provider_status,finish_reason,completion_tokens,field_count,unresolved_count) on public.tic_handwriting_reads to service_role;
comment on column public.tic_handwriting_reads.outcome is 'Operational result only; never store images, transcription content, or tenant field values here.';
