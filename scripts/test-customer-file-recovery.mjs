import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCustomerFileRecoveryPlan,
  confirmCustomerFileRecovery,
  verifyCustomerFileRecoveryCopy,
} from "../src/lib/customer-file-recovery.mjs";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const SHA = "a".repeat(64);

function plan() {
  return buildCustomerFileRecoveryPlan({
    userId: USER,
    requestId: REQUEST,
    bucket: "certification-imports",
    sourcePath: `${USER}/job-1/tenant-file.pdf`,
    sourceSha256: SHA,
    sourceByteSize: 4096,
  });
}

test("recovery is copy-only, collision-resistant, and never deletes source", () => {
  const value = plan();
  assert.equal(value.mode, "copy_only");
  assert.equal(value.overwriteAllowed, false);
  assert.equal(value.sourceDeletionAllowed, false);
  assert.match(value.targetPath, new RegExp(`^${USER}/recovery/${REQUEST}/${SHA}/`));
});

test("cross-tenant paths and integrity mismatches fail closed", () => {
  assert.throws(
    () => buildCustomerFileRecoveryPlan({
      userId: USER, requestId: REQUEST, bucket: "certification-imports",
      sourcePath: `${OTHER}/job-1/file.pdf`, sourceSha256: SHA, sourceByteSize: 1,
    }),
    /cross_tenant/,
  );
  assert.throws(
    () => verifyCustomerFileRecoveryCopy(plan(), {
      targetPath: plan().targetPath, sha256: "b".repeat(64), byteSize: 4096,
      targetExistedBeforeCopy: false, verifiedAt: new Date().toISOString(),
    }),
    /checksum/,
  );
});

test("existing targets cannot be overwritten", () => {
  assert.throws(
    () => verifyCustomerFileRecoveryCopy(plan(), {
      targetPath: plan().targetPath, sha256: SHA, byteSize: 4096,
      targetExistedBeforeCopy: true, verifiedAt: new Date().toISOString(),
    }),
    /collision/,
  );
});

test("owner confirms only a checksum- and size-verified copy", () => {
  const verified = verifyCustomerFileRecoveryCopy(plan(), {
    targetPath: plan().targetPath, sha256: SHA, byteSize: 4096,
    targetExistedBeforeCopy: false, verifiedAt: "2026-08-29T02:00:00Z",
  });
  assert.equal(verified.status, "copy_verified");
  assert.throws(
    () => confirmCustomerFileRecovery(verified, {
      userId: OTHER, confirmed: true, confirmedAt: "2026-08-29T02:01:00Z",
    }),
    /owner_confirmation/,
  );
  const confirmed = confirmCustomerFileRecovery(verified, {
    userId: USER, confirmed: true, confirmedAt: "2026-08-29T02:01:00Z",
  });
  assert.equal(confirmed.status, "owner_confirmed");
  assert.equal(confirmed.sourceDeletionAllowed, false);
});

test("storage migration removes the permissive bypass and constrains evidence", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260829060000_harden_customer_file_storage.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /drop policy if exists "users manage own certification imports"/);
  assert.match(migration, /file_size_limit = 52428800/);
  assert.match(migration, /application\/pdf/);
  assert.match(migration, /bucket_public is distinct from false/);
});
