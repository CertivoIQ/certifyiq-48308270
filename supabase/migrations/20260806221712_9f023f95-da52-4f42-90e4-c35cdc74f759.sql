CREATE TABLE public.user_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_recovery_codes TO authenticated;
GRANT ALL ON public.user_recovery_codes TO service_role;

ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recovery codes" ON public.user_recovery_codes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER t_user_recovery_codes_updated
  BEFORE UPDATE ON public.user_recovery_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();