import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { FILE_RETENTION_DAYS, PLAN_ENTITLEMENTS, isPlanPrice } from "@/lib/plan-catalog";
import { normalizeLicenseSelection } from "@/lib/license-selection";
import {
  applyEnterpriseInvoicePaid,
  applyEnterpriseInvoicePastDue,
  type EnterpriseLicenseDb,
} from "@/lib/enterprise-licensing.server";
import type { StripeLineItemLike, StripeSubscriptionLike } from "@/lib/stripe-webhook-types";

type DbRow = Record<string, unknown>;
interface DbError {
  code?: string;
  message?: string;
}
interface DbQuery extends PromiseLike<{ data: DbRow | DbRow[] | null; error: DbError | null }> {
  select(columns?: string): DbQuery;
  eq(column: string, value: unknown): DbQuery;
  is(column: string, value: unknown): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  limit(count: number): DbQuery;
  maybeSingle(): PromiseLike<{ data: DbRow | null; error: DbError | null }>;
  single(): PromiseLike<{ data: DbRow | null; error: DbError | null }>;
}
interface DbTable {
  select(columns?: string): DbQuery;
  insert(values: DbRow | DbRow[]): DbQuery;
  update(values: DbRow): DbQuery;
  upsert(
    values: DbRow | DbRow[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): DbQuery;
  delete(): DbQuery;
}
interface LooseDb {
  from(table: string): DbTable;
}

let _supabase: LooseDb | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    ) as unknown as LooseDb;
  }
  return _supabase;
}

function enterpriseDb(): EnterpriseLicenseDb {
  return getSupabase() as unknown as EnterpriseLicenseDb;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function resolvePriceId(item: StripeLineItemLike | null | undefined): string {
  return item?.price?.lookup_key || item?.price?.id || "unknown";
}

function planItem(subscription: StripeSubscriptionLike): StripeLineItemLike | undefined {
  return (
    subscription.items?.data?.find((it: StripeLineItemLike) => isPlanPrice(resolvePriceId(it))) ||
    subscription.items?.data?.[0]
  );
}

function subscriptionRow(subscription: StripeSubscriptionLike, env: StripeEnv) {
  const item = planItem(subscription);
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    product_id: String(item?.price?.product ?? "unknown"),
    price_id: resolvePriceId(item),
    status: subscription.status ?? "",
    current_period_start: isoFromUnix(periodStart),
    current_period_end: isoFromUnix(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    environment: env,
    updated_at: new Date().toISOString(),
  };
}

async function claimEvent(eventId: string | undefined, eventType: string): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await getSupabase()
    .from("stripe_processed_events")
    .insert({ event_id: eventId, event_type: eventType });
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.error("Event ledger write failed", eventId, error);
  }
  return true;
}

async function activateSubscriber(
  userId: string,
  env: StripeEnv,
  eventId?: string,
  eventType = "",
) {
  if (!(await claimEvent(eventId, eventType))) return;
  const now = new Date().toISOString();
  await getSupabase()
    .from("account_access")
    .update({ subscribed_at: now, demo_data_cleared_at: now, updated_at: now })
    .eq("user_id", userId)
    .is("demo_data_cleared_at", null);
  console.log("Subscriber activated; demo dataset gated off", userId, env);
}

async function applyPurchase(
  subscription: StripeSubscriptionLike,
  env: StripeEnv,
  event?: { id?: string; type?: string },
) {
  const supabase = getSupabase();
  const userId = subscription.metadata?.["userId"];
  if (!userId) {
    console.error("Subscription has no userId metadata:", subscription.id);
    return;
  }

  let selection;
  try {
    selection = normalizeLicenseSelection({
      licenseKind: subscription.metadata?.["license_kind"] ?? "",
      stateCodes: (subscription.metadata?.["licensed_state_codes"] ?? "")
        .split(",")
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Subscription has invalid license jurisdiction metadata", subscription.id, error);
    return;
  }

  const row = subscriptionRow(subscription, env);
  const itemQuantity = Number(planItem(subscription)?.quantity ?? 0);
  if (row.price_id !== selection.priceLookupKey || itemQuantity !== selection.quantity) {
    console.error(
      "Subscription price or quantity does not match approved state selection",
      subscription.id,
    );
    return;
  }
  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, ...row }, { onConflict: "stripe_subscription_id" });

  const plan = PLAN_ENTITLEMENTS[row.price_id];
  const active = ["active", "trialing", "past_due"].includes(row.status);

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
    access["status"] = row.status;
    access["plan_id"] = plan.planId;
    access["price_id"] = plan.priceId;
    access["unit_limit"] = plan.unitLimit;
    access["property_limit"] = plan.propertyLimit;
    access["ai_doc_allowance"] = plan.aiDocAllowance;
    access["access_until"] = row.cancel_at_period_end ? row.current_period_end : null;
    access["files_purge_at"] = null;
    access["files_purged_at"] = null;
    access["license_kind"] = selection.licenseKind;
    access["licensed_state_codes"] = selection.stateCodes;
  }

  await supabase.from("account_access").upsert(access, { onConflict: "user_id" });

  if (plan && row.status === "active") {
    await activateSubscriber(userId, env, event?.id, event?.type ?? "");
  }

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

  const firstActivation = plan && active && existing?.["plan_id"] !== plan.planId;
  if (!firstActivation) return;

  const email: string | undefined = subscription.metadata?.["email"];
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
    headline: `New subscriber paid â€” ${accountName ?? contactEmail ?? "New customer"} on ${plan.name}`,
    detail: `${plan.name} subscription started. Trial converted, file retention hold cleared, LaunchPad onboarding started.`,
    source: "CertivoIQ Payments",
  });
}

async function applyCancellation(subscription: StripeSubscriptionLike, env: StripeEnv) {
  const supabase = getSupabase();
  const row = subscriptionRow(subscription, env);

  await supabase
    .from("subscriptions")
    .update({ ...row, status: "canceled" })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const userId = subscription.metadata?.["userId"];
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
      await applyPurchase(event.data.object, env, event as { id?: string; type?: string });
      break;
    case "customer.subscription.deleted":
      await applyCancellation(event.data.object, env);
      break;
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session["payment_status"] === "unpaid") break;
      break;
    }
    case "invoice.payment_failed": {
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
      await applyEnterpriseInvoicePastDue(
        enterpriseDb(),
        invoice,
        event as { id?: string; type?: string },
      );
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      await applyEnterpriseInvoicePaid(
        enterpriseDb(),
        invoice,
        env,
        event as { id?: string; type?: string },
      );
      break;
    }
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

