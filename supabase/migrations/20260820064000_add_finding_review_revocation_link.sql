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
