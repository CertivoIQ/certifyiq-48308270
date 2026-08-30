import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const promotion = await readFile(
  new URL("../src/lib/founders-promotion.ts", import.meta.url),
  "utf8",
);
const checkout = await readFile(
  new URL("../src/utils/payments.functions.ts", import.meta.url),
  "utf8",
);
const pricing = await readFile(new URL("../src/routes/pricing.tsx", import.meta.url), "utf8");

test("defines the approved Founder's Special terms", () => {
  assert.match(promotion, /code:\s*"FOUNDERS50"/);
  assert.match(promotion, /percentOff:\s*50/);
  assert.match(promotion, /duration:\s*"once"/);
  assert.match(promotion, /expiresAtIso:\s*"2026-12-01T06:00:00\.000Z"/);
  assert.match(promotion, /firstTimeTransactionOnly:\s*true/);
  assert.match(promotion, /at\.getTime\(\) < new Date/);
});

test("creates and validates the server-side Stripe coupon and promotion code", () => {
  assert.match(checkout, /ensureFoundersPromotion/);
  assert.match(checkout, /stripe\.coupons\.create/);
  assert.match(checkout, /stripe\.promotionCodes\.create/);
  assert.match(checkout, /applies_to:\s*\{ products: productIds \}/);
  assert.match(checkout, /first_time_transaction:/);
  assert.match(checkout, /allow_promotion_codes:\s*foundersPromotionEnabled/);
  assert.match(checkout, /Existing Founder's Special coupon does not match approved billing terms/);
  assert.match(checkout, /Existing FOUNDERS50 code does not match approved billing terms/);
});

test("publishes accurate first-year terms only while redemption is available", () => {
  assert.match(pricing, /foundersPromotionAvailable\(\)/);
  assert.match(pricing, /50% off your first 12 months/);
  assert.match(pricing, /through November 30, 2026/);
  assert.match(pricing, /renewals return to the standard annual price/);
  assert.match(pricing, /FOUNDERS_PROMOTION\.code/);
});
