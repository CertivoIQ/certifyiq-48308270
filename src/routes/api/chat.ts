import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { MERLIN_SYSTEM_PROMPT } from "@/lib/merlin-knowledge.server";

type ChatRequestBody = { messages?: unknown };

const MAX_CHAT_BYTES = 20_000;
const MAX_MESSAGES = 20;

function approvedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === "https://certivoiq.com") return true;
  return process.env["NODE_ENV"] !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env["MERLIN_PUBLIC_CHAT_ENABLED"] !== "true") {
          return new Response("Merlin chat is not enabled", { status: 503 });
        }
        if (!approvedOrigin(request)) {
          return new Response("Forbidden", { status: 403 });
        }
        const declaredLength = Number(request.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_CHAT_BYTES) {
          return new Response("Request is too large", { status: 413 });
        }
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > MAX_CHAT_BYTES) {
          return new Response("Request is too large", { status: 413 });
        }
        let body: ChatRequestBody;
        try {
          body = JSON.parse(raw) as ChatRequestBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const { messages } = body;
        if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("Chat is not configured", { status: 503 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: MERLIN_SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
