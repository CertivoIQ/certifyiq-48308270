import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("live billing remains fail-closed until configuration and verification are explicit", () => {
  const config = read("src/lib/billing-config.server.ts");
  const portal = read("src/lib/billing-portal.server.ts");
  const stripe = read("src/lib/stripe.server.ts");
  const guard = read("src/lib/paid-onboarding.server.ts");
  const payments = read("src/utils/payments.functions.ts");
  const invoices = read("src/lib/enterprise-invoice.functions.ts");

  assert.match(config, /PAYMENTS_LIVE_VERIFIED/);
  assert.match(config, /STRIPE_LIVE_API_KEY/);
  assert.match(config, /VITE_PAYMENTS_CLIENT_TOKEN/);
  assert.match(config, /PAYMENTS_LIVE_WEBHOOK_SECRET/);
  assert.match(config, /STRIPE_MULTIFAMILY_ENTERPRISE_PRICE_ID_LIVE/);
  assert.match(config, /STRIPE_PHA_PRICE_ID_LIVE/);
  assert.match(config, /STRIPE_BILLING_PORTAL_CONFIGURATION_ID_LIVE/);
  assert.match(config, /LIVE_SECRET_KEY_PATTERN/);
  assert.match(config, /LIVE_PUBLISHABLE_KEY_PATTERN/);
  assert.match(config, /WEBHOOK_SECRET_PATTERN/);
  assert.match(config, /PRICE_ID_PATTERN/);
  assert.match(config, /PORTAL_CONFIGURATION_PATTERN/);

  assert.match(portal, /requireControlledPortalConfiguration/);
  assert.match(portal, /billingPortal\.configurations\.retrieve/);
  assert.match(portal, /billingPortal\.configurations\.list/);
  assert.match(portal, /matches\.length === 0/);
  assert.match(portal, /matches\.length > 1/);
  assert.match(portal, /subscription_cancel\?\.enabled/);
  assert.match(portal, /subscription_update\?\.enabled/);

  assert.match(stripe, /env === "live"\) assertLiveBillingConfiguration/);
  assert.match(guard, /PAID_ONBOARDING_ENABLED/);
  assert.match(guard, /PAYMENTS_LIVE_VERIFIED/);
  assert.match(guard, /assertNewPaidOnboardingAllowed/);
  assert.match(payments, /assertNewPaidOnboardingAllowed/);
  assert.match(payments, /requireControlledPortalConfiguration/);
  assert.match(payments, /configuration,/);
  assert.match(invoices, /assertNewPaidOnboardingAllowed/);
});

test("server auth can use the public Supabase production fallback when deployment omits the publishable env", () => {
  const auth = read("src/integrations/supabase/auth-middleware.ts");
  assert.match(auth, /PRODUCTION_SUPABASE_URL/);
  assert.match(auth, /PRODUCTION_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(auth, /process\.env\['SUPABASE_URL'\][\s\S]*process\.env\['VITE_SUPABASE_URL'\][\s\S]*PRODUCTION_SUPABASE_URL/);
  assert.match(auth, /process\.env\['SUPABASE_PUBLISHABLE_KEY'\][\s\S]*process\.env\['VITE_SUPABASE_PUBLISHABLE_KEY'\][\s\S]*PRODUCTION_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(auth, /PRODUCTION_SUPABASE_SERVICE_ROLE_KEY/);
});

test("tracked environment files cannot reintroduce deployment credentials", () => {
  for (const path of [".env", ".env.development", ".env.production"]) {
    assert.equal(existsSync(path), false, `${path} must not be tracked`);
  }
  const ignore = read(".gitignore");
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
});
