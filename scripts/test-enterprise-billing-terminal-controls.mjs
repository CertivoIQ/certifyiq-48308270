import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260901232138_gate3_enterprise_billing_terminal_controls.sql",
  "utf8",
);
const licensing = readFileSync("src/lib/enterprise-licensing.server.ts", "utf8");
const webhook = readFileSync("src/routes/api/public/payments/webhook.ts", "utf8");
const payments = readFileSync("src/utils/payments.functions.ts", "utf8");
const billing = readFileSync("src/routes/_authenticated/billing.tsx", "utf8");

test("database event claims are atomic, replay-safe, and recoverable", () => {
  assert.match(migration, /create or replace function public\.claim_enterprise_billing_event/i);
  assert.match(migration, /on conflict \(stripe_event_id\) do nothing/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /current_state = 'completed'[\s\S]*return 'duplicate'/i);
  assert.match(migration, /current_state = 'failed'/i);
  assert.match(migration, /interval '5 minutes'/i);
  assert.match(migration, /attempt_count = attempt_count \+ 1/i);
});

test("event claim and audit data remain service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.claim_enterprise_billing_event[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.claim_enterprise_billing_event[\s\S]*to service_role/i,
  );
  assert.match(migration, /security_invoker\s*=\s*true/i);
  assert.match(
    migration,
    /revoke all on public\.paid_license_entitlement_reconciliation from public, anon, authenticated/i,
  );
});

test("paid, cancellation, credit, and refund events have bounded dispositions", () => {
  assert.match(licensing, /last_billing_event_id/);
  assert.match(licensing, /applyEnterpriseTerminalEvent/);
  assert.match(licensing, /status: "canceled"/);
  assert.match(licensing, /licenseStatus = action === "cancelled" \? "cancelled" : "suspended"/);
  assert.match(webhook, /case "customer\.subscription\.deleted"/);
  assert.match(webhook, /case "credit_note\.created"/);
  assert.match(webhook, /case "charge\.refunded"/);
});

test("partial and historical financial reversals are resolved without unsafe revocation", () => {
  assert.match(licensing, /organizationIdForPaidInvoice/);
  assert.match(licensing, /settledInvoiceAmount/);
  assert.match(licensing, /partial_or_unverified_financial_adjustment/);
  assert.match(licensing, /Access was not revoked/);
  assert.match(licensing, /reversedAmount < settledAmount/);
  assert.match(licensing, /completeEvent\([\s\S]*"exception"/);
});

test("enterprise members use a controlled invoice portal without direct schedule cancellation", () => {
  assert.match(payments, /from\("enterprise_license_members"\)/);
  assert.match(payments, /from\("enterprise_licenses"\)/);
  assert.match(payments, /billingPortal\.configurations\.retrieve/);
  assert.match(payments, /invoice_history\?\.enabled/);
  assert.match(payments, /payment_method_update\?\.enabled/);
  assert.match(payments, /subscription_cancel\?\.enabled/);
  assert.match(payments, /subscription_update\?\.enabled/);
  assert.match(payments, /configuration,/);
  assert.match(payments, /controlled cancellation workflow/i);
  assert.match(billing, /Request billing change/);
  assert.match(billing, /to="\/contact-support"/);
});

test("reconciliation understands active, grace, and terminal entitlement states", () => {
  assert.match(migration, /when license\.status = 'active'/i);
  assert.match(migration, /when license\.status = 'past_due'/i);
  assert.match(migration, /license\.status in \('suspended', 'expired', 'cancelled'\)/i);
  assert.match(migration, /access\.status = 'canceled'/i);
  assert.match(migration, /end as entitlement_matches,\s*license\.last_billing_event_id/i);
});
