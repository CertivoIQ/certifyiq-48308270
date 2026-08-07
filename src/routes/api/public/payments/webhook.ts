import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  ADDON_PRICE_IDS,
  FILE_RETENTION_DAYS,
  PLAN_ENTITLEMENTS,
  isAddonPrice,
} from "@/lib/plan-catalog";

// Loose typing: this service-role client writes columns across several tables
// and must not be constrained by the generated single-table row types.
let _supabase: SupabaseClient<any, any, any> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function resolvePriceId(item: any): string {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    "unknown"
  );
}

function subscriptionRow(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    product_id: String(item?.price?.product ?? "unknown"),
    price_id: resolvePriceId(item),
    status: subscription.status,
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    environment: env,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Purchase side effects, per CertivoIQ's rules:
 *  - unlock plan capacity (units / properties / AI document allowance)
 *  - end the trial and cancel the 14-day file deletion clock
 *  - convert the matching CRM lead to "won" and announce it on the ticker
 *  - queue the welcome email + start the LaunchPad onboarding wizard
 */
async function applyPurchase(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("Subscription has no userId metadata:", subscription.id);
    return;
  }

  const row = subscriptionRow(subscription, env);
  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, ...row }, { onConflict: "stripe_subscription_id" });

  const plan = PLAN_ENTITLEMENTS[row.price_id];
  const isAddon = isAddonPrice(row.price_id);
  const active = ["active", "trialing", "past_due"].includes(row.status);

  // Merge, never replace: account_access is one row per user shared by the
  // platform plan and every add-on subscription.
  const { data: existing } = await supabase
    .from("account_access")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const access: Record<string, unknown> = {
    ...(existing ?? {}),
    user_id: userId,
    environment: env,
    updated_at: now,
    welcome_sent_at: (existing?.["welcome_sent_at"] as string | null | undefined) ?? now,
    launchpad_started_at: (existing?.["launchpad_started_at"] as string | null | undefined) ?? now,
  };
  delete access["created_at"];
  delete access["id"];

  if (plan && active) {
    // Plan purchase / renewal: unlock capacity, clear the trial purge hold.
    access["status"] = row.status;
    access["plan_id"] = plan.planId;
    access["price_id"] = plan.priceId;
    access["unit_limit"] = plan.unitLimit;
    access["property_limit"] = plan.propertyLimit;
    access["ai_doc_allowance"] = plan.aiDocAllowance;
    access["access_until"] = row.cancel_at_period_end ? row.current_period_end : null;
    access["files_purge_at"] = null;
    access["files_purged_at"] = null;
  } else if (isAddon && active) {
    // Add-ons layer on top and must never disturb plan capacity or status.
    if (row.price_id === ADDON_PRICE_IDS.academySeat) {
      access["academy_seats"] = Number(subscription.items?.data?.[0]?.quantity ?? 1);
    } else if (row.price_id === ADDON_PRICE_IDS.academyProperty) {
      // Property-wide Academy: unlimited seats at one property.
      access["academy_seats"] = -1;
    }
  }

  await supabase.from("account_access").upsert(access, { onConflict: "user_id" });

  // A new billing period resets the metered AI document allowance.
  if (plan && active && row.current_period_start) {
    await supabase.from("usage_counters").upsert(
      {
        user_id: userId,
        environment: env,
        period_start: row.current_period_start,
        ai_docs_used: 0,
        ai_docs_billed: 0,
        properties_used: 0,
        units_used: 0,
        period_end: row.current_period_end,
        updated_at: now,
      },
      { onConflict: "user_id,period_start,environment", ignoreDuplicates: true },
    );
  }

  // Only announce and convert the CRM lead on the first plan activation.
  const firstActivation = plan && active && existing?.["plan_id"] !== plan.planId;
  if (!firstActivation) return;

  const email: string | undefined = subscription.metadata?.email;
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  const contactEmail = (profile?.["email"] as string | null | undefined) ?? email ?? null;

  let accountName: string | null = null;
  if (contactEmail) {
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("account_id")
      .eq("email", contactEmail)
      .maybeSingle();
    const accountId = contact?.["account_id"] as string | undefined;
    if (accountId) {
      const { data: updated } = await supabase
        .from("crm_accounts")
        .update({
          stage: "won",
          plan: plan.name,
          last_touch: now,
          updated_at: now,
        })
        .eq("id", accountId)
        .select("name")
        .maybeSingle();
      accountName = (updated?.["name"] as string | null | undefined) ?? null;
    }
  }

  await supabase.from("crm_news").insert({
    kind: "subscriber",
    headline: `New subscriber paid — ${accountName ?? contactEmail ?? "New customer"} on ${plan.name}`,
    detail: `${plan.name} subscription started. Trial converted, file retention hold cleared, LaunchPad onboarding started.`,
    source: "CertivoIQ Payments",
  });
}

/** Cancellation: access runs to the period end, then a 14-day file hold. */
async function applyCancellation(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  const row = subscriptionRow(subscription, env);

  await supabase
    .from("subscriptions")
    .update({ ...row, status: "canceled" })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const userId = subscription.metadata?.userId;
  if (!userId) return;

  // An add-on ending must not revoke the platform plan.
  if (isAddonPrice(row.price_id)) {
    await supabase
      .from("account_access")
      .update({ academy_seats: 0, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return;
  }

  const accessEnd = row.current_period_end ?? new Date().toISOString();
  const purgeAt = new Date(
    new Date(accessEnd).getTime() + FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await supabase
    .from("account_access")
    .update({
      status: "canceled",
      access_until: accessEnd,
      files_purge_at: purgeAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/** Recipient + display name for billing emails triggered by an invoice. */
async function billingRecipient(invoice: any): Promise<{ recipient: string; name?: string | null } | null> {
  const supabase = getSupabase();
  const subId = invoice?.subscription ?? invoice?.parent?.subscription_details?.subscription;

  let userId: string | null = null;
  if (subId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    userId = (data?.["user_id"] as string | null | undefined) ?? null;
  }

  let email: string | null = invoice?.customer_email ?? null;
  let name: string | null = invoice?.customer_name ?? null;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    email = (profile?.["email"] as string | null | undefined) ?? email;
    name = (profile?.["full_name"] as string | null | undefined) ?? name;
  }

  if (!email) return null;
  return { recipient: email, name: name ?? null };
}

/** Billing notifications must never fail the webhook — log and move on. */
async function notify(invoice: any, kind: "created" | "paid" | "failed") {
  try {
    const ctx = await billingRecipient(invoice);
    if (!ctx) {
      console.warn("No recipient for billing email", kind, invoice?.id);
      return;
    }
    const { sendInvoiceCreatedEmail, sendPaymentSucceededEmail, sendPaymentFailedEmail } = await import(
      "@/lib/billing-emails.server"
    );
    if (kind === "created") await sendInvoiceCreatedEmail(invoice, ctx);
    else if (kind === "paid") await sendPaymentSucceededEmail(invoice, ctx);
    else await sendPaymentFailedEmail(invoice, ctx);
  } catch (error) {
    console.error("Billing email failed", kind, invoice?.id, error);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await applyPurchase(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await applyCancellation(event.data.object, env);
      break;
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status === "unpaid") break;
      // One-time purchases (AI document overage) need no entitlement change;
      // subscription fulfilment is handled by customer.subscription.*.
      break;
    }
    case "invoice.finalized": {
      // A new invoice exists and the amount is settled — notify the customer.
      const invoice = event.data.object;
      if ((invoice.amount_due ?? 0) > 0) await notify(invoice, "created");
      break;
    }
    case "invoice.payment_failed": {
      // Dunning: flag the account past_due but never revoke access — Stripe
      // retries automatically and sends customer.subscription.updated on the
      // final outcome.
      const invoice = event.data.object;
      const subId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
      if (subId) {
        const supabase = getSupabase();
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId)
          .eq("environment", env);
      }
      await notify(invoice, "failed");
      break;
    }
    case "invoice.paid":
      await notify(event.data.object, "paid");
      break;
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
      break;
    default:
      console.log("Unhandled payments event:", event.type);
  }
}


export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
