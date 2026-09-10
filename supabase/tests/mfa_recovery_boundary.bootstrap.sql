-- Uses the isolated CI auth/users bootstrap; never run this against production.
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
