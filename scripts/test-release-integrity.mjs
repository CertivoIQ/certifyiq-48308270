import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("live billing remains fail-closed until configuration and verification are explicit", () => {
  const config = read("src/lib/billing-config.server.ts");
  const stripe = read("src/lib/stripe.server.ts");
  const guard = read("src/lib/paid-onboarding.server.ts");
  const checkout = read("src/utils/payments.functions.ts");
  const invoices = read("src/lib/enterprise-invoice.functions.ts");

  assert.match(config, /PAYMENTS_LIVE_VERIFIED/);
  assert.match(config, /STRIPE_LIVE_API_KEY/);
  assert.match(config, /STRIPE_MULTIFAMILY_ENTERPRISE_PRICE_ID_LIVE/);
  assert.match(config, /STRIPE_PHA_PRICE_ID_LIVE/);
  assert.match(stripe, /env === "live"\) assertLiveBillingConfiguration/);
  assert.match(guard, /PAID_ONBOARDING_ENABLED/);
  assert.match(guard, /PAYMENTS_LIVE_VERIFIED/);
  assert.match(guard, /assertNewPaidOnboardingAllowed/);
  assert.match(checkout, /assertNewPaidOnboardingAllowed/);
  assert.match(invoices, /assertNewPaidOnboardingAllowed/);
});

test("tracked environment files cannot reintroduce deployment credentials", () => {
  for (const path of [".env", ".env.development", ".env.production"]) {
    assert.equal(existsSync(path), false, `${path} must not be tracked`);
  }
  const ignore = read(".gitignore");
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
});
