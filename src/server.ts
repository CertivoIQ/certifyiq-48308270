import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type StaticAssetsEnv = {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response> | Response;
  };
};

const CANONICAL_HOST = "certivoiq.com";
const WWW_HOST = "www.certivoiq.com";

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
} as const;

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);

  // Application documents must be revalidated on every navigation/reload so a
  // newly deployed client manifest and route chunks cannot be hidden behind an
  // older browser/edge HTML shell. Hashed static assets remain independently
  // cacheable and are not affected by this document-only rule.
  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.set("Pragma", "no-cache");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function redirectToCanonicalHost(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== WWW_HOST) return null;

  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";

  return withSecurityHeaders(
    new Response(null, {
      status: 308,
      headers: {
        Location: url.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    }),
  );
}

async function serveClientAsset(request: Request, env: unknown): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/assets/")) return null;

  const assets = (env as StaticAssetsEnv | null | undefined)?.ASSETS;
  if (!assets || typeof assets.fetch !== "function") return null;

  // Nitro does not serve the hashed browser chunks itself on Workers. Route
  // these requests explicitly to Cloudflare's Static Assets binding before SSR
  // so a healthy Worker cannot accidentally return a 404 for a valid client
  // bundle while runtime-health remains green.
  return withSecurityHeaders(await assets.fetch(request));
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const canonicalRedirect = redirectToCanonicalHost(request);
      if (canonicalRedirect) return canonicalRedirect;

      const clientAsset = await serveClientAsset(request, env);
      if (clientAsset) return clientAsset;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
