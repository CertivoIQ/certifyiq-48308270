import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260904165332_harden_authenticated_security_definer_functions.sql",
    import.meta.url,
  ),
  "utf8",
);

const functions = [
  "accept_pha_workspace_invitation",
  "activate_state_rule_pack",
  "approve_certification_final",
  "approve_state_rule_release_candidate",
  "build_pha_family_evidence_manifest",
  "certification_task_queue",
  "create_state_rule_source_candidate",
  "current_pha_workspace_user_id",
  "is_pha_workspace_owner",
  "pha_family_access",
  "pha_program_access",
  "pha_workspace_admin_access",
  "prepare_pha_50058_submission",
  "record_pha_50058_submission_event",
  "resolve_certification_finding",
  "review_state_rule_source_candidate",
  "select_next_pha_waiting_list_applicant",
  "state_rule_pack_activation_readiness",
  "state_rule_release_readiness",
];

test("all reviewed elevated functions move behind invoker-safe public wrappers", () => {
  for (const name of functions) {
    assert.match(
      migration,
      new RegExp("alter function public\\." + name + "\\([^;]*\\) set schema private", "i"),
      name + " must move out of public",
    );
    assert.match(
      migration,
      new RegExp("function public\\." + name + "\\([^]*?security invoker", "i"),
      name + " must expose only an invoker wrapper",
    );
  }
  assert.equal(
    (migration.match(/security invoker/gim) ?? []).length,
    functions.length,
  );
});

test("all private implementations use an empty search path and explicit grants", () => {
  for (const name of functions) {
    assert.match(
      migration,
      new RegExp(
        "alter function private\\." + name + "\\([^;]*\\) set search_path = ''",
        "i",
      ),
    );
  }
  assert.match(migration, /revoke all on schema private from public, anon/i);
  assert.match(migration, /grant usage on schema private to authenticated, service_role/i);
  assert.match(migration, /Expected 19 hardened private implementations/i);
});

test("PHA invitation acceptance requires a confirmed auth user email", () => {
  assert.match(migration, /signed_in_user auth\.users%rowtype/i);
  assert.match(migration, /from auth\.users where id = auth\.uid\(\)/i);
  assert.match(migration, /signed_in_user\.email_confirmed_at is null/i);
  assert.match(migration, /lower\(coalesce\(signed_in_user\.email, ''\)\)/i);
  assert.doesNotMatch(migration, /auth\.jwt\(\) ->> 'email'/i);
});

test("future public functions require explicit client execute grants", () => {
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public[\s\S]*revoke execute on functions from public, anon, authenticated/i,
  );
});

test("migration fails closed if any authenticated public definer remains", () => {
  assert.match(migration, /exposed_authenticated_definers/i);
  assert.match(migration, /has_function_privilege\('authenticated', p\.oid, 'execute'\)/i);
  assert.match(migration, /Authenticated SECURITY DEFINER functions remain in public/i);
});
