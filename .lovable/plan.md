# Rebrand CertifyIQ → CertivoIQ (certivoiq.com)

Full rename of the product name, domain, staff logins, and email sending. The old domain stays connected as a redirect so existing links keep working.

## What you need to do first (I can't do these)

1. **Buy certivoiq.com** — Project Settings → Domains → Buy new domain. (I can't purchase or check availability; if `.com` is unavailable at checkout, tell me the alternative you pick and I'll adjust.)
2. Set **certivoiq.com** as Primary, keep **certifyiq.app** connected so it redirects.
3. After I wire up the new sender domain, add the NS records shown in Cloud → Emails for `notify.certivoiq.com`.
4. In Microsoft 365, add certivoiq.com as a new accepted domain and recreate the mailboxes (`sales@`, `rwatkins@`, `support@`, `dmarc@`). The old certifyiq.app mailboxes can stay until you're ready to retire them.

## Name changes in the app

- Wordmark and sidebar branding: "CertifyIQ" → "CertivoIQ" (the gold "IQ" highlighting stays, and the `IQText` helper keeps working unchanged since it matches on "IQ").
- All user-facing copy: Dashboard title, CRM Dashboard, CertifyIQ Academy → CertivoIQ Academy, LaunchPad, trial pages, pricing, welcome/marketing page, security page, Merlin's intro text, certificate credential wording, and the "verifiable at …" URL.
- SEO metadata on every route: titles, descriptions, og:title/og:description, canonical and og:url switched to `https://certivoiq.com`.
- Marketing kit one-pager and the cold intro email: brand name, links, and footer domain.
- Downloaded recovery-codes filename and authenticator label.

## Email changes

- Sender domain moves from `notify.certifyiq.app` to `notify.certivoiq.com`, and the visible From becomes `noreply@certivoiq.com`, across the auth webhook and the transactional send helper.
- All email templates (signup, magic link, recovery, invite, email change, reauthentication, invoice created, payment succeeded, payment failed, support request received, cold intro) get the new brand name and links.
- Support inbox reference becomes `support@certivoiq.com`.

## Staff access changes

- The staff-domain gate moves from `certifyiq.app` to `certivoiq.com` in both the app-side constant and the database signup trigger.
- Your existing staff accounts (`sales@`, `rwatkins@`) are migrated to `@certivoiq.com` so you keep CRM access with the same passwords. Because the trigger only grants staff on a *verified* email, I'll keep the existing staff role rows intact during the migration rather than relying on re-verification.
- Seeded CRM demo content (news ticker items, campaign templates) that mentions the old brand gets updated text.

## Technical notes

- Files touched: `src/components/app-shell.tsx`, `src/hooks/use-session.tsx` (`STAFF_DOMAIN`), all route files under `src/routes/` with `head()` metadata, `src/lib/platform-data.ts`, `src/lib/trial-data.ts`, `src/lib/academy-track-a.ts`, `src/lib/crm.ts`, `src/components/merlin.tsx`, `src/components/crm/*`, `src/lib/email-templates/*`, `src/lib/email-templates/send-email.ts`, `src/lib/billing-emails.server.ts`, `src/routes/lovable/email/auth/webhook.ts` and `preview.ts`, `src/routes/_authenticated/marketing-kit.tsx`, `README.md`, and `src/styles.css` comments.
- One database migration: update `handle_new_user` staff-domain check, rewrite staff `profiles`/auth emails to `@certivoiq.com`, and refresh brand strings in `crm_news` / `crm_templates`.
- Stripe products/prices keep their IDs; only the display names referencing the brand get updated where they surface in the app copy.
- Existing past migration files are left as-is (history is immutable).
- Favicon and the "IQ" monogram artwork stay valid — the mark is "IQ", not "Certify".

## Order of work

1. You buy and connect certivoiq.com.
2. I run the database migration (staff domain + seeded copy).
3. I rebrand all app code, copy, SEO, and email templates.
4. I re-point the email sender domain and hand you the NS records for `notify.certivoiq.com`.
5. Publish, then you finish the Microsoft 365 mailbox setup on the new domain.

## Verification

- Sign in with the migrated `rwatkins@certivoiq.com` and confirm the CRM Dashboard still appears.
- Trigger a password reset and confirm the email arrives from `noreply@certivoiq.com` with CertivoIQ branding.
- Load the published site on certivoiq.com and confirm certifyiq.app redirects to it.
- Check page titles/social previews show CertivoIQ (link previews may take a while to refresh in each platform's cache).
