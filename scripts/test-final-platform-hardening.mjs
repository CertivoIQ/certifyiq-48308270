import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
}

const structuralMigration = await read(
  "supabase/migrations/20260910200500_revoke_client_structural_privileges.sql",
);
const storageAssurance = await read(
  "supabase/migrations/20260910155107_enforce_enrolled_mfa_access.sql",
);
const recoveryBoundary = await read(
  "supabase/migrations/20260910035616_harden_mfa_recovery_code_writes.sql",
);
const complianceWorkflow = await read(".github/workflows/compliance-intelligence.yml");
const releaseWorkflow = await read(".github/workflows/native-income-calculator-release.yml");
const launchWorkflow = await read(".github/workflows/multifamily-launch.yml");
const candidateWorkflow = await read(".github/workflows/cloudflare-candidate-deploy.yml");

test("removes client structural privileges without removing RLS data-plane grants", () => {
  assert.match(
    structuralMigration,
    /revoke truncate, references, trigger on all tables in schema public from anon, authenticated/i,
  );
  assert.match(
    structuralMigration,
    /revoke truncate, references, trigger on all tables in schema storage from anon, authenticated/i,
  );
  assert.match(structuralMigration, /alter default privileges in schema public/i);
  assert.doesNotMatch(structuralMigration, /revoke\s+(select|insert|update|delete)/i);
});

test("keeps Storage assurance restrictive and recovery credentials server-written", () => {
  assert.match(
    storageAssurance,
    /create policy "Authenticated storage requires current session assurance"[\s\S]*?as restrictive for all to authenticated/i,
  );
  assert.match(recoveryBoundary, /revoke insert, update, delete[\s\S]*?user_recovery_codes[\s\S]*?from public, anon, authenticated/i);
  assert.doesNotMatch(recoveryBoundary, /grant\s+(insert|update|delete)[\s\S]*?user_recovery_codes[\s\S]*?to (anon|authenticated)/i);
});

test("keeps security, billing, upload, audit, and release regressions in the full suite", () => {
  for (const required of [
    "test-privileged-rpc-surface.mjs",
    "test-authenticated-security-definer-hardening.mjs",
    "test-customer-file-recovery.mjs",
    "test-mfa-enforcement.mjs",
    "test-mfa-recovery-boundary.mjs",
    "test-session-assurance.mjs",
    "test-paid-license-database-integrity.mjs",
    "test-stripe-webhook-security.ts",
    "test-stripe-webhook-fail-closed.mjs",
    "test-audit-replay.mjs",
    "test-auditor-workspace.mjs",
  ]) {
    assert.match(complianceWorkflow, new RegExp(required.replaceAll(".", "\\.")));
  }
  for (const workflow of [complianceWorkflow, releaseWorkflow, launchWorkflow, candidateWorkflow]) {
    assert.match(workflow, /^permissions:\s*\n\s+contents:\s+read\s*$/m);
    assert.doesNotMatch(workflow, /pull_request_target\s*:/);
  }
});

test("emits and live-verifies the approved Permissions Policy", async () => {
  for (const relative of [
    "public/_headers",
    "src/start.ts",
    "src/server.ts",
    "scripts/verify-cloudflare-live-response.mjs",
  ]) {
    const contents = await read(relative);
    for (const directive of ["camera=()", "microphone=()", "geolocation=()", "usb=()"]) {
      assert.ok(contents.includes(directive), `${relative} is missing ${directive}`);
    }
  }
});

test("does not use pull_request_target or contain high-confidence plaintext secrets", async () => {
  const workflowDir = new URL(".github/workflows/", root);
  for (const file of await walk(workflowDir)) {
    if (!/\.ya?ml$/i.test(file.pathname)) continue;
    assert.doesNotMatch(await readFile(file, "utf8"), /pull_request_target\s*:/, file);
  }

  const scanRoots = ["src", "scripts", "supabase/functions", ".github/workflows"];
  const secretPatterns = [
    /sk_live_[A-Za-z0-9]{16,}/,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ];
  for (const relative of scanRoots) {
    for (const file of await walk(new URL(relative + "/", root))) {
      const contents = await readFile(file, "utf8").catch(() => "");
      for (const pattern of secretPatterns) assert.doesNotMatch(contents, pattern, file);
    }
  }
});
