import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const cleanError = (value: unknown) =>
  (value instanceof Error ? value.message : String(value)).slice(0, 1000);

const base64Url = (value: string) =>
  btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
};

async function gmailUserOAuthAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      `Google user OAuth refresh failed: ${String(payload?.error_description ?? payload?.error ?? response.status).slice(0, 500)}`,
    );
  }
  return String(payload.access_token);
}

async function gmailApiAccessToken(
  serviceAccountJson: string,
  impersonatedUser: string,
): Promise<string> {
  let account: GoogleServiceAccount;
  try {
    account = JSON.parse(serviceAccountJson) as GoogleServiceAccount;
  } catch {
    throw new Error("Google Workspace service account JSON is invalid");
  }
  if (!account.client_email || !account.private_key) {
    throw new Error("Google Workspace service account JSON is incomplete");
  }

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/gmail.send",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(impersonatedUser)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      `Google Workspace OAuth token exchange failed: ${String(payload?.error_description ?? payload?.error ?? response.status).slice(0, 500)}`,
    );
  }
  return String(payload.access_token);
}

function gmailRawMessage(input: {
  fromEmail: string;
  recipientEmail: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
}) {
  const boundary = `certivoiq-${crypto.randomUUID()}`;
  const subject = input.subject.replace(/[\r\n]+/g, " ");
  const recipient = input.recipientEmail.replace(/[\r\n]+/g, "");
  const from = input.fromEmail.replace(/[\r\n]+/g, "");
  const lines = [
    `From: CertivoIQ Technical Support <${from}>`,
    `To: ${recipient}`,
    `Reply-To: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.textBody ?? "",
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.htmlBody ?? "",
    "",
    `--${boundary}--`,
  ];
  return base64Url(lines.join("\r\n"));
}

async function sendWithGmailApi(input: {
  accessToken: string;
  fromEmail: string;
  recipientEmail: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
}) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      raw: gmailRawMessage(input),
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.id) {
    throw new Error(
      `Gmail API send failed: ${String(payload?.error?.message ?? response.status).slice(0, 500)}`,
    );
  }
  return { messageId: String(payload.id) };
}

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
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "");

  const googleOauthClientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")?.trim();
  const googleOauthClientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")?.trim();
  const googleOauthRefreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN")?.trim();
  const gmailUserOauthReady = Boolean(
    googleOauthClientId && googleOauthClientSecret && googleOauthRefreshToken && gmailFrom,
  );

  const workspaceServiceAccountJson = Deno.env.get("GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON")?.trim();
  const workspaceImpersonatedUser = (
    Deno.env.get("GOOGLE_WORKSPACE_IMPERSONATED_USER") || gmailUser
  ).trim();
  const gmailApiReady = Boolean(
    workspaceServiceAccountJson && workspaceImpersonatedUser && gmailFrom,
  );

  const explicitSmtpRequested = Boolean(
    smtpHost || smtpUser || smtpPassword || Deno.env.get("SMTP_FROM_EMAIL") || Deno.env.get("SMTP_PORT"),
  );
  const explicitSmtpReady = Boolean(
    smtpHost && Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535 &&
    smtpUser && smtpPassword && smtpFrom,
  );
  const legacyGmailReady = Boolean(gmailUser && gmailPassword && gmailFrom);
  const providerReady =
    gmailUserOauthReady || gmailApiReady || (explicitSmtpRequested ? explicitSmtpReady : legacyGmailReady);

  if (!supabaseUrl || !serviceRoleKey || !providerReady) {
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

  const smtpMailer = !(gmailUserOauthReady || gmailApiReady)
    ? explicitSmtpReady
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
        }
    : null;

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
      const info = gmailUserOauthReady
        ? await sendWithGmailApi({
            accessToken: await gmailUserOAuthAccessToken(
              googleOauthClientId!,
              googleOauthClientSecret!,
              googleOauthRefreshToken!,
            ),
            fromEmail: gmailFrom,
            recipientEmail: item.recipient_email,
            subject: item.subject,
            textBody: item.text_body,
            htmlBody: item.html_body,
          })
        : gmailApiReady
          ? await sendWithGmailApi({
              accessToken: await gmailApiAccessToken(
                workspaceServiceAccountJson!,
                workspaceImpersonatedUser,
              ),
              fromEmail: gmailFrom,
              recipientEmail: item.recipient_email,
              subject: item.subject,
              textBody: item.text_body,
              htmlBody: item.html_body,
            })
          : await smtpMailer!.transporter.sendMail({
            from: `CertivoIQ Technical Support <${smtpMailer!.fromEmail}>`,
            to: item.recipient_email,
            replyTo: smtpMailer!.fromEmail,
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
