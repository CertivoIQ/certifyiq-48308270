import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDeliveryReceipt,
} from "../src/lib/delivery-receipt.mjs";

const base = {
  submissionId: "SUB-001",
  agencyId: "HFA-TN",
  manifestSha256: "manifest-v1",
  adapter: "test-adapter",
};

const receipt = {
  receiptId: "RECEIPT-001",
  submissionId: "SUB-001",
  agencyId: "HFA-TN",
  manifestSha256: "manifest-v1",
  accepted: true,
  deliveredAt: "2026-08-14T08:00:00Z",
};

test("verified transport receipt marks external delivery complete", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt,
  });

  assert.equal(result.status, "DELIVERED");
  assert.equal(result.externallyDelivered, true);
  assert.equal(result.receiptId, "RECEIPT-001");
});

test("missing transport receipt never implies delivery", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt: null,
  });

  assert.equal(result.status, "INVALID_RECEIPT");
  assert.equal(result.externallyDelivered, false);
});

test("transport rejection never implies delivery", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt: {
      ...receipt,
      accepted: false,
    },
  });

  assert.equal(result.status, "INVALID_RECEIPT");
  assert.equal(result.externallyDelivered, false);
});

test("receipt for a different manifest is rejected", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt: {
      ...receipt,
      manifestSha256: "manifest-v0",
    },
  });

  assert.equal(result.status, "INVALID_RECEIPT");
  assert.equal(result.externallyDelivered, false);
});

test("receipt for a different agency is rejected", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt: {
      ...receipt,
      agencyId: "HFA-KY",
    },
  });

  assert.equal(result.status, "INVALID_RECEIPT");
  assert.equal(result.externallyDelivered, false);
});

test("duplicate delivery of the same package is blocked", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt: {
      ...receipt,
      receiptId: "RECEIPT-002",
    },
    priorReceipts: [
      {
        submissionId: "SUB-001",
        agencyId: "HFA-TN",
        manifestSha256: "manifest-v1",
        adapter: "test-adapter",
        status: "DELIVERED",
        receiptId: "RECEIPT-001",
      },
    ],
  });

  assert.equal(result.status, "DUPLICATE_DELIVERY");
  assert.equal(result.externallyDelivered, false);
  assert.equal(result.priorReceiptId, "RECEIPT-001");
});
test("delivered receipt includes deterministic SHA-256 integrity hash", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt,
  });

  assert.equal(result.status, "DELIVERED");
  assert.equal(result.externallyDelivered, true);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test("receipt with mismatched supplied integrity hash is rejected as tampered", () => {
  const result = validateDeliveryReceipt({
    ...base,
    receipt: {
      ...receipt,
      integritySha256:
        "0000000000000000000000000000000000000000000000000000000000000000",
    },
  });

  assert.equal(result.status, "TAMPERED_RECEIPT");
  assert.equal(result.externallyDelivered, false);
});

test("previously recorded receipt id with changed contents is rejected as tampered", () => {
  const originalResult = validateDeliveryReceipt({
    ...base,
    receipt,
  });

  const result = validateDeliveryReceipt({
    ...base,
    receipt: {
      ...receipt,
      deliveredAt: "2026-08-14T09:00:00Z",
    },
    priorReceipts: [
      {
        submissionId: "SUB-001",
        agencyId: "HFA-TN",
        manifestSha256: "manifest-v1",
        adapter: "test-adapter",
        status: "DELIVERED",
        receiptId: "RECEIPT-001",
        receiptSha256: originalResult.receiptSha256,
      },
    ],
  });

  assert.equal(result.status, "TAMPERED_RECEIPT");
  assert.equal(result.externallyDelivered, false);
  assert.equal(result.receiptId, "RECEIPT-001");
});

test("identical previously recorded receipt still resolves as duplicate delivery", () => {
  const originalResult = validateDeliveryReceipt({
    ...base,
    receipt,
  });

  const result = validateDeliveryReceipt({
    ...base,
    receipt,
    priorReceipts: [
      {
        submissionId: "SUB-001",
        agencyId: "HFA-TN",
        manifestSha256: "manifest-v1",
        adapter: "test-adapter",
        status: "DELIVERED",
        receiptId: "RECEIPT-001",
        receiptSha256: originalResult.receiptSha256,
      },
    ],
  });

  assert.equal(result.status, "DUPLICATE_DELIVERY");
  assert.equal(result.externallyDelivered, false);
  assert.equal(result.priorReceiptId, "RECEIPT-001");
});
