import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const cleanError = (value: unknown) =>
  (value instanceof Error ? value.message : String(value)).slice(0, 1000);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const workerSecret = Deno.env.get("SUPPORT_NOTIFICATION_WORKER_SECRET");

  const smtpHost = Deno.env.get("SMTP_HOST")?.trim();
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "587");
  const smtpSecure = (Deno.env.get("SMTP_SECURE") || "false").trim().toLowerCase() === "true";
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD")?.trim();
  const smtpFrom = (Deno.env.get("SMTP_FROM_EMAIL") || smtpUser || "").trim();

  const gmailUser = (Deno.env.get("GMAIL_USER") || "support@certivoiq.com").trim();
  const gmailFrom = (Deno.env.get("GMAIL_FROM_EMAIL") || "support@certivoiq.com").trim();
  // Google displays app passwords in spaced groups; SMTP requires the credential itself.
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "");

  const explicitSmtpRequested = Boolean(
    smtpHost || smtpUser || smtpPassword || Deno.env.get("SMTP_FROM_EMAIL") || Deno.env.get("SMTP_PORT"),
  );
  const explicitSmtpReady = Boolean(
    smtpHost && Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535 &&
    smtpUser && smtpPassword && smtpFrom,
  );
  const legacyGmailReady = Boolean(gmailUser && gmailPassword && gmailFrom);

  if (!supabaseUrl || !serviceRoleKey || (explicitSmtpRequested ? !explicitSmtpReady : !legacyGmailReady)) {
    return json({ error: "Support notification service is not configured." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suppliedSecret = req.headers.get("x-support-worker-secret") || "";
  const internalAuthorized = Boolean(workerSecret && suppliedSecret && suppliedSecret === workerSecret);

  if (!internalAuthorized) {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "staff")
      .maybeSingle();
    if (!role) return json({ error: "Staff access required" }, 403);
  }

  const { data: pending, error: selectError } = await admin
    .from("support_notification_outbox")
    .select("id,recipient_email,subject,html_body,text_body,attempt_count")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  if (selectError) return json({ error: selectError.message }, 500);
  if (!pending?.length) return json({ processed: 0, sent: 0, failed: 0 });

  const mailer = explicitSmtpReady
    ? {
        transporter: nodemailer.createTransport({
          host: smtpHost!,
          port: smtpPort,
          secure: smtpSecure,
          requireTLS: !smtpSecure,
          auth: { user: smtpUser!, pass: smtpPassword! },
        }),
        fromEmail: smtpFrom,
      }
    : {
        transporter: nodemailer.createTransport({
          service: "gmail",
          auth: { user: gmailUser, pass: gmailPassword! },
        }),
        fromEmail: gmailFrom,
      };

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    const lockedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("support_notification_outbox")
      .update({ status: "processing", locked_at: lockedAt, updated_at: lockedAt })
      .eq("id", item.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) continue;

    try {
      const info = await mailer.transporter.sendMail({
        from: `CertivoIQ Technical Support <${mailer.fromEmail}>`,
        to: item.recipient_email,
        replyTo: mailer.fromEmail,
        subject: item.subject,
        text: item.text_body,
        html: item.html_body,
      });

      await admin.from("support_notification_outbox").update({
        status: "sent",
        attempt_count: Number(item.attempt_count || 0) + 1,
        sent_at: new Date().toISOString(),
        provider_message_id: info.messageId || null,
        last_error: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      sent += 1;
    } catch (error) {
      const attempts = Number(item.attempt_count || 0) + 1;
      const retryMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
      await admin.from("support_notification_outbox").update({
        status: "failed",
        attempt_count: attempts,
        next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
        last_error: cleanError(error),
        locked_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      failed += 1;
    }
  }

  return json({ processed: sent + failed, sent, failed });
});

