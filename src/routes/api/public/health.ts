import { createFileRoute } from "@tanstack/react-router";

import { buildHealthPayload, healthResponseHeaders } from "@/lib/build-identity.mjs";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        // Read build identity inside the handler; env is injected per request.
        const { status, body } = buildHealthPayload({
          CERTIVOIQ_SOURCE_REVISION: process.env["CERTIVOIQ_SOURCE_REVISION"],
          CERTIVOIQ_DEPLOYMENT_ID: process.env["CERTIVOIQ_DEPLOYMENT_ID"],
        });

        return new Response(JSON.stringify(body), {
          status,
          headers: healthResponseHeaders(),
        });
      },
    },
  },
});
