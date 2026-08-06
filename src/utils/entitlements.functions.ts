import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import {
  AI_DOC_OVERAGE_PRICE_ID,
  TRIAL_ENTITLEMENT,
  entitlementForPrice,
} from "@/lib/plan-catalog";

export interface AccountState {
  status: string;
  planId: string | null;
  priceId: string | null;
  planName: string | null;
  isTrial: boolean;
  accessUntil: string | null;
  filesPurgeAt: string | null;
  academySeats: number;
  limits: {
    units: number | null;
    properties: number | null;
    aiDocs: number | null;
  };
  usage: {
    periodStart: string | null;
    aiDocsUsed: number;
    aiDocsBilled: number;
    propertiesUsed: number;
    unitsUsed: number;
  };
}

type AccountStateResult = AccountState | { error: string };
type ConsumeResult =
  | { ok: true; used: number; allowance: number | null; billedNow: number; remaining: number | null }
  | { error: string; blocked?: boolean };
type CapacityResult = { allowed: boolean; used: number; limit: number | null; reason?: string } | { error: string };

/** Current billing period start, used as the usage-counter bucket key. */
function periodStartFor(access: Record<string, any> | null, sub: Record<string, any> | null): string {
  const fromSub = sub?.["current_period_start"] as string | null | undefined;
  if (fromSub) return new Date(fromSub).toISOString();
  const trialStart = access?.["trial_started_at"] as string | null | undefined;
  if (trialStart) return new Date(trialStart).toISOString();
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function loadState(
  supabase: any,
  userId: string,
  environment: StripeEnv,
): Promise<AccountState> {
  const { data: access } = await supabase
    .from("account_access")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false });

  const planSub =
    (subs ?? []).find((s: any) => !!entitlementForPrice(s.price_id)) ?? null;
  const entitlement = entitlementForPrice(planSub?.price_id ?? access?.["price_id"]);
  const isTrial = (access?.["status"] ?? "trialing") === "trialing" && !entitlement;

  const periodStart = periodStartFor(access, planSub);
  const { data: usage } = await supabase
    .from("usage_counters")
    .select("*")
    .eq("user_id", userId)
    .eq("environment", environment)
    .eq("period_start", periodStart)
    .maybeSingle();

  return {
    status: (access?.["status"] as string) ?? "none",
    planId: (entitlement?.planId ?? null) as string | null,
    priceId: entitlement?.priceId ?? null,
    planName: entitlement?.name ?? null,
    isTrial,
    accessUntil: (access?.["access_until"] as string | null) ?? null,
    filesPurgeAt: (access?.["files_purge_at"] as string | null) ?? null,
    academySeats: Number(access?.["academy_seats"] ?? 0),
    limits: {
      units: entitlement ? entitlement.unitLimit : isTrial ? TRIAL_ENTITLEMENT.unitLimit : 0,
      properties: entitlement
        ? entitlement.propertyLimit
        : isTrial
          ? TRIAL_ENTITLEMENT.propertyLimit
          : 0,
      aiDocs: entitlement
        ? entitlement.aiDocAllowance
        : isTrial
          ? TRIAL_ENTITLEMENT.aiDocAllowance
          : 0,
    },
    usage: {
      periodStart,
      aiDocsUsed: Number(usage?.["ai_docs_used"] ?? 0),
      aiDocsBilled: Number(usage?.["ai_docs_billed"] ?? 0),
      propertiesUsed: Number(usage?.["properties_used"] ?? 0),
      unitsUsed: Number(usage?.["units_used"] ?? 0),
    },
  };
}

/** Plan, limits and current-period usage for the signed-in account. */
export const getAccountState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<AccountStateResult> => {
    try {
      return await loadState(context.supabase, context.userId, data.environment);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not load account state" };
    }
  });

/**
 * Meters AI document processing. Documents inside the plan allowance are free;
 * anything beyond it is billed at $3 per certification onto the next invoice.
 * Accounts with no plan and an expired trial are blocked outright.
 */
export const recordAiDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { count: number; environment: StripeEnv }) => {
    if (!Number.isInteger(data.count) || data.count < 1 || data.count > 5000) {
      throw new Error("Invalid document count");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<ConsumeResult> => {
    const { supabase, userId } = context;
    const state = await loadState(supabase, userId, data.environment);

    const trialExpired =
      state.isTrial && !!state.accessUntil && new Date(state.accessUntil).getTime() < Date.now();
    if (state.status === "none" || trialExpired || (!state.planId && !state.isTrial)) {
      return {
        error: trialExpired
          ? "Your free trial has ended. Choose a plan to keep reviewing certifications."
          : "No active plan. Choose a plan to process certifications.",
        blocked: true,
      };
    }

    const allowance = state.limits.aiDocs;
    const before = state.usage.aiDocsUsed;
    const after = before + data.count;

    // Trials are capped hard — no overage billing without a card on file.
    if (state.isTrial && allowance !== null && after > allowance) {
      return {
        error: `Trials include ${allowance} AI document reviews. Choose a plan to keep going.`,
        blocked: true,
      };
    }

    let billedNow = 0;
    if (allowance !== null && after > allowance) {
      const overageTotal = after - allowance;
      billedNow = overageTotal - state.usage.aiDocsBilled;
    }

    if (billedNow > 0) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) {
        return { error: "No billing account on file for overage charges.", blocked: true };
      }
      try {
        const stripe = createStripeClient(data.environment);
        const prices = await stripe.prices.list({ lookup_keys: [AI_DOC_OVERAGE_PRICE_ID] });
        const price = prices.data[0];
        if (!price) return { error: "Overage price not configured", blocked: true };
        await stripe.invoiceItems.create({
          customer: sub.stripe_customer_id,
          price: price.id,
          quantity: billedNow,
          description: `AI document processing beyond plan allowance (${billedNow} certifications)`,
        });
      } catch (error) {
        return { error: getStripeErrorMessage(error), blocked: true };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: writeError } = await (supabaseAdmin as any)
      .from("usage_counters")
      .upsert(
        {
          user_id: userId,
          environment: data.environment,
          period_start: state.usage.periodStart,
          ai_docs_used: after,
          ai_docs_billed: state.usage.aiDocsBilled + billedNow,
          properties_used: state.usage.propertiesUsed,
          units_used: state.usage.unitsUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,period_start,environment" },
      );
    if (writeError) return { error: "Could not record usage", blocked: true };

    return {
      ok: true,
      used: after,
      allowance,
      billedNow,
      remaining: allowance === null ? null : Math.max(allowance - after, 0),
    };
  });

/**
 * Hard capacity gate for properties and units — blocked past the plan limit
 * with no overage billing, per CertifyIQ's pricing rules.
 */
export const claimCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "property" | "unit"; amount: number; environment: StripeEnv }) => {
    if (data.kind !== "property" && data.kind !== "unit") throw new Error("Invalid capacity kind");
    if (!Number.isInteger(data.amount) || data.amount < 1 || data.amount > 500000) {
      throw new Error("Invalid amount");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<CapacityResult> => {
    const { supabase, userId } = context;
    const state = await loadState(supabase, userId, data.environment);

    const expired =
      !!state.accessUntil && new Date(state.accessUntil).getTime() < Date.now() && state.isTrial;
    if (state.status === "none" || expired) {
      return {
        allowed: false,
        used: 0,
        limit: 0,
        reason: expired
          ? "Your free trial has ended. Choose a plan to add more."
          : "No active plan.",
      };
    }

    const isProperty = data.kind === "property";
    const limit = isProperty ? state.limits.properties : state.limits.units;
    const used = isProperty ? state.usage.propertiesUsed : state.usage.unitsUsed;
    const next = used + data.amount;

    if (limit !== null && next > limit) {
      return {
        allowed: false,
        used,
        limit,
        reason: `Your plan covers ${limit.toLocaleString()} ${isProperty ? "properties" : "units"}. Upgrade to add more.`,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("usage_counters").upsert(
      {
        user_id: userId,
        environment: data.environment,
        period_start: state.usage.periodStart,
        ai_docs_used: state.usage.aiDocsUsed,
        ai_docs_billed: state.usage.aiDocsBilled,
        properties_used: isProperty ? next : state.usage.propertiesUsed,
        units_used: isProperty ? state.usage.unitsUsed : next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,period_start,environment" },
    );

    return { allowed: true, used: next, limit };
  });
