# Google Workspace mail + app sending for certivoiq.com

Mail hosting moves to Google Workspace on `certivoiq.com`, and the app's own sending subdomain gets registered in the same pass.

## 1. Register the app's sending domain

Register `notify.certivoiq.com` as this project's email domain through the email setup dialog, and drop the stale pending `certifyiq.com` entry so it stops sitting half-configured.

Lovable delegates the `notify.` subdomain via two nameserver records and manages SPF, DKIM, and MX inside that zone itself — you add only the delegation records it shows you, at Name.com (Project Settings → Domains → certivoiq.com → Manage DNS records).

Once it verifies, these start sending from `noreply@certivoiq.com` using the existing CertivoIQ-branded templates, with no code changes needed:

- Auth: signup confirmation, password reset, magic link, email change, reauthentication
- App: invoice created, payment succeeded, payment failed, support request received, cold intro

## 2. Set up Google Workspace

Sign up for Google Workspace Business Starter using `rwatkins@certivoiq.com` as the admin account, then verify `certivoiq.com` with the single TXT record Google provides.

After verification, add Google's five MX records at Name.com. These go on the **root** `certivoiq.com` zone and do not conflict with the `notify.` delegation from step 1 — inbound mail and app sending are separate paths.

## 3. Create the mailboxes

| Address | Type |
|---|---|
| `rwatkins@certivoiq.com` | Licensed user (admin) |
| `sales@certivoiq.com` | Licensed user |
| `hello@certivoiq.com` | Group (free) — already referenced in the marketing kit and cold-email template |
| `support@certivoiq.com` | Group (free) — shared inbox for the CRM |
| `dmarc@certivoiq.com` | Group (free) — receives aggregate reports |

Groups are free in Workspace, so only the two real people consume licenses.

## 4. Add SPF and DMARC on the root domain

Once Google's MX records are live, add a root SPF record authorizing Google to send, and a DMARC record pointing reports at `dmarc@certivoiq.com`, starting in monitor mode so nothing is rejected while things settle. Google generates DKIM in the admin console; that gets turned on after the mailboxes exist.

## 5. Verify

- Send mail in and out of `sales@` and `rwatkins@` to confirm delivery both directions.
- Confirm `hello@`, `support@`, and `dmarc@` receive mail.
- Trigger a password reset in the app to confirm auth email delivery from the new sender, and submit the support form to confirm the app email path plus CRM case creation.
- Check delivery outcomes in Cloud → Emails.

## Notes

No app code changes are required for any of this — `SENDER_DOMAIN` and `FROM_DOMAIN` are already `notify.certivoiq.com` / `certivoiq.com`, `hello@certivoiq.com` is already the contact address in the marketing templates, and the support form already routes into the CRM. Everything here is DNS and Workspace configuration.

Connecting `support@` as an automatic email-to-ticket feed into the CRM stays deferred until the mailboxes are confirmed working, as you asked earlier.
