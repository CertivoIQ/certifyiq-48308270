import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const promotion = await read("src/lib/founders-promotion.ts");
const promotionServer = await read("src/lib/founders-promotion.server.ts");
const enterpriseInvoices = await read("src/lib/enterprise-invoice.functions.ts");
const payments = await read("src/utils/payments.functions.ts");
const invoicePanel = await read("src/components/crm/enterprise-invoice-panel.tsx");
const pricing = await read("src/routes/pricing.tsx");
const terms = await read("src/routes/terms.tsx");
const billing = await read("src/routes/_authenticated/billing.tsx");

test("defines the approved 12-month Founding Customer Offer", () => {
  assert.match(promotion, /code:\s*"FOUNDERS50"/);
  assert.match(promotion, /percentOff:\s*50/);
  assert.match(promotion, /duration:\s*"repeating"/);
  assert.match(promotion, /durationInMonths:\s*12/);
  assert.match(promotion, /discountedInstallments:\s*12/);
  assert.match(promotion, /expiresAtIso:\s*"2026-12-01T06:00:00\.000Z"/);
  assert.match(promotion, /firstTimeTransactionOnly:\s*true/);
  assert.match(promotion, /at\.getTime\(\) < new Date/);
});

test("creates and validates a base-license-only Stripe campaign", () => {
  assert.match(promotionServer, /ensureFoundersPromotionCatalog/);
  assert.match(promotionServer, /resolveFoundersInvoicePromotion/);
  assert.match(promotionServer, /stripe\.coupons\.create/);
  assert.match(promotionServer, /duration_in_months:\s*FOUNDERS_PROMOTION\.durationInMonths/);
  assert.match(promotionServer, /applies_to:\s*\{ products: productIds \}/);
  assert.match(promotionServer, /couponRecord\.applies_to\?\.products/);
  assert.match(promotionServer, /stripe\.promotionCodes\.create/);
  assert.match(promotionServer, /first_time_transaction:/);
  assert.match(promotionServer, /FOUNDERS50 expired after November 30, 2026/);
  assert.match(
    promotionServer,
    /Existing Founding Customer Offer coupon does not match approved terms/,
  );
  assert.match(promotionServer, /Existing FOUNDERS50 code does not match approved terms/);
});

test("applies FOUNDERS50 to the invoice schedule rather than Checkout", () => {
  assert.match(enterpriseInvoices, /promotionCode\?: string/);
  assert.match(enterpriseInvoices, /resolveFoundersInvoicePromotion/);
  assert.match(enterpriseInvoices, /discounts:\s*initialDiscounts/);
  assert.match(enterpriseInvoices, /promotion_code:\s*foundersPromotion\.promotionCodeId/);
  assert.match(enterpriseInvoices, /promotion_discount_months/);
  assert.match(enterpriseInvoices, /FOUNDERS50 was not applied to the first monthly invoice/);
  assert.match(enterpriseInvoices, /subscriptionSchedules\.cancel\(schedule\.id\)/);
  assert.match(invoicePanel, /Founding Customer offer code/);
  assert.match(invoicePanel, /FOUNDERS50 applies 50% off the first 12 monthly base-license invoices/);

  assert.doesNotMatch(payments, /allow_promotion_codes/);
  assert.doesNotMatch(payments, /ensureFoundersPromotion/);
  assert.match(payments, /base licenses are invoice-only and cannot be purchased through Checkout/i);
});

test("publishes accurate first-year terms only while redemption is available", () => {
  assert.match(pricing, /foundersPromotionAvailable\(\)/);
  assert.match(pricing, /50% off your first 12 months/);
  assert.match(pricing, /through November 30, 2026/);
  assert.match(pricing, /renewals return to the standard annual price/);
  assert.match(pricing, /FOUNDERS_PROMOTION\.code/);
  assert.match(pricing, /applies only to the base annual platform-license line item/i);
});

test("removes superseded commercial charges from controlled customer surfaces", () => {
  const controlledCopy = [pricing, terms, billing].join("\n");
  assert.doesNotMatch(controlledCopy, /\$15,000|50,000 analyses|\$0\.15 per certification/i);
  assert.doesNotMatch(controlledCopy, /non-cancellable/i);
});
