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

alter table public.finding_reviews
  add column if not exists manifest_sha256 text;

comment on column public.finding_reviews.manifest_sha256 is
  'SHA-256 of the evidence manifest that was current when the reviewer decision was recorded. Used to invalidate stale approvals after certification evidence changes.';

create index if not exists finding_reviews_manifest_sha256_idx
  on public.finding_reviews (manifest_sha256);

create table if not exists public.hfa_transmission_tokens (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.hfa_submissions(id) on delete cascade,
  agency_id uuid not null references public.hfa_agencies(id) on delete cascade,
  manifest_sha256 text not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint hfa_transmission_tokens_expiry_check
    check (expires_at > issued_at)
);

create index if not exists hfa_transmission_tokens_submission_idx
  on public.hfa_transmission_tokens(submission_id, created_at desc);

create index if not exists hfa_transmission_tokens_active_idx
  on public.hfa_transmission_tokens(
    submission_id,
    agency_id,
    manifest_sha256,
    expires_at
  )
  where consumed_at is null and revoked_at is null;

grant select on public.hfa_transmission_tokens to authenticated;
grant all on public.hfa_transmission_tokens to service_role;

alter table public.hfa_transmission_tokens enable row level security;

drop policy if exists "Owners read their transmission tokens"
  on public.hfa_transmission_tokens;

create policy "Owners read their transmission tokens"
on public.hfa_transmission_tokens
for select
to authenticated
using (
  exists (
    select 1
    from public.hfa_submissions s
    where s.id = hfa_transmission_tokens.submission_id
      and s.owner_user_id = auth.uid()
  )
);

alter table public.finding_reviews
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz;

comment on column public.finding_reviews.expires_at is
  'Optional explicit expiration timestamp for this human review decision. Null means no expiration policy was assigned to the decision.';

comment on column public.finding_reviews.revoked_at is
  'Timestamp carried by an append-only review record when the approval represented by that latest review has been revoked.';

create index if not exists finding_reviews_expires_at_idx
  on public.finding_reviews (expires_at)
  where expires_at is not null;

create index if not exists finding_reviews_revoked_at_idx
  on public.finding_reviews (revoked_at)
  where revoked_at is not null;

alter table public.finding_reviews
  add column if not exists revoked_review_id uuid;

comment on column public.finding_reviews.revoked_review_id is
  'Identifies the immutable approval review revoked by this append-only revocation record.';

alter table public.finding_reviews
  drop constraint if exists finding_reviews_revoked_review_id_fkey;

alter table public.finding_reviews
  add constraint finding_reviews_revoked_review_id_fkey
  foreign key (revoked_review_id)
  references public.finding_reviews(id)
  on delete restrict;

create unique index if not exists finding_reviews_revoked_review_id_unique_idx
  on public.finding_reviews (revoked_review_id)
  where revoked_review_id is not null;