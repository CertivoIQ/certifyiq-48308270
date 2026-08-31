import { createFileRoute } from "@tanstack/react-router";

import { buildHealthPayload, healthResponseHeaders } from "@/lib/build-identity.mjs";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { status, body } = buildHealthPayload();

        return new Response(JSON.stringify(body), {
          status,
          headers: healthResponseHeaders(),
        });
      },
    },
  },
});
