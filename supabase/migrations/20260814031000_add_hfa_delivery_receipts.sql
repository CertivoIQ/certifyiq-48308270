create table if not exists public.hfa_delivery_receipts (
  id uuid primary key default gen_random_uuid(),

  submission_id uuid not null
    references public.hfa_submissions(id)
    on delete cascade,

  agency_id uuid not null
    references public.hfa_agencies(id)
    on delete restrict,

  evidence_manifest_id uuid not null
    references public.evidence_manifests(id)
    on delete restrict,

  manifest_sha256 text not null,

  adapter text not null,

  external_receipt_id text not null,

  delivery_status text not null
    check (
      delivery_status in (
        'DELIVERED',
        'REJECTED',
        'INVALID_RECEIPT'
      )
    ),

  externally_delivered boolean not null default false,

  delivered_at timestamptz,

  receipt_payload jsonb not null default '{}'::jsonb,

  created_by uuid not null
    references auth.users(id),

  created_at timestamptz not null default now()
);

create unique index if not exists
  hfa_delivery_receipts_external_receipt_idx
  on public.hfa_delivery_receipts (
    adapter,
    external_receipt_id
  );

create unique index if not exists
  hfa_delivery_receipts_package_delivery_idx
  on public.hfa_delivery_receipts (
    submission_id,
    agency_id,
    evidence_manifest_id,
    adapter
  )
  where externally_delivered = true;

create index if not exists
  hfa_delivery_receipts_submission_idx
  on public.hfa_delivery_receipts (
    submission_id,
    created_at desc
  );

comment on table public.hfa_delivery_receipts is
  'Immutable receipts returned by external HFA delivery adapters. A submission is not considered externally delivered unless a verified receipt is persisted here.';

comment on column public.hfa_delivery_receipts.external_receipt_id is
  'Receipt or acknowledgement identifier returned by the external transport.';

comment on column public.hfa_delivery_receipts.manifest_sha256 is
  'SHA-256 of the exact evidence manifest delivered by the adapter.';

comment on column public.hfa_delivery_receipts.externally_delivered is
  'True only after an accepted transport receipt has been validated against the authorized package.';

alter table public.hfa_delivery_receipts
  enable row level security;

grant select on public.hfa_delivery_receipts
  to authenticated;

grant all on public.hfa_delivery_receipts
  to service_role;

create policy "owners read own delivery receipts"
  on public.hfa_delivery_receipts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.hfa_submissions s
      where s.id = hfa_delivery_receipts.submission_id
        and s.owner_user_id = auth.uid()
    )
  );

create policy "granted agency members read delivery receipts"
  on public.hfa_delivery_receipts
  for select
  to authenticated
  using (
    private.agency_can_view_submission(
      submission_id,
      auth.uid()
    )
  );

create or replace function public.block_hfa_delivery_receipt_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'HFA delivery receipts are immutable.';
end;
$$;

drop trigger if exists
  t_hfa_delivery_receipts_immutable
  on public.hfa_delivery_receipts;

create trigger t_hfa_delivery_receipts_immutable
before update or delete
on public.hfa_delivery_receipts
for each row
execute function public.block_hfa_delivery_receipt_mutation();