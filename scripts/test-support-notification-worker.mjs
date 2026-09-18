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

test("legacy Gmail remains a fallback only when explicit SMTP is not requested", () => {
  assert.match(worker, /explicitSmtpRequested/);
  assert.match(worker, /explicitSmtpReady/);
  assert.match(worker, /legacyGmailReady/);
  assert.match(worker, /service: "gmail"/);
  assert.match(worker, /explicitSmtpRequested \? !explicitSmtpReady : !legacyGmailReady/);
});

test("delivery remains auditable and retry-safe", () => {
  assert.match(worker, /support_notification_outbox/);
  assert.match(worker, /status: "processing"/);
  assert.match(worker, /provider_message_id: info\.messageId/);
  assert.match(worker, /status: "failed"/);
  assert.match(worker, /next_attempt_at/);
  assert.match(worker, /replyTo: mailer\.fromEmail/);
});
