CREATE SEQUENCE public.support_case_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_support_case_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SC-' || nextval('public.support_case_number_seq')::text;
$$;

CREATE TABLE public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE DEFAULT public.generate_support_case_number(),
  account_id uuid REFERENCES public.crm_accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_email text,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  channel text NOT NULL DEFAULT 'email',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_response_at timestamp with time zone,
  tags text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_cases TO authenticated;
GRANT ALL ON public.support_cases TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.support_case_number_seq TO authenticated;

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage support cases"
ON public.support_cases
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'staff'));

CREATE TABLE public.support_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  note text NOT NULL,
  internal boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_case_notes TO authenticated;
GRANT ALL ON public.support_case_notes TO service_role;

ALTER TABLE public.support_case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage support case notes"
ON public.support_case_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER t_support_cases_updated
BEFORE UPDATE ON public.support_cases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER t_support_case_notes_updated
BEFORE UPDATE ON public.support_case_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();