-- 1) Trigger-only SECURITY DEFINER / helper functions must not be callable by API roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role() is intentionally executable by authenticated: RLS policies across the
-- schema call it as the requesting user, and it already restricts callers to
-- probing their own roles unless they are staff.

-- 2) profiles: allow a signed-in user to create ONLY their own profile row.
GRANT INSERT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);