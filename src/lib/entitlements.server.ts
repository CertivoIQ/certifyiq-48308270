import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { StripeEnv } from "@/lib/stripe.server";
import { FREE_REVIEW_ENTITLEMENT, entitlementForPrice } from "@/lib/plan-catalog";
import type { AccountState } from "@/utils/entitlements.functions";

/** Supabase client surface used by entitlement reads/writes. */
export type EntitlementsDb = SupabaseClient<Database>;

/** Current billing period start, used as the usage-counter bucket key. */
export function periodStartFor(
  access: { trial_started_at?: string | null } | null,
  sub: { current_period_start?: string | null } | null,
): string {
  const fromSub = sub?.current_period_start;
  if (fromSub) return new Date(fromSub).toISOString();
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function loadState(
  supabase: SupabaseClient<Database>,
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
    (subs ?? []).find((s) => !!entitlementForPrice(s.price_id)) ?? null;
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
    // The FREE review program has no calendar expiration. Paid plans retain
    // their normal access dates from account_access.
    accessUntil: isTrial ? null : ((access?.["access_until"] as string | null) ?? null),
    filesPurgeAt: isTrial ? null : ((access?.["files_purge_at"] as string | null) ?? null),
    academySeats: Number(access?.["academy_seats"] ?? 0),
    limits: {
      units: entitlement ? entitlement.unitLimit : isTrial ? FREE_REVIEW_ENTITLEMENT.unitLimit : 0,
      properties: entitlement
        ? entitlement.propertyLimit
        : isTrial
          ? FREE_REVIEW_ENTITLEMENT.propertyLimit
          : 0,
      aiDocs: entitlement
        ? entitlement.aiDocAllowance
        : isTrial
          ? FREE_REVIEW_ENTITLEMENT.aiDocAllowance
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
