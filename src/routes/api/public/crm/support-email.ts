import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

const emailWebhookSchema = z.object({
  from: z.string().email(),
  to: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  subject: z.string().min(1),
  body: z.string().default(""),
  messageId: z.string().optional(),
  attachments: z
    .array(z.object({ filename: z.string(), url: z.string().url().optional() }))
    .optional(),
});

export const Route = createFileRoute("/api/public/crm/support-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SUPPORT_EMAIL_WEBHOOK_SECRET"];
        if (!secret) {
          return new Response("Server configuration error", { status: 500 });
        }

        const url = new URL(request.url);
        const provided =
          request.headers.get("X-Webhook-Secret") ??
          url.searchParams.get("token") ??
          "";
        const providedBuf = Buffer.from(provided);
        const secretBuf = Buffer.from(secret);
        if (
          providedBuf.length !== secretBuf.length ||
          !timingSafeEqual(providedBuf, secretBuf)
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const raw = await request.json();
        const parsed = emailWebhookSchema.safeParse(raw);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: parsed.error.flatten() }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const { from, subject, body } = parsed.data;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: contact } = await supabaseAdmin
          .from("crm_contacts")
          .select("id, account_id")
          .eq("email", from)
          .maybeSingle();

        let accountId = contact?.account_id ?? null;
        let contactId = contact?.id ?? null;

        if (!accountId) {
          const domain = from.split("@")[1];
          const { data: account, error: accountError } = await supabaseAdmin
            .from("crm_accounts")
            .insert({
              name: domain,
              account_type: "company",
              stage: "new",
              source: "support_email",
            })
            .select("id")
            .single();
          if (accountError) throw accountError;
          accountId = account.id;
        }

        if (!contactId && accountId) {
          const { data: newContact, error: contactError } = await supabaseAdmin
            .from("crm_contacts")
            .insert({
              account_id: accountId,
              name: from,
              email: from,
              is_primary: true,
            })
            .select("id")
            .single();
          if (contactError) throw contactError;
          contactId = newContact.id;
        }

        const { data: caseRow, error: caseError } = await supabaseAdmin
          .from("support_cases")
          .insert({
            account_id: accountId,
            contact_id: contactId,
            subject,
            description: body,
            channel: "email",
            source_email: from,
            status: "open",
            priority: "normal",
            tags: ["inbound"],
          })
          .select("case_number")
          .single();
        if (caseError) throw caseError;

        return new Response(
          JSON.stringify({ ok: true, case_number: caseRow.case_number }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
