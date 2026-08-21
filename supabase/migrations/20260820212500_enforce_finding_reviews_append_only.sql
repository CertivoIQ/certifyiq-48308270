create or replace function public.reject_finding_review_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'finding_reviews is append-only; existing review records cannot be updated or deleted.';
end;
$$;

drop trigger if exists t_finding_reviews_append_only on public.finding_reviews;
create trigger t_finding_reviews_append_only
before update or delete on public.finding_reviews
for each row
execute function public.reject_finding_review_mutation();

-- Revocation integrity remains enforced for appended revocation records.
-- Existing rows are immutable, so UPDATE validation is no longer needed.
drop trigger if exists t_finding_reviews_validate_revocation_target
  on public.finding_reviews;

create trigger t_finding_reviews_validate_revocation_target
before insert on public.finding_reviews
for each row
when (new.revoked_review_id is not null)
execute function public.validate_finding_review_revocation_target();
