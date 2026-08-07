# Plan: Set up Microsoft 365 mail hosting for CertifyIQ

## Goal
Give Sales@CertifyIQ.com, RWatkins@CertifyIQ.com, and Support@CertifyIQ.com full Microsoft 365 Outlook mailboxes (send/receive), and add a support-ticket tracker inside the staff-only CertifyIQ CRM.

## What we can do from Lovable
- Add/modify DNS records for the domain because it was bought through Lovable.
- Build the CRM support-ticket UI and backend.
- Optionally read/send from the Support@ mailbox through the Microsoft Outlook connector.
- What we cannot do: purchase the Microsoft 365 subscription or create the Microsoft tenant. You must start that part, then we complete the DNS and app changes.

## Step-by-step plan

### 1. Microsoft 365 subscription (you do this)
- Choose **Microsoft 365 Business Basic** (or Business Standard if you need desktop Outlook apps).
- Licenses needed: at least **2** for Sales@ and RWatkins@. Support@ can be a free shared mailbox (no extra license) or a 3rd user mailbox if you prefer.
- During signup, choose **"Use a domain you already own"** and enter `certifyiq.com`.
- Microsoft will give you a **TXT verification record** to prove domain ownership. Copy that value and paste it here; we will add it in Lovable DNS.

### 2. Domain DNS in Lovable (we do this)
- Open **Project Settings → Domains → certifyiq.com → Configure → Manage DNS records**.
- Add Microsoft’s domain-verification TXT record.
- Once Microsoft verifies the domain, add Microsoft’s Exchange MX record(s) so mail flows to Outlook.
- Add/update SPF, DKIM, and DMARC records for good deliverability and security.
- **Important:** Lovable’s app/authentication emails are sent from the delegated `notify.certifyiq.com` subdomain, so adding root-domain MX/SPF records for Outlook will not break app notifications.

### 3. Create mailboxes (you do this, we can guide)
- In the Microsoft 365 admin center, create:
  - `Sales@certifyiq.com` (user)
  - `RWatkins@certifyiq.com` (user)
  - `Support@certifyiq.com` (shared mailbox or user, your choice)
- Set passwords or temporary passwords and share them securely.

### 4. In-app support ticket module (we build this)
- Add a `support_cases` table to the backend with fields: subject, description, requester_email, source, status, priority, assigned_staff, notes, created_at, updated_at.
- Enable RLS and restrict access to staff roles (`@certifyiq.com` / `staff` role).
- Add a **Support Cases** section to the CertifyIQ CRM Dashboard with:
  - Ticket list with filters/status
  - Detail view with notes, assignee, and status changes
  - Manual "Create ticket" form for staff
- Add a public-facing contact form (if not already present) so visitors can submit requests that become tickets.

### 5. Optional: Email-to-ticket integration
- Link the **Support@certifyiq.com** Outlook mailbox to the Microsoft Outlook connector in workspace settings.
- Poll the inbox for new unread messages and auto-create support cases from them.
- This lets the team respond in Outlook while tracking progress in CRM.

### 6. Testing checklist
- Send an email from a personal Gmail/Outlook account to each of the three addresses and confirm it appears in the Outlook inbox.
- Send a reply from each Outlook mailbox to an external address and confirm it delivers.
- Send a test password-reset or billing notification from CertifyIQ and confirm app emails still send from `notify.certifyiq.com`.
- Create a support ticket from the CRM, assign it, and change its status.
- If email-to-ticket is enabled, send an email to Support@CertifyIQ.com and confirm a ticket appears in CRM.

## Open questions before approval
1. Do you want to start the Microsoft 365 purchase now and share the verification TXT record, or do you want us to first build the CRM support-ticket module while you set up the tenant?
2. Should `Support@certifyiq.com` be a free shared mailbox (no license, multiple staff can access it) or a third licensed user mailbox?
3. Do you also need a public "Contact Support" form on the marketing site, or should tickets be created only by staff manually?
