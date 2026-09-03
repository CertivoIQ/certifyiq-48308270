import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const expected = process.env["OPERATIONS_WORKER_SECRET"];
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function assertSupabaseReachable(): Promise<void> {
  const url = required("SUPABASE_URL").replace(/\/$/, "");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/rest/v1/`, {
    method: "GET",
    headers: { apikey: key },
  });
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok) throw new Error(`Supabase runtime credential check returned HTTP ${response.status}`);
}

async function assertStripeReachable(): Promise<void> {
  const key = required("STRIPE_LIVE_API_KEY");
  if (!/^(?:sk|rk)_live_[A-Za-z0-9]+$/.test(key)) {
    throw new Error("STRIPE_LIVE_API_KEY is not a live Stripe key");
  }

  const authorization = `Basic ${btoa(`${key}:`)}`;
  const account = await fetch("https://api.stripe.com/v1/account", {
    headers: { authorization },
  });
  await account.body?.cancel().catch(() => undefined);
  if (!account.ok) throw new Error(`Stripe live account check returned HTTP ${account.status}`);

  const priceIds = [
    required("STRIPE_MULTIFAMILY_ENTERPRISE_PRICE_ID_LIVE"),
    required("STRIPE_PHA_PRICE_ID_LIVE"),
  ];
  for (const priceId of priceIds) {
    if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error("Configured Stripe price ID is invalid");
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { authorization },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Stripe live price check returned HTTP ${response.status}`);
    }
    const price = (await response.json()) as { active?: boolean; livemode?: boolean };
    if (price.active !== true || price.livemode !== true) {
      throw new Error("Configured Stripe price is not active in live mode");
    }
  }
}

export const Route = createFileRoute("/api/internal/runtime-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        try {
          required("VITE_SUPABASE_URL");
          required("VITE_SUPABASE_PUBLISHABLE_KEY");
          const publishable = required("VITE_PAYMENTS_CLIENT_TOKEN");
          if (!/^pk_live_[A-Za-z0-9]+$/.test(publishable)) {
            throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not a live Stripe publishable key");
          }
          const webhook = required("PAYMENTS_LIVE_WEBHOOK_SECRET");
          if (!/^whsec_[A-Za-z0-9]+$/.test(webhook)) {
            throw new Error("PAYMENTS_LIVE_WEBHOOK_SECRET is invalid");
          }

          await assertSupabaseReachable();
          await assertStripeReachable();
          return new Response(null, { status: 204 });
        } catch (error) {
          console.error(
            `[runtime-health] ${error instanceof Error ? error.message : String(error)}`,
          );
          return new Response("Runtime dependency check failed", { status: 503 });
        }
      },
    },
  },
});
