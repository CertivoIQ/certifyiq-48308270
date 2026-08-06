import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import {
  ADDON_PRICE_ID_LIST,
  FILE_RETENTION_DAYS,
  PLAN_ENTITLEMENTS,
} from "@/lib/plan-catalog";

let _supabase: ReturnType<typeof createClient> | null = null;
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
 * Purchase side effects, per CertifyIQ's rules:
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
  const isAddon = ADDON_PRICE_ID_LIST.includes(row.price_id);
  const active = ["active", "trialing", "past_due"].includes(row.status);

  const { data: existing } = await supabase
    .from("account_access")
    .select("welcome_sent_at, launchpad_started_at, plan_id, academy_seats")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const access: Record<string, unknown> = {
    user_id: userId,
    status: row.status,
    environment: env,
    updated_at: now,
    // Paid access ends only when the period ends after a cancellation.
    access_until: row.cancel_at_period_end ? row.current_period_end : null,
    // Subscribing clears the trial retention hold — files are kept.
    files_purge_at: null,
    welcome_sent_at: (existing?.["welcome_sent_at"] as string | null) ?? now,
    launchpad_started_at: (existing?.["launchpad_started_at"] as string | null) ?? now,
  };

  if (plan && active) {
    access["plan_id"] = plan.planId;
    access["price_id"] = plan.priceId;
    access["unit_limit"] = plan.unitLimit;
    access["property_limit"] = plan.propertyLimit;
    access["ai_doc_allowance"] = plan.aiDocAllowance;
  } else if (isAddon) {
    // Academy add-ons layer on top of whatever platform plan is in place.
    const seats = Number(subscription.items?.data?.[0]?.quantity ?? 1);
    access["academy_seats"] = seats;
  }

  await supabase.from("account_access").upsert(access, { onConflict: "user_id" });

  if (!plan || !active) return;

  // CRM: convert the lead and fire the "new subscriber paid" ticker event.
  const email: string | undefined = subscription.metadata?.email;
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  const contactEmail = (profile?.["email"] as string | null) ?? email ?? null;

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
          trial_ended_on: now,
          updated_at: now,
        })
        .eq("id", accountId)
        .select("name")
        .maybeSingle();
      accountName = (updated?.["name"] as string | null) ?? null;
    }
  }

  await supabase.from("crm_news").insert({
    kind: "subscriber",
    headline: `New subscriber paid — ${accountName ?? contactEmail ?? "New customer"} on ${plan.name}`,
    detail: `${plan.name} subscription started. Trial converted, file retention hold cleared, LaunchPad onboarding started.`,
    source: "CertifyIQ Payments",
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
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "invoice.paid":
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
