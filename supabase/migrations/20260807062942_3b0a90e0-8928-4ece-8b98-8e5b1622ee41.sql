-- 1. Staff domain gate moves to certivoiq.com
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
     and lower(split_part(new.email, '@', 2)) = 'certivoiq.com' then
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

-- 2. Migrate existing staff accounts to the new domain (keeps passwords + staff role rows)
UPDATE auth.users
SET email = replace(lower(email), '@certifyiq.app', '@certivoiq.com')
WHERE lower(email) LIKE '%@certifyiq.app';

UPDATE public.profiles
SET email = replace(lower(email), '@certifyiq.app', '@certivoiq.com')
WHERE lower(email) LIKE '%@certifyiq.app';

-- 3. Refresh brand strings in seeded CRM content
UPDATE public.crm_news
SET headline = replace(headline, 'CertifyIQ', 'CertivoIQ'),
    detail = replace(coalesce(detail, ''), 'CertifyIQ', 'CertivoIQ'),
    source = replace(coalesce(source, ''), 'CertifyIQ', 'CertivoIQ')
WHERE headline LIKE '%CertifyIQ%' OR detail LIKE '%CertifyIQ%' OR source LIKE '%CertifyIQ%';

UPDATE public.crm_templates
SET name = replace(name, 'CertifyIQ', 'CertivoIQ'),
    subject = replace(subject, 'CertifyIQ', 'CertivoIQ'),
    body = replace(body, 'CertifyIQ', 'CertivoIQ'),
    cta_label = replace(coalesce(cta_label, ''), 'CertifyIQ', 'CertivoIQ')
WHERE name LIKE '%CertifyIQ%' OR subject LIKE '%CertifyIQ%' OR body LIKE '%CertifyIQ%' OR cta_label LIKE '%CertifyIQ%';

UPDATE public.crm_campaigns
SET name = replace(name, 'CertifyIQ', 'CertivoIQ'),
    subject = replace(coalesce(subject, ''), 'CertifyIQ', 'CertivoIQ'),
    body = replace(coalesce(body, ''), 'CertifyIQ', 'CertivoIQ')
WHERE name LIKE '%CertifyIQ%' OR subject LIKE '%CertifyIQ%' OR body LIKE '%CertifyIQ%';