import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { StripeEnv } from "@/lib/stripe.server";
import { TRIAL_ENTITLEMENT, entitlementForPrice } from "@/lib/plan-catalog";
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
  const trialStart = access?.trial_started_at;
  if (trialStart) return new Date(trialStart).toISOString();
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function loadState(
  db: EntitlementsDb,
  userId: string,
  environment: StripeEnv,
) {
  const { data: access, error: accessError } = await db
    .from("account_access")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (accessError) throw accessError;

  const { data: subscription, error: subscriptionError } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  const periodStart = periodStartFor(access, subscription);
  const { data: usage, error: usageError } = await db
    .from("ai_document_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (usageError) throw usageError;

  const plan = entitlementForPrice(subscription?.price_id ?? null, environment) ?? TRIAL_ENTITLEMENT;
  const isTrial = !!access?.is_trial;
  const status = subscription?.status ?? (isTrial ? "trialing" : "none");

  return {
    status,
    planId: subscription?.plan_id ?? null,
    priceId: subscription?.price_id ?? null,
    planName: plan?.name ?? null,
    isTrial,
    accessUntil: access?.access_until ?? null,
    filesPurgeAt: access?.files_purge_at ?? null,
    academySeats: plan?.academySeats ?? 0,
    limits: {
      units: plan?.units ?? null,
      properties: plan?.properties ?? null,
      aiDocs: plan?.aiDocs ?? null,
    },
    usage: {
      periodStart,
      aiDocsUsed: usage?.documents_used ?? 0,
      aiDocsBilled: usage?.documents_billed ?? 0,
      propertiesUsed: usage?.properties_used ?? 0,
      unitsUsed: usage?.units_used ?? 0,
    },
  } satisfies AccountState;
}
