# Plan: Add Microsoft 365 domain validation and complete Outlook mail setup for certifyiq.app

## Goal
Finish Microsoft 365 Outlook mailboxes for `Sales@certifyiq.app`, `RWatkins@certifyiq.app`, and `Support@certifyiq.app` while keeping `notify.certifyiq.app` sending CertifyIQ app emails.

## Current state
- `certifyiq.app` was bought through Lovable, so DNS records are managed here.
- `notify.certifyiq.app` is already verified and sending CertifyIQ transactional/auth emails.
- Microsoft has provided both a TXT and a verification MX record for domain ownership.
- CRM support-ticket UI, backend, and inbound email webhook (`/api/public/crm/support-email`) are already in place.

## DNS records to add now (Step 1)

### 1.1 TXT verification record
- **Name:** `@` (root)
- **Type:** TXT
- **Value:** `MS=ms65516649`
- **TTL:** 3600

### 1.2 Verification MX record
- **Name:** `@` (root)
- **Type:** MX
- **Points to:** `ms65516649.msv1.invalid`
- **Priority:** 32767 (high priority so it does not route real mail)
- **TTL:** 3600

This `.msv1.invalid` MX record is a temporary Microsoft validation record only. It proves domain ownership and will not deliver actual mail because of the high priority and `.invalid` suffix.

## What you need to do in Microsoft 365 (Step 2)
- After we add the records above, click the verify button in the Microsoft 365 admin center.
- Once Microsoft confirms ownership, it will provide the real Exchange MX record(s) and any required CNAME records for Outlook services.
- Paste those values back here so we can add them to your Lovable DNS.

## Records we will add after Microsoft verification (Step 3)
- **Exchange MX record(s)** — so mail flows to Outlook.
- **CNAME records** — Microsoft may require these for Outlook/Autodiscover.
- **SPF update** — include `include:spf.protection.outlook.com` (and keep `notify.certifyiq.app` entries so app emails keep sending).
- **DMARC record** — `v=DMARC1; p=quarantine; rua=mailto:dmarc@certifyiq.app; pct=100` for security.
- **DKIM keys** — Microsoft will provide these after verification; we add them when available.

## Create mailboxes (Step 4)
In Microsoft 365 admin center, create:
- `Sales@certifyiq.app` (licensed user)
- `RWatkins@certifyiq.app` (licensed user)
- `Support@certifyiq.app` (free shared mailbox, or licensed user if you prefer)

## Optional email-to-ticket integration (Step 5)
- Link `Support@certifyiq.app` to the Microsoft Outlook connector in workspace settings.
- Poll the inbox for new messages and create support cases automatically.
- This lets staff respond in Outlook while tracking tickets in the CertifyIQ CRM.

## Testing checklist (Step 6)
- Send an external email to each of the three addresses and confirm it arrives in Outlook.
- Reply from each Outlook mailbox to an external address and confirm delivery.
- Send a test password-reset or billing email from CertifyIQ and confirm it still sends from `notify.certifyiq.app`.
- Create a support ticket in the CRM and verify it saves correctly.
- If email-to-ticket is enabled, send an email to `Support@certifyiq.app` and confirm a ticket appears in the CRM.

## Open questions before approval
1. Should `Support@certifyiq.app` be a free shared mailbox (no license, multiple staff can access) or a third licensed user mailbox?
2. Do you want the email-to-ticket integration enabled immediately, or only after the mailboxes are confirmed working?
3. Is `dmarc@certifyiq.app` the correct address for DMARC aggregate reports?
