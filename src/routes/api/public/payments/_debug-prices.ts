import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/public/payments/_debug-prices")({
  server: {
    handlers: {
      GET: async () => {
        const stripe = createStripeClient("sandbox");
        const prices = await stripe.prices.list({ limit: 50, expand: ["data.product"] });
        return Response.json(
          prices.data.map((p) => ({
            lookup_key: p.lookup_key,
            id: p.id,
            amount: p.unit_amount,
            interval: p.recurring?.interval ?? null,
            product: typeof p.product === "string" ? p.product : (p.product as any).name,
            ext: p.metadata?.["lovable_external_id"] ?? null,
          })),
        );
      },
    },
  },
});
