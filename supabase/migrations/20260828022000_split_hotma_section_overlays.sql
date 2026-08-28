-- Correct HOTMA applicability granularity.
-- Section 102 applies broadly to covered PIH and MFH programs.
-- Section 103 applies only to Public Housing.
-- Section 104 MFH asset limits apply only to Section 8 PBRA and Section 202/8;
-- PIH programs remain subject to Sections 102 and 104 subject to cohort/deadline routing.

create or replace function public.derive_workspace_overlays(programs text[], pha_programs text[] default '{}')
returns text[] language sql immutable as $$
  select array_remove(array[
    case when programs && array[
      'section8_pbra','section202_8','section202_811_prac','section811_pra','section236_irp','sprac'
    ]::text[]
      or pha_programs && array['hcv','pbv','public_housing','mod_rehab']::text[]
      then 'hotma_102' end,
    case when pha_programs && array['public_housing']::text[]
      then 'hotma_103' end,
    case when programs && array['section8_pbra','section202_8']::text[]
      or pha_programs && array['hcv','pbv','public_housing','mod_rehab']::text[]
      then 'hotma_104' end,
    case when programs && array[
      'section8_pbra','section202_8','section202_811_prac','section811_pra','section236_irp','sprac'
    ]::text[]
      then 'hud_multifamily' end,
    case when programs && array[
      'section8_pbra','section202_8','section202_811_prac','section811_pra','section236_irp','sprac'
    ]::text[]
      then 'tracs' end,
    case when programs && array['lihtc']::text[]
      then 'state_lihtc' end
  ], null);
$$;

-- Recalculate stored overlays immediately after replacing the derivation function.
update public.customer_workspace_profiles
set derived_overlays = public.derive_workspace_overlays(selected_programs, pha_programs),
    updated_at = now();
