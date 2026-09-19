import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(
  new URL("../supabase/functions/support-notification-worker/index.ts", import.meta.url),
  "utf8",
);
const config = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);

test("support worker keeps explicit internal authentication while verify_jwt is disabled", () => {
  assert.match(config, /\[functions\.support-notification-worker\][\s\S]*verify_jwt = false/);
  assert.match(worker, /SUPPORT_NOTIFICATION_WORKER_SECRET/);
  assert.match(worker, /x-support-worker-secret/);
  assert.match(worker, /admin\.auth\.getUser/);
  assert.match(worker, /Staff access required/);
});

test("support worker supports explicit provider-neutral SMTP without hardcoded credentials", () => {
  for (const name of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
  ]) {
    assert.match(worker, new RegExp(name));
  }
  assert.match(worker, /nodemailer\.createTransport\(\{\s*host:/);
  assert.match(worker, /requireTLS: !smtpSecure/);
  assert.doesNotMatch(worker, /smtp\.office365\.com/);
  assert.doesNotMatch(worker, /SMTP_PASSWORD[^\n]*=/);
});

test("legacy Gmail supports separate authentication and support sender identities", () => {
  assert.match(worker, /GMAIL_USER/);
  assert.match(worker, /GMAIL_FROM_EMAIL/);
  assert.match(worker, /gmailFrom/);
  assert.match(worker, /explicitSmtpRequested/);
  assert.match(worker, /explicitSmtpReady/);
  assert.match(worker, /legacyGmailReady/);
  assert.match(worker, /service: "gmail"/);
  assert.match(worker, /auth: \{ user: gmailUser, pass: gmailPassword!/);
  assert.match(worker, /fromEmail: gmailFrom/);
  assert.match(worker, /providerReady/);
  assert.match(worker, /gmailUserOauthReady \|\| gmailApiReady \|\| \(explicitSmtpRequested \? explicitSmtpReady : legacyGmailReady\)/);
});

test("delivery remains auditable and retry-safe", () => {
  assert.match(worker, /support_notification_outbox/);
  assert.match(worker, /status: "processing"/);
  assert.match(worker, /provider_message_id: info\.messageId/);
  assert.match(worker, /status: "failed"/);
  assert.match(worker, /next_attempt_at/);
  assert.match(worker, /replyTo: smtpMailer!\.fromEmail/);
  assert.match(worker, /Reply-To:/);
});


test("support worker prefers Gmail API OAuth when Workspace delegation is configured", () => {
  assert.match(worker, /GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON/);
  assert.match(worker, /GOOGLE_WORKSPACE_IMPERSONATED_USER/);
  assert.match(worker, /gmailApiReady/);
  assert.match(worker, /https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(worker, /https:\/\/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send/);
  assert.match(worker, /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
  assert.match(worker, /SignJWT/);
  assert.match(worker, /importPKCS8/);
  assert.match(worker, /gmailApiReady \|\|/);
  assert.match(worker, /const smtpMailer = !\(gmailUserOauthReady \|\| gmailApiReady\)/);
});

test("Gmail API keeps support sender separate from delegated auth user", () => {
  assert.match(worker, /fromEmail: gmailFrom/);
  assert.match(worker, /impersonatedUser: workspaceImpersonatedUser/);
  assert.match(worker, /Reply-To:/);
  assert.match(worker, /CertivoIQ Technical Support/);
});


test("support worker supports Gmail user OAuth refresh-token delivery without service-account keys", () => {
  for (const name of [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REFRESH_TOKEN",
  ]) {
    assert.match(worker, new RegExp(name));
  }
  assert.match(worker, /gmailUserOauthReady/);
  assert.match(worker, /grant_type: "refresh_token"/);
  assert.match(worker, /Google user OAuth refresh failed/);
  assert.match(worker, /gmailUserOauthReady\s*\? await sendWithGmailApi/);
  assert.match(worker, /accessToken: await gmailUserOAuthAccessToken/);
});
