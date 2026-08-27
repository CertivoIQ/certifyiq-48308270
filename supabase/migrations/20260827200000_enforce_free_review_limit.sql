-- Enforce the lifetime three-review offer at the database boundary.
-- Client controls are advisory; concurrent inserts must not exceed the allowance.

create or replace function public.enforce_free_certification_review_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_reviews integer;
begin
  -- Serialize review claims for the same account.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if public.has_active_subscription(new.user_id, 'live')
     or public.has_active_subscription(new.user_id, 'sandbox') then
    return new;
  end if;

  select count(*) into existing_reviews
  from public.certification_import_items
  where user_id = new.user_id;

  if existing_reviews >= 3 then
    raise exception 'The 3 FREE certification review allowance has been used.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_certification_review_limit
  on public.certification_import_items;
create trigger enforce_free_certification_review_limit
  before insert on public.certification_import_items
  for each row execute function public.enforce_free_certification_review_limit();

-- Archive ingestion is not active. Keep storage aligned with the formats
-- that have verified PDF or image-processing paths.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/octet-stream'
]
where id = 'certification-imports';
