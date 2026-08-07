-- Switch the staff-domain gate from certifyiq.com to certifyiq.app (the actual owned domain)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_trial_end timestamptz;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do update set email = excluded.email;

  if new.email_confirmed_at is not null
     and lower(split_part(new.email, '@', 2)) = 'certifyiq.app' then
    insert into public.user_roles (user_id, role) values (new.id, 'staff')
    on conflict (user_id, role) do nothing;
  end if;

  -- Start the real 7-day trial the moment the email is verified.
  if new.email_confirmed_at is not null then
    v_trial_end := new.email_confirmed_at + interval '7 days';
    insert into public.account_access (
      user_id, status, plan_id, price_id,
      unit_limit, property_limit, ai_doc_allowance, academy_seats,
      access_until, files_purge_at, trial_started_at, launchpad_started_at
    )
    values (
      new.id, 'trialing', null, null,
      250, 3, 25, 0,
      v_trial_end, v_trial_end + interval '14 days', new.email_confirmed_at, new.email_confirmed_at
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

-- Update the existing staff account emails so they match the owned domain
update auth.users
set email = replace(lower(email), '@certifyiq.com', '@certifyiq.app')
where lower(email) like '%@certifyiq.com';

-- Keep public.profiles in sync with the new emails
update public.profiles
set email = replace(lower(email), '@certifyiq.com', '@certifyiq.app')
where lower(email) like '%@certifyiq.com';