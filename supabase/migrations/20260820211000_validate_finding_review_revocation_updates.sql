-- Ensure revocation target integrity cannot be bypassed by mutating an existing review.
-- The validator itself already handles both INSERT and UPDATE row images; this
-- migration expands the trigger event coverage to UPDATE.

drop trigger if exists t_finding_reviews_validate_revocation_target
  on public.finding_reviews;

create trigger t_finding_reviews_validate_revocation_target
before insert or update on public.finding_reviews
for each row
when (new.revoked_review_id is not null)
execute function public.validate_finding_review_revocation_target();
