import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260828100000_pha_authoritative_control_state.sql", import.meta.url), "utf8");
const familyMigration = readFileSync(new URL("../supabase/migrations/20260828050000_pha_family_reexamination_workflow.sql", import.meta.url), "utf8");
const consoleRoute = readFileSync(new URL("../src/routes/_authenticated/crm-pha-controls.tsx", import.meta.url), "utf8");
const crmShell = readFileSync(new URL("../src/components/crm/crm-shell.tsx", import.meta.url), "utf8");

test("PHA operational authority is staff governed and tenant readable", () => {
  assert.match(migration, /pha_authoritative_control_state/);
  assert.match(migration, /Staff manage PHA authoritative controls/);
  assert.match(migration, /public\.has_role\(auth\.uid\(\), 'staff'\)/);
  assert.match(migration, /PHA users read own authoritative controls/);
  assert.doesNotMatch(migration, /for all to authenticated\s+using \(user_id = auth\.uid\(\)\)/);
});

test("program applicability and reporting path derive from the PHA workspace profile", () => {
  assert.match(migration, /workspace\.organization_type = 'pha'/);
  assert.match(migration, /new\.program_code = any\(workspace\.pha_programs\)/);
  assert.match(migration, /workspace\.hud_50058_reporting_path is not null/);
  assert.match(migration, /new\.program_applicability_validated :=/);
  assert.match(migration, /new\.reporting_path_validated :=/);
});

test("source rule HOTMA and software controls fail closed without authoritative state", () => {
  assert.match(migration, /control_found and control\.source_release_status = 'approved'/);
  assert.match(migration, /control_found and control\.rule_version_status = 'current'/);
  assert.match(migration, /control_found and control\.hotma_policy_status in \('validated','not_applicable'\)/);
  assert.match(migration, /control_found and control\.software_compatibility_status = 'validated'/);
  assert.match(migration, /new\.source_status_conflict := control_found and control\.source_status_conflict/);
});

test("manual transaction booleans are overwritten on family and HUD-50058 writes", () => {
  for (const field of [
    "program_applicability_validated",
    "controlled_source_release_approved",
    "current_rule_version_validated",
    "full_hotma_policy_set_validated",
    "reporting_path_validated",
    "software_compatibility_validated",
  ]) {
    assert.match(familyMigration, new RegExp(field));
    assert.match(migration, new RegExp(`new\\.${field} :=`));
  }
  assert.match(migration, /before insert or update on public\.pha_family_actions/);
  assert.match(migration, /before insert or update on public\.pha_50058_transactions/);
});

test("workspace or authoritative-control changes refresh existing snapshots", () => {
  assert.match(migration, /refresh_pha_authoritative_control_snapshots/);
  assert.match(migration, /after insert or update or delete on public\.pha_authoritative_control_state/);
  assert.match(migration, /after insert or update of organization_type, pha_programs, hud_50058_reporting_path/);
  assert.match(migration, /Missing control records intentionally fail closed/);
});

test("staff PHA control console manages only the authoritative control record", () => {
  assert.match(consoleRoute, /PHA Control Console/);
  assert.match(consoleRoute, /useIsStaff/);
  assert.match(consoleRoute, /pha_authoritative_control_state/);
  assert.match(consoleRoute, /customer_workspace_profiles/);
  assert.match(consoleRoute, /source_release_status/);
  assert.match(consoleRoute, /rule_version_status/);
  assert.match(consoleRoute, /hotma_policy_status/);
  assert.match(consoleRoute, /reporting_path_status/);
  assert.match(consoleRoute, /software_compatibility_status/);
  assert.match(consoleRoute, /validated_by: user\?\.id/);
  assert.doesNotMatch(consoleRoute, /program_applicability_validated\s*:/);
  assert.doesNotMatch(consoleRoute, /controlled_source_release_approved\s*:/);
  assert.doesNotMatch(consoleRoute, /current_rule_version_validated\s*:/);
  assert.doesNotMatch(consoleRoute, /full_hotma_policy_set_validated\s*:/);
  assert.doesNotMatch(consoleRoute, /reporting_path_validated\s*:/);
  assert.doesNotMatch(consoleRoute, /software_compatibility_validated\s*:/);
});

test("internal CRM navigation exposes the PHA control console", () => {
  assert.match(crmShell, /\/crm-pha-controls/);
  assert.match(crmShell, /PHA Controls/);
});
