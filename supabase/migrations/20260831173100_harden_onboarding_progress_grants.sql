-- Align the committed LaunchPad table with current Data API least-privilege defaults.
revoke all on table public.customer_onboarding_progress from anon, authenticated, service_role;
grant select, insert, update on table public.customer_onboarding_progress to authenticated;
grant all on table public.customer_onboarding_progress to service_role;
