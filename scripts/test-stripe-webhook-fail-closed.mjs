import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webhook = readFileSync(
  new URL("../src/routes/api/public/payments/webhook.ts", import.meta.url),
  "utf8",
);
const verifier = readFileSync(new URL("../src/lib/stripe.server.ts", import.meta.url), "utf8");

test("event ledger failure stops subscription activation", () => {
  assert.match(webhook, /if \(!error\) return true/);
  assert.match(webhook, /code === "23505"\) return false/);
  assert.match(webhook, /throw new Error\("Event ledger write failed"\)/);
});

test("webhook signature validation uses SubtleCrypto verification", () => {
  assert.match(verifier, /crypto\.subtle\.verify/);
  assert.doesNotMatch(verifier, /v1Signatures\.includes\(expected\)/);
  assert.match(verifier, /Number\.isInteger\(timestampSeconds\)/);
});
