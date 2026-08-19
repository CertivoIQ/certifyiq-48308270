import { createHash } from "node:crypto";

export const DELIVERY_STATUS = Object.freeze({
  delivered: "DELIVERED",
  rejected: "REJECTED",
  invalidReceipt: "INVALID_RECEIPT",
  tamperedReceipt: "TAMPERED_RECEIPT",
  duplicate: "DUPLICATE_DELIVERY",
});

export function receiptSha256(receipt) {
  if (!receipt) return null;

  const canonical = JSON.stringify({
    receiptId: receipt.receiptId ?? null,
    submissionId: receipt.submissionId ?? null,
    agencyId: receipt.agencyId ?? null,
    manifestSha256: receipt.manifestSha256 ?? null,
    accepted: receipt.accepted ?? null,
    deliveredAt: receipt.deliveredAt ?? null,
  });

  return createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
}

export function validateDeliveryReceipt({
  submissionId,
  agencyId,
  manifestSha256,
  adapter,
  receipt,
  priorReceipts = [],
} = {}) {
  if (
    !submissionId ||
    !agencyId ||
    !manifestSha256 ||
    !adapter ||
    !receipt
  ) {
    return {
      status: DELIVERY_STATUS.invalidReceipt,
      externallyDelivered: false,
      reason:
        "Submission, destination, manifest, adapter, and receipt are required.",
    };
  }

  if (
    !receipt.receiptId ||
    !receipt.deliveredAt ||
    receipt.accepted !== true
  ) {
    return {
      status: DELIVERY_STATUS.invalidReceipt,
      externallyDelivered: false,
      reason:
        "The transport did not return a verifiable successful delivery receipt.",
    };
  }

  if (
    receipt.submissionId !== submissionId ||
    receipt.agencyId !== agencyId ||
    receipt.manifestSha256 !== manifestSha256
  ) {
    return {
      status: DELIVERY_STATUS.invalidReceipt,
      externallyDelivered: false,
      reason:
        "The transport receipt does not match the authorized submission package.",
    };
  }

  const computedReceiptSha256 = receiptSha256(receipt);

  if (
    receipt.integritySha256 &&
    receipt.integritySha256 !== computedReceiptSha256
  ) {
    return {
      status: DELIVERY_STATUS.tamperedReceipt,
      externallyDelivered: false,
      receiptId: receipt.receiptId,
      reason:
        "The transport receipt integrity hash does not match the receipt contents.",
    };
  }

  const priorSameReceiptId = priorReceipts.find(
    (existing) =>
      existing.receiptId === receipt.receiptId,
  );

  if (
    priorSameReceiptId?.receiptSha256 &&
    priorSameReceiptId.receiptSha256 !== computedReceiptSha256
  ) {
    return {
      status: DELIVERY_STATUS.tamperedReceipt,
      externallyDelivered: false,
      receiptId: receipt.receiptId,
      expectedReceiptSha256:
        priorSameReceiptId.receiptSha256,
      computedReceiptSha256,
      reason:
        "A previously recorded receipt id now has different receipt contents.",
    };
  }

  const duplicate = priorReceipts.find(
    (existing) =>
      existing.submissionId === submissionId &&
      existing.agencyId === agencyId &&
      existing.manifestSha256 === manifestSha256 &&
      existing.adapter === adapter &&
      existing.status === DELIVERY_STATUS.delivered,
  );

  if (duplicate) {
    return {
      status: DELIVERY_STATUS.duplicate,
      externallyDelivered: false,
      priorReceiptId: duplicate.receiptId,
      reason:
        "This exact submission package has already been delivered through this adapter.",
    };
  }

  return {
    status: DELIVERY_STATUS.delivered,
    externallyDelivered: true,
    submissionId,
    agencyId,
    manifestSha256,
    adapter,
    receiptId: receipt.receiptId,
    receiptSha256: computedReceiptSha256,
    deliveredAt: receipt.deliveredAt,
  };
}
