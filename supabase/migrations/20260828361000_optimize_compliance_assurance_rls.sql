-- Cache the authenticated user identity once per statement for reviewer update policies.
-- This preserves the same Admin/Manager authorization while avoiding per-row auth
-- function evaluation reported by the Supabase performance advisor.

alter policy "reviewers update assurance cases"
on public.compliance_assurance_cases
using ((select private.certivoiq_assurance_reviewer((select auth.uid()))))
with check ((select private.certivoiq_assurance_reviewer((select auth.uid()))));

alter policy "reviewers update regulatory reviews"
on public.compliance_regulatory_reviews
using ((select private.certivoiq_assurance_reviewer((select auth.uid()))))
with check ((select private.certivoiq_assurance_reviewer((select auth.uid()))));

alter policy "reviewers update remediation actions"
on public.compliance_remediation_actions
using ((select private.certivoiq_assurance_reviewer((select auth.uid()))))
with check ((select private.certivoiq_assurance_reviewer((select auth.uid()))));
