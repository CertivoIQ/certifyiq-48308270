# Finish the CertivoIQ.com cutover

The app code is already fully rebranded — no references to the old name or old domains remain anywhere in the app, and both staff logins (`sales@certivoiq.com`, `rwatkins@certivoiq.com`) already exist, are verified, and hold staff/CRM access. What's left is domain-level wiring plus a few polish items.

## Current state (verified)

- Custom domain connected to the project: `www.certivoiq.com`
- Email sending domain the project points at: `certifyiq.com` (stuck pending — the old name)
- The app's sender is configured as `notify.certivoiq.com`, which is not registered yet, so app and auth emails cannot send until it is
- No canonical or `og:url` tags exist on any page

## 1. Make certivoiq.com the primary site domain

Add the root `certivoiq.com` alongside `www.certivoiq.com` and set one as Primary so the other redirects to it. This is done in Project Settings → Domains; I'll confirm which records are outstanding once you're in there.

Keep `certifyiq.app` connected so existing links and anything already shared keeps resolving.

## 2. Switch email sending to notify.certivoiq.com

Register `notify.certivoiq.com` as the project's email domain through the email setup dialog. Lovable delegates that subdomain and manages SPF/DKIM/MX inside it automatically — you add only the delegation records it shows you.

Once it verifies, auth emails (signup confirmation, password reset, magic link, email change, reauthentication) and app emails (invoice created, payment succeeded, payment failed, support request received, cold intro) all start sending from `noreply@certivoiq.com` with the existing CertivoIQ-branded templates. No template or code changes are needed — the sender config already points here.

The old pending `certifyiq.com` email domain gets dropped so it stops sitting half-configured.

## 3. Point Microsoft 365 mail at the new domain

The Outlook setup we started was against the old domain, so it needs redoing on `certivoiq.com`: add the domain in Microsoft 365, add the Microsoft MX / autodiscover / SPF records, then recreate the mailboxes — `sales@`, `rwatkins@`, `support@` (free shared mailbox), and `dmarc@` for reports.

Important: Microsoft's records go on the **root** `certivoiq.com` zone, while Lovable's email delegation lives on the `notify.` subdomain. They don't conflict — mail you send and receive in Outlook and mail the app sends are separate paths.

## 4. Polish items in the app

- Add self-referencing `canonical` and `og:url` tags on each content page, pointed at `certivoiq.com`, so search engines attribute pages correctly after the domain change rather than splitting them across old and new hostnames.
- Add a `sitemap.xml` listing the public routes, and reference it from `robots.txt`.

## 5. Verify

- Sign out and sign in as `sales@certivoiq.com` to confirm CRM access still gates correctly on the new staff domain.
- Trigger a password reset to confirm auth email delivery from the new sender.
- Submit the support form to confirm the app email path and CRM case creation.
- Check delivery outcomes in Cloud → Emails.

## Technical notes

`SENDER_DOMAIN` and `FROM_DOMAIN` in `src/lib/email-templates/send-email.ts` and `src/routes/lovable/email/auth/webhook.ts` are already `notify.certivoiq.com` / `certivoiq.com`, and `STAFF_DOMAIN` in `src/hooks/use-session.tsx` plus the `handle_new_user()` database trigger are already on `certivoiq.com`. No edits needed there. Only the SEO tags and sitemap in step 4 are code changes; steps 1-3 are domain and mailbox configuration.
