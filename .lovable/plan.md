# Plan: Add Microsoft 365 domain verification and complete Outlook mail setup for CertifyIQ.app

## Goal
Finish setting up Microsoft 365 Outlook mailboxes for `Sales@certifyiq.app`, `RWatkins@certifyiq.app`, and `Support@certifyiq.app` while keeping `notify.certifyiq.app` working for CertifyIQ app/authentication emails.

## Current state
- `certifyiq.app` was bought through Lovable, so DNS records are managed in Lovable.
- `notify.certifyiq.app` is already verified and sending CertifyIQ transactional/auth emails.
- Microsoft domain verification TXT record has been provided: `MS=ms65516649` on `@` with TTL 3600.
- CRM support-ticket UI, backend, and inbound email webhook are already in place.

## Step-by-step plan

### 1. Add Microsoft verification TXT record to `certifyiq.app`
- Open **Project Settings → Project section → Domains → certifyiq.app → Configure → Manage DNS records**.
- Add a TXT record:
  - **Name:** `@` (root)
  - **Value:** `MS=ms65516649`
  - **TTL:** `3600`
- Save and wait for DNS propagation (usually minutes, up to 72 hours).

### 2. Verify domain in Microsoft 365
- In the Microsoft 365 admin center, click the option to verify the domain.
- Microsoft will look for the TXT record and confirm ownership.
- Once verified, Microsoft will provide the Exchange MX record(s) and any required CNAME records for Outlook services.

### 3. Add Microsoft Exchange MX and service records
- Return to the Lovable DNS manager for `certifyiq.app`.
- Add the MX record(s) Microsoft provides so mail flows to Outlook.
- Add any CNAME records Microsoft requires for Outlook/Autodiscover.
- Update the existing SPF record (or create one) to include Microsoft's sending servers. Example: `v=spf1 include:spf.protection.outlook.com ~all`.
- Add/update DMARC record for security: `v=DMARC1; p=quarantine; rua=mailto:dmarc@certifyiq.app; pct=100`.
- Add DKIM if enabled inside Microsoft 365 after domain verification.

### 4. Create Outlook mailboxes
- In the Microsoft 365 admin center, create:
  - `Sales@certifyiq.app` (licensed user)
  - `RWatkins@certifyiq.app` (licensed user)
  - `Support@certifyiq.app` (free shared mailbox, or licensed user if preferred)
- Configure passwords and access for staff.

### 5. Connect Support mailbox to the CRM (optional email-to-ticket)
- Link the Microsoft Outlook connector to the `Support@certifyiq.app` mailbox in workspace settings.
- Configure polling or forwarding so inbound support emails hit the existing webhook at `/api/public/crm/support-email`.
- This lets staff respond in Outlook while tracking tickets in the CertifyIQ CRM.

### 6. Test everything
- Send an external email to each address and confirm it appears in Outlook.
- Reply from each Outlook mailbox to an external address and confirm delivery.
- Send a test password-reset or billing email from the CertifyIQ app and confirm it still sends from `notify.certifyiq.app`.
- Create a support ticket in the CRM and verify it saves correctly.
- If email-to-ticket is enabled, send an email to `Support@certifyiq.app` and confirm a ticket appears in the CRM.

## Open questions before approval
1. Do you want to proceed with adding the TXT record now?
2. Should `Support@certifyiq.app` be a free shared mailbox (no extra license) or a third licensed user mailbox?
3. Do you want the email-to-ticket integration enabled immediately, or only after the mailboxes are confirmed working?
4. Do you have a preferred email address for DMARC aggregate reports (e.g., `dmarc@certifyiq.app`)?
