create or replace function public.validate_finding_review_revocation_target()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_review public.finding_reviews%rowtype;
begin
  if new.revoked_review_id is null then
    return new;
  end if;

  select *
    into target_review
    from public.finding_reviews
   where id = new.revoked_review_id;

  if not found then
    raise exception 'Revocation target review does not exist.';
  end if;

  if target_review.finding_id <> new.finding_id then
    raise exception 'Revocation target must belong to the same finding.';
  end if;

  if target_review.decision <> 'approved' then
    raise exception 'Only an approved review may be revoked.';
  end if;

  if target_review.revoked_at is not null
     or target_review.revoked_review_id is not null then
    raise exception 'A revocation record cannot itself be revoked.';
  end if;

  if new.decision <> 'approved' or new.revoked_at is null then
    raise exception 'Revocation records must represent a revoked approval.';
  end if;

  return new;
end;
$$;

drop trigger if exists t_finding_reviews_validate_revocation_target
  on public.finding_reviews;

create trigger t_finding_reviews_validate_revocation_target
before insert on public.finding_reviews
for each row
when (new.revoked_review_id is not null)
execute function public.validate_finding_review_revocation_target();
