import { basename } from "node:path";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export function buildCustomerFileRecoveryPlan(input) {
  const {
    userId,
    requestId,
    bucket,
    sourcePath,
    sourceSha256,
    sourceByteSize,
  } = input;
  if (!UUID.test(userId) || !UUID.test(requestId)) throw new Error("invalid_recovery_identity");
  if (!["certification-imports", "correction-evidence"].includes(bucket)) {
    throw new Error("unsupported_recovery_bucket");
  }
  if (!sourcePath.startsWith(`${userId}/`) || sourcePath.includes("/../")) {
    throw new Error("cross_tenant_or_unsafe_source_path");
  }
  if (!SHA256.test(sourceSha256) || !Number.isSafeInteger(sourceByteSize) || sourceByteSize <= 0) {
    throw new Error("invalid_source_integrity_record");
  }

  const fileName = basename(sourcePath);
  const targetPath = [
    userId,
    "recovery",
    requestId,
    sourceSha256,
    fileName,
  ].join("/");

  return Object.freeze({
    requestId,
    userId,
    bucket,
    sourcePath,
    targetPath,
    expectedSha256: sourceSha256,
    expectedByteSize: sourceByteSize,
    mode: "copy_only",
    overwriteAllowed: false,
    sourceDeletionAllowed: false,
    ownerConfirmationRequired: true,
    status: "copy_pending",
  });
}

export function verifyCustomerFileRecoveryCopy(plan, observed) {
  if (plan.mode !== "copy_only" || plan.overwriteAllowed || plan.sourceDeletionAllowed) {
    throw new Error("destructive_recovery_plan_rejected");
  }
  if (observed.targetExistedBeforeCopy) throw new Error("recovery_target_collision");
  if (observed.targetPath !== plan.targetPath) throw new Error("recovery_target_mismatch");
  if (observed.sha256 !== plan.expectedSha256) throw new Error("recovery_checksum_mismatch");
  if (observed.byteSize !== plan.expectedByteSize) throw new Error("recovery_size_mismatch");

  return Object.freeze({
    ...plan,
    status: "copy_verified",
    verifiedAt: observed.verifiedAt,
    sourceDeletionAllowed: false,
  });
}

export function confirmCustomerFileRecovery(plan, confirmation) {
  if (plan.status !== "copy_verified") throw new Error("verified_copy_required");
  if (confirmation.userId !== plan.userId || confirmation.confirmed !== true) {
    throw new Error("owner_confirmation_required");
  }
  return Object.freeze({
    ...plan,
    status: "owner_confirmed",
    ownerConfirmedAt: confirmation.confirmedAt,
    sourceDeletionAllowed: false,
  });
}
