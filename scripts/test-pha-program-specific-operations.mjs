import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828230000_pha_pbv_public_housing_operations.sql");
const pbvWaiting=read("supabase/migrations/20260828280000_pha_pbv_waiting_lists.sql");
const phOverIncome=read("supabase/migrations/20260828290000_pha_public_housing_over_income_notices.sql");
const phOverIncomeDeadlineFix=read("supabase/migrations/20260828291000_fix_pha_over_income_termination_deadline.sql");
const phAdmissions=read("supabase/migrations/20260828300000_pha_public_housing_admission_controls.sql");
const hcvLeaseUp=read("supabase/migrations/20260828310000_pha_hcv_lease_up.sql");
const phOccupancy=read("supabase/migrations/20260828320000_pha_public_housing_occupancy_transfers.sql");
const phOccupancyHardening=read("supabase/migrations/20260829160000_pha_public_housing_occupancy_completion.sql");
const workspace=read("src/components/pha-program-operations.tsx");
const phAdmissionsWorkspace=read("src/components/pha-public-housing-admissions-workspace.tsx");
const phAdmissionsRoute=read("src/routes/_authenticated/pha-public-housing-admissions.tsx");
const hcvLeaseUpWorkspace=read("src/components/pha-hcv-lease-up-workspace.tsx");
const hcvLeaseUpRoute=read("src/routes/_authenticated/pha-hcv-lease-up.tsx");
const phOccupancyWorkspace=read("src/components/pha-public-housing-occupancy-workspace.tsx");
const phOccupancyRoute=read("src/routes/_authenticated/pha-public-housing-occupancy.tsx");
const pbvWaitingWorkspace=read("src/components/pha-pbv-waiting-list-workspace.tsx");
const pbvWaitingRoute=read("src/routes/_authenticated/pha-pbv-waiting-lists.tsx");
const shell=read("src/components/app-shell.tsx");

test("PBV operations keep HAP rent and right-to-move controls separate from HCV portability",()=>{
  assert.match(migration,/pha_pbv_hap_contracts/); assert.match(migration,/pha_pbv_rent_actions/); assert.match(migration,/pha_pbv_move_requests/);
  assert.match(migration,/PBV move request requires a PBV family action/); assert.match(migration,/one_year_requirement_satisfied/); assert.match(migration,/vawa_emergency_transfer/); assert.match(migration,/PBV approved rent exceeds controlled rent limit/); assert.match(workspace,/24 CFR 983\.261/); assert.match(shell,/\/pha-pbv-operations/);
});

test("Public Housing operations control annual rent choice and the 24-month over-income process",()=>{
  assert.match(migration,/pha_public_housing_rent_elections/); assert.match(migration,/income_based/); assert.match(migration,/flat_rent/); assert.match(migration,/pha_public_housing_over_income_cases/); assert.match(migration,/consecutive_months >= 24/); assert.match(migration,/alternative_non_public_housing_rent/); assert.match(workspace,/24 CFR 960\.253/); assert.match(workspace,/24 CFR 960\.507/); assert.match(shell,/\/pha-public-housing-operations/);
});

test("program-specific navigation follows PHA agency role scope",()=>{assert.match(shell,/pbv_operations/);assert.match(shell,/ph_operations/);assert.match(shell,/hcv_pbv_specialist/);assert.match(shell,/public_housing_specialist/);});

test("PBV waiting lists support current HOTMA final-rule structures without reusing HCV list logic",()=>{assert.match(pbvWaiting,/central_pbv/);assert.match(pbvWaiting,/shared_hcv_pbv/);assert.match(pbvWaiting,/project_specific/);assert.match(pbvWaiting,/owner_maintained/);assert.match(pbvWaiting,/active validated Administrative Plan overlay/);assert.match(pbvWaiting,/PHA oversight procedures are required/);assert.match(pbvWaiting,/final_pha_eligibility_status/);assert.match(pbvWaiting,/TTP below gross rent/);assert.match(pbvWaiting,/tenant_based_list_protected/);});

test("owner-maintained PBV decisions preserve notice and informal-review controls",()=>{assert.match(pbvWaiting,/owner_preliminary_ineligible/);assert.match(pbvWaiting,/preference_denied/);assert.match(pbvWaiting,/informal_review_required/);assert.match(pbvWaiting,/remove_from_project_list/);assert.match(pbvWaiting,/admin_plan_controlled/);assert.match(pbvWaitingRoute,/PhaPbvWaitingListWorkspace/);assert.match(pbvWaitingWorkspace,/PBV Waiting Lists/);assert.match(pbvWaitingWorkspace,/PHA final/);});

test("Public Housing over-income notices enforce federal timing and hearing controls",()=>{assert.match(phOverIncome,/pha_public_housing_over_income_notices/);assert.match(phOverIncome,/notice_due_date:=new\.income_examination_date \+ 30/);assert.match(phOverIncome,/30-day federal notice deadline/);assert.match(phOverIncome,/Part 966 hearing right/);assert.match(phOverIncome,/twelve_month/);assert.match(phOverIncome,/twenty_four_month/);assert.match(phOverIncome,/State\/local notice-to-vacate authority reference/);});

test("alternative non-public housing lease uses the 60-day or earlier renewal deadline",()=>{assert.match(phOverIncome,/pha_public_housing_non_public_leases/);assert.match(phOverIncome,/n\.notice_issued_at::date \+ 60/);assert.match(phOverIncome,/next_lease_renewal_date < federal_due/);assert.match(phOverIncome,/24 CFR 960\.509 minimum lease provisions/);assert.match(phOverIncome,/retroactive alternative-rent difference due/);assert.match(phOverIncome,/termination_required/);assert.match(workspace,/Alternative-rent lease/);assert.match(workspace,/60 days/);});

test("Public Housing termination deadline is measured from the 24-month notice date",()=>{assert.match(phOverIncomeDeadlineFix,/notice_issued_at::date \+ interval '6 months'/);assert.match(phOverIncomeDeadlineFix,/cannot exceed six months after the 24-month notice/);assert.doesNotMatch(phOverIncomeDeadlineFix,/income_examination_date \+ interval '7 months'/);});

test("Public Housing final unit offers enforce targeting and development admission layers",()=>{assert.match(phAdmissions,/pha_public_housing_admission_year_controls/);assert.match(phAdmissions,/pha_public_housing_development_profiles/);assert.match(phAdmissions,/pha_public_housing_unit_offers/);assert.match(phAdmissions,/0\.40/);assert.match(phAdmissions,/hcv_excess_eli_admissions/);assert.match(phAdmissions,/qualifying_high_poverty_low_income_occupancies/);assert.match(phAdmissions,/deconcentration strategy/i);assert.match(phAdmissions,/designated_elderly/);assert.match(phAdmissions,/mixed_population/);assert.match(phAdmissions,/Accessible unit requires confirmation/);assert.match(phAdmissions,/two-or-more-bedroom Public Housing unit/);});

test("Public Housing admissions workspace is routed and role-scoped",()=>{assert.match(phAdmissionsRoute,/PhaPublicHousingAdmissionsWorkspace/);assert.match(phAdmissionsWorkspace,/Public Housing Admissions/);assert.match(phAdmissionsWorkspace,/40% annual targeting requirement/);assert.match(shell,/\/pha-public-housing-admissions/);assert.match(shell,/ph_operations/);});

test("HCV voucher and RFTA controls enforce voucher term and tenancy approval requirements",()=>{assert.match(hcvLeaseUp,/pha_hcv_vouchers/);assert.match(hcvLeaseUp,/pha_hcv_rfta_requests/);assert.match(hcvLeaseUp,/RFTA must be submitted during the voucher term/);assert.match(hcvLeaseUp,/lease copy and HUD tenancy addendum/);assert.match(hcvLeaseUp,/rent reasonableness/);assert.match(hcvLeaseUp,/40 percent of monthly adjusted income/);assert.match(hcvLeaseUp,/controlled initial inspection clearance/);});

test("HCV HAP execution blocks payment until a timely or HUD-approved contract exists",()=>{assert.match(hcvLeaseUp,/pha_hcv_hap_contracts/);assert.match(hcvLeaseUp,/execution_deadline:=new\.lease_start\+60/);assert.match(hcvLeaseUp,/hud_extension_requested_at/);assert.match(hcvLeaseUp,/hud_extension_approved/);assert.match(hcvLeaseUp,/payment_authorized:=true/);assert.match(hcvLeaseUpWorkspace,/HCV Lease-Up/);assert.match(hcvLeaseUpWorkspace,/60 calendar days/);assert.match(hcvLeaseUpRoute,/PhaHcvLeaseUpWorkspace/);assert.match(shell,/\/pha-hcv-lease-up/);});

test("Public Housing occupancy and transfer controls preserve lease and grievance protections",()=>{
  assert.match(phOccupancy,/pha_public_housing_leases/); assert.match(phOccupancy,/pha_public_housing_transfers/); assert.match(phOccupancy,/24 CFR 966\.4 required lease provisions/); assert.match(phOccupancy,/applicable grievance procedure/); assert.match(phOccupancy,/Family-composition transfer requires an available appropriate-size dwelling unit/); assert.match(phOccupancy,/Adverse transfer requires specific-ground notice/); assert.match(phOccupancy,/cannot take effect before the grievance request period/); assert.match(phOccupancy,/accommodation request is approved/); assert.match(phOccupancyWorkspace,/Public Housing Occupancy & Transfers/); assert.match(phOccupancyRoute,/PhaPublicHousingOccupancyWorkspace/); assert.match(shell,/\/pha-public-housing-occupancy/);
  assert.match(phOccupancyHardening,/specific_reasons/); assert.match(phOccupancyHardening,/adverse_action_notice_id/); assert.match(phOccupancyHardening,/lease_document_reference/); assert.match(phOccupancyHardening,/tenant_signed_at/); assert.match(phOccupancyHardening,/Transfer ground must match/); assert.match(phOccupancyHardening,/requested_status='completed'/);
  assert.match(phOccupancyWorkspace,/useMutation/); assert.match(phOccupancyWorkspace,/Execute controlled lease/); assert.match(phOccupancyWorkspace,/Create transfer/); assert.match(phOccupancyWorkspace,/role="alert"/);
});
