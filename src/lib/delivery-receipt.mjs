export const DELIVERY_STATUS = Object.freeze({
  delivered: "DELIVERED",
  rejected: "REJECTED",
  invalidReceipt: "INVALID_RECEIPT",
  duplicate: "DUPLICATE_DELIVERY",
});

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
    deliveredAt: receipt.deliveredAt,
  };
}