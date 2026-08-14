alter table public.finding_reviews
  add column if not exists manifest_sha256 text;

comment on column public.finding_reviews.manifest_sha256 is
  'SHA-256 of the evidence manifest that was current when the reviewer decision was recorded. Used to invalidate stale approvals after certification evidence changes.';

create index if not exists finding_reviews_manifest_sha256_idx
  on public.finding_reviews (manifest_sha256);