ALTER TABLE public.crm_accounts
  ADD COLUMN IF NOT EXISTS states text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS properties integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS programs text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS corporate_email text,
  ADD COLUMN IF NOT EXISTS territory text,
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_on date,
  ADD COLUMN IF NOT EXISTS next_followup_on date,
  ADD COLUMN IF NOT EXISTS responded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS crm_accounts_territory_idx ON public.crm_accounts (territory);
CREATE INDEX IF NOT EXISTS crm_accounts_next_followup_idx ON public.crm_accounts (next_followup_on);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'email',
  subject text,
  body text,
  outcome text,
  actor_email text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage activities" ON public.crm_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE INDEX IF NOT EXISTS crm_activities_account_idx ON public.crm_activities (account_id, created_at DESC);