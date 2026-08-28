import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828180000_pha_reasonable_accommodations.sql");
const workspace=read("src/components/pha-reasonable-accommodation-workspace.tsx");
const route=read("src/routes/_authenticated/pha-accommodations.tsx");
const shell=read("src/components/app-shell.tsx");

test("reasonable accommodation requests are cross-cutting and program scoped",()=>{
 assert.match(migration,/pha_reasonable_accommodation_requests/);
 assert.match(migration,/waiting_list_applicant_id/);
 assert.match(migration,/inspection_id/);
 assert.match(migration,/family_action_id/);
 assert.match(migration,/PHA users write reasonable accommodations/);
});

test("denials and effective communication fail closed",()=>{
 assert.match(migration,/Denied accommodation requires a documented reason/);
 assert.match(migration,/alternative accommodation/);
 assert.match(migration,/Effective communication format is required/);
 assert.match(migration,/undue_burden_or_fundamental_alteration/);
});

test("open accommodation review protects waiting-list applicants",()=>{
 assert.match(migration,/sync_pha_waiting_list_accommodation_hold/);
 assert.match(migration,/reasonable_accommodation_review_required/);
 assert.match(migration,/received','interactive_process/);
});

test("PHA accommodation workspace is live and role navigated",()=>{
 assert.match(route,/PhaReasonableAccommodationWorkspace/);
 assert.match(workspace,/Reasonable Accommodations/);
 assert.match(workspace,/Effective communication required/);
 assert.match(workspace,/Record request/);
 assert.match(shell,/\/pha-accommodations/);
 assert.match(shell,/Reasonable Accommodations/);
});
