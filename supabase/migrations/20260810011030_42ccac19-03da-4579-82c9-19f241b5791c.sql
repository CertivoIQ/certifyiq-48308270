DROP POLICY IF EXISTS "Owners grant access to their own submissions" ON public.hfa_submission_grants;
CREATE POLICY "Owners grant access to their own submissions"
ON public.hfa_submission_grants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.hfa_submissions s
    WHERE s.id = public.hfa_submission_grants.submission_id
      AND s.owner_user_id = auth.uid()
      AND public.hfa_submission_grants.agency_id = s.agency_id
  )
);