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
