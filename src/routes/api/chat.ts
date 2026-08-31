import { createFileRoute } from "@tanstack/react-router";

const MERLIN_DISABLED_BODY = {
  error:
    "Merlin chat is unavailable until an approved non-Lovable provider and active add-on entitlement controls are verified.",
  code: "MERLIN_DISABLED_PENDING_ENTITLEMENT",
} as const;

function merlinUnavailable() {
  return Response.json(MERLIN_DISABLED_BODY, {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async () => merlinUnavailable(),
    },
  },
});
