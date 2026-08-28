import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828230000_pha_pbv_public_housing_operations.sql");
const pbvWaiting=read("supabase/migrations/20260828280000_pha_pbv_waiting_lists.sql");
const phOverIncome=read("supabase/migrations/20260828290000_pha_public_housing_over_income_notices.sql");
const workspace=read("src/components/pha-program-operations.tsx");
const pbvWaitingWorkspace=read("src/components/pha-pbv-waiting-list-workspace.tsx");
const pbvWaitingRoute=read("src/routes/_authenticated/pha-pbv-waiting-lists.tsx");
const shell=read("src/components/app-shell.tsx");

test("PBV operations keep HAP rent and right-to-move controls separate from HCV portability",()=>{
  assert.match(migration,/pha_pbv_hap_contracts/);
  assert.match(migration,/pha_pbv_rent_actions/);
  assert.match(migration,/pha_pbv_move_requests/);
  assert.match(migration,/PBV move request requires a PBV family action/);
  assert.match(migration,/one_year_requirement_satisfied/);
  assert.match(migration,/vawa_emergency_transfer/);
  assert.match(migration,/PBV approved rent exceeds controlled rent limit/);
  assert.match(workspace,/24 CFR 983\.261/);
  assert.match(shell,/\/pha-pbv-operations/);
});

test("Public Housing operations control annual rent choice and the 24-month over-income process",()=>{
  assert.match(migration,/pha_public_housing_rent_elections/);
  assert.match(migration,/income_based/);
  assert.match(migration,/flat_rent/);
  assert.match(migration,/pha_public_housing_over_income_cases/);
  assert.match(migration,/consecutive_months >= 24/);
  assert.match(migration,/alternative_non_public_housing_rent/);
  assert.match(workspace,/24 CFR 960\.253/);
  assert.match(workspace,/24 CFR 960\.507/);
  assert.match(shell,/\/pha-public-housing-operations/);
});

test("program-specific navigation follows PHA agency role scope",()=>{
  assert.match(shell,/pbv_operations/);
  assert.match(shell,/ph_operations/);
  assert.match(shell,/hcv_pbv_specialist/);
  assert.match(shell,/public_housing_specialist/);
});

test("PBV waiting lists support current HOTMA final-rule structures without reusing HCV list logic",()=>{
  assert.match(pbvWaiting,/central_pbv/);
  assert.match(pbvWaiting,/shared_hcv_pbv/);
  assert.match(pbvWaiting,/project_specific/);
  assert.match(pbvWaiting,/owner_maintained/);
  assert.match(pbvWaiting,/active validated Administrative Plan overlay/);
  assert.match(pbvWaiting,/PHA oversight procedures are required/);
  assert.match(pbvWaiting,/final_pha_eligibility_status/);
  assert.match(pbvWaiting,/TTP below gross rent/);
  assert.match(pbvWaiting,/tenant_based_list_protected/);
});

test("owner-maintained PBV decisions preserve notice and informal-review controls",()=>{
  assert.match(pbvWaiting,/owner_preliminary_ineligible/);
  assert.match(pbvWaiting,/preference_denied/);
  assert.match(pbvWaiting,/informal_review_required/);
  assert.match(pbvWaiting,/remove_from_project_list/);
  assert.match(pbvWaiting,/admin_plan_controlled/);
  assert.match(pbvWaitingRoute,/PhaPbvWaitingListWorkspace/);
  assert.match(pbvWaitingWorkspace,/PBV Waiting Lists/);
  assert.match(pbvWaitingWorkspace,/PHA final/);
});

test("Public Housing over-income notices enforce federal timing and hearing controls",()=>{
  assert.match(phOverIncome,/pha_public_housing_over_income_notices/);
  assert.match(phOverIncome,/notice_due_date:=new\.income_examination_date \+ 30/);
  assert.match(phOverIncome,/30-day federal notice deadline/);
  assert.match(phOverIncome,/Part 966 hearing right/);
  assert.match(phOverIncome,/twelve_month/);
  assert.match(phOverIncome,/twenty_four_month/);
  assert.match(phOverIncome,/State\/local notice-to-vacate authority reference/);
});

test("alternative non-public housing lease uses the 60-day or earlier renewal deadline",()=>{
  assert.match(phOverIncome,/pha_public_housing_non_public_leases/);
  assert.match(phOverIncome,/n\.notice_issued_at::date \+ 60/);
  assert.match(phOverIncome,/next_lease_renewal_date < federal_due/);
  assert.match(phOverIncome,/24 CFR 960\.509 minimum lease provisions/);
  assert.match(phOverIncome,/retroactive alternative-rent difference due/);
  assert.match(phOverIncome,/termination_required/);
  assert.match(workspace,/Alternative-rent lease/);
  assert.match(workspace,/60 days/);
});
