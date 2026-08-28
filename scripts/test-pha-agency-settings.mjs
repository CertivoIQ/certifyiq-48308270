import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260828260000_pha_agency_settings_integrations.sql");
const workspace=read("src/components/pha-agency-settings-workspace.tsx");
const route=read("src/routes/_authenticated/pha-agency-settings.tsx");
const shell=read("src/components/app-shell.tsx");

test("agency settings are workspace scoped and admin managed",()=>{assert.match(migration,/pha_agency_settings/);assert.match(migration,/PHA admins manage agency settings/);assert.match(migration,/escalation_only/);});
test("integrations fail closed until explicitly validated",()=>{assert.match(migration,/pha_integration_profiles/);assert.match(migration,/Validated integration requires connection reference and validation record/);assert.match(migration,/not_configured/);assert.match(migration,/blocked/);});
test("agency settings workspace is routed and admin navigated",()=>{assert.match(route,/PhaAgencySettingsWorkspace/);assert.match(workspace,/Agency Settings & Integrations/);assert.match(workspace,/pha_integration_profiles/);assert.match(shell,/\/pha-agency-settings/);});
