import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { verifyWebhook } from "../src/lib/stripe.server";

const secret = "whsec_certivoiq_rollback_only_test";
const body = JSON.stringify({
  id: "evt_certivoiq_uat",
  type: "customer.subscription.updated",
  data: { object: { id: "sub_certivoiq_uat" } },
});

function signature(timestamp: string, valueBody = body): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${valueBody}`)
    .digest("hex");
}

function request(timestamp: string, signatures: string[], valueBody = body): Request {
  return new Request("https://certivoiq.invalid/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},${signatures.map((value) => `v1=${value}`).join(",")}`,
    },
    body: valueBody,
  });
}

describe("Stripe webhook verification", () => {
  test("accepts a current valid sandbox signature", async () => {
    process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = secret;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const event = await verifyWebhook(request(timestamp, [signature(timestamp)]), "sandbox");
    expect(event.type).toBe("customer.subscription.updated");
  });

  test("accepts a valid signature during Stripe key rotation", async () => {
    process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = secret;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const event = await verifyWebhook(
      request(timestamp, ["0".repeat(64), signature(timestamp)]),
      "sandbox",
    );
    expect(event.type).toBe("customer.subscription.updated");
  });

  test("rejects invalid, malformed, stale, and body-mismatched signatures", async () => {
    process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = secret;
    const now = String(Math.floor(Date.now() / 1000));
    const stale = String(Math.floor(Date.now() / 1000) - 301);

    await expect(verifyWebhook(request(now, ["f".repeat(64)]), "sandbox")).rejects.toThrow(
      "Invalid webhook signature",
    );
    await expect(verifyWebhook(request("not-a-time", [signature("not-a-time")]), "sandbox")).rejects.toThrow(
      "Invalid webhook timestamp",
    );
    await expect(verifyWebhook(request(stale, [signature(stale)]), "sandbox")).rejects.toThrow(
      "Webhook timestamp too old",
    );
    await expect(
      verifyWebhook(request(now, [signature(now)], body + " "), "sandbox"),
    ).rejects.toThrow("Invalid webhook signature");
  });
});
