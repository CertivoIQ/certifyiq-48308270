import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv } from "@/lib/stripe.server";
import { loadState, periodStartFor, type EntitlementsDb } from "@/lib/entitlements.server";

/** Minimal write surface for the metered usage counters table. */
interface UsageWriter {
  from(table: string): {
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ): PromiseLike<{ error: { message?: string } | null }>;
  };
}

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
    periodStart: string;
    aiDocsUsed: number;
    aiDocsBilled: number;
    propertiesUsed: number;
    unitsUsed: number;
  };
}

type AccountStateResult = AccountState | { error: string };
type ConsumeResult =
  | {
      ok: true;
      used: number;
      allowance: number | null;
      billedNow: number;
      remaining: number | null;
    }
  | { error: string; blocked?: boolean };
type CapacityResult =
  { allowed: boolean; used: number; limit: number | null; reason?: string } | { error: string };

/** Plan, limits and current-period usage for the signed-in account. */
export const getAccountState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<AccountStateResult> => {
    try {
      return await loadState(
        context.supabase as unknown as EntitlementsDb,
        context.userId,
        data.environment,
      );
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not load account state" };
    }
  });

/**
 * Meters document processing. Paid licenses include all currently available
 * platform features; only the FREE review program has a three-review cap.
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
    const state = await loadState(supabase as unknown as EntitlementsDb, userId, data.environment);

    if (state.status === "none" || (!state.planId && !state.isTrial)) {
      return {
        error: "No active plan. Choose a plan to process certifications.",
        blocked: true,
      };
    }

    const allowance = state.limits.aiDocs;
    const before = state.usage.aiDocsUsed;
    const after = before + data.count;

    // FREE reviews are a hard three-certification allowance â€” never overage bill.
    if (state.isTrial && allowance !== null && after > allowance) {
      return {
        error: `Your 3 FREE certification reviews have been used. Choose a plan to keep reviewing certifications.`,
        blocked: true,
      };
    }

    const billedNow = 0;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: writeError } = await (supabaseAdmin as unknown as UsageWriter)
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
 * Hard capacity gate for properties and units. FREE reviews do not include
 * portfolio capacity; mass/property imports require a paid plan.
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
    const state = await loadState(supabase as unknown as EntitlementsDb, userId, data.environment);

    if (state.status === "none") {
      return { allowed: false, used: 0, limit: 0, reason: "No active plan." };
    }

    if (state.isTrial) {
      return {
        allowed: false,
        used: 0,
        limit: 0,
        reason:
          "Portfolio capacity and mass imports require a paid CertivoIQ plan. Your 3 FREE reviews are reserved for certification review.",
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
    await (supabaseAdmin as unknown as UsageWriter).from("usage_counters").upsert(
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

