import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * PHA marketing is intentionally not customer-facing.
 * Preserve the route only as a compatibility redirect so historical links
 * cannot expose PHA positioning, pricing, or role-specific material.
 */
export const Route = createFileRoute("/pha/")({
  beforeLoad: () => {
    throw redirect({ to: "/welcome", replace: true });
  },
  head: () => ({
    meta: [
      { title: "CertivoIQ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});
