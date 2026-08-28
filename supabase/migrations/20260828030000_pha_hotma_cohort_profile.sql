-- PHA HOTMA implementation routing inputs.
-- These fields do not decide compliance by themselves; they feed the existing
-- deterministic PHA HOTMA implementation engine, which retains authority over
-- cohort, date, program, and HUD-50058 reporting-path classification.

alter table public.customer_workspace_profiles
  add column if not exists pha_hotma_cohort text,
  add column if not exists hud_50058_reporting_path text;

alter table public.customer_workspace_profiles
  drop constraint if exists customer_workspace_profiles_pha_hotma_cohort_check;
alter table public.customer_workspace_profiles
  add constraint customer_workspace_profiles_pha_hotma_cohort_check
  check (pha_hotma_cohort is null or pha_hotma_cohort in (
    'NON_MTW_NON_FRS', 'INITIAL_MTW', 'MTW_EXPANSION', 'FRS_EXCLUSIVE'
  ));

alter table public.customer_workspace_profiles
  drop constraint if exists customer_workspace_profiles_hud_50058_reporting_path_check;
alter table public.customer_workspace_profiles
  add constraint customer_workspace_profiles_hud_50058_reporting_path_check
  check (hud_50058_reporting_path is null or hud_50058_reporting_path in (
    'HUD_50058_2024', 'HUD_50058_2020_ALTERNATIVE'
  ));

comment on column public.customer_workspace_profiles.pha_hotma_cohort is
  'PHA HOTMA implementation cohort used by the deterministic cohort/deadline routing engine.';
comment on column public.customer_workspace_profiles.hud_50058_reporting_path is
  'Declared HUD-50058 reporting path used by the deterministic HOTMA reporting-path gate.';
