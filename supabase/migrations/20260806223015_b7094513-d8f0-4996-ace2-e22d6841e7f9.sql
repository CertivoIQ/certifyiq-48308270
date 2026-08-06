-- 1. Usage metering per billing period
CREATE TABLE public.usage_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  period_end timestamptz,
  ai_docs_used integer NOT NULL DEFAULT 0,
  ai_docs_billed integer NOT NULL DEFAULT 0,
  properties_used integer NOT NULL DEFAULT 0,
  units_used integer NOT NULL DEFAULT 0,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, environment)
);

GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.usage_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all usage"
  ON public.usage_counters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER t_usage_counters_updated
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_usage_counters_user ON public.usage_counters(user_id);

-- 2. Track completed purges so the day-15 deletion runs once
ALTER TABLE public.account_access
  ADD COLUMN IF NOT EXISTS files_purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

-- 3. Trial provisioning on email verification
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
     and lower(split_part(new.email, '@', 2)) = 'certifyiq.com' then
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
