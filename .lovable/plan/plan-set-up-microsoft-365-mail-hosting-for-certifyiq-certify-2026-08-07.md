# Plan: Set up Microsoft 365 mail hosting for CertifyIQ (certifyiq.app)

## Goal
Give Sales@certifyiq.app, RWatkins@certifyiq.app, and Support@certifyiq.app full Microsoft 365 Outlook mailboxes (send/receive), and finish the support-ticket tracker inside the staff-only CertifyIQ CRM.

## Domain reality
- Your website custom domain is **certifyiq.app** (with `www.certifyiq.app`). This has not changed.
- The project currently has Lovable transactional email configured for `certifyiq.com` / `notify.certifyiq.com`, but you have confirmed you only own **certifyiq.app**.
- Because you only own `.app`, we will switch the Lovable transactional email domain to `notify.certifyiq.app` and build Microsoft 365 mailboxes on `certifyiq.app`.

## What we can do from Lovable
- Manage DNS for `certifyiq.app` if the domain was bought through Lovable, or provide the exact DNS records for your external registrar if it was connected from elsewhere.
- Build/complete the CRM support-ticket UI and backend.
- Optionally read/send from the Support@ mailbox through the Microsoft Outlook connector (after you have a Microsoft 365 tenant).
- What we cannot do: purchase the Microsoft 365 subscription or create the Microsoft tenant. You must start that part, then we complete the DNS and app changes.

## Step-by-step plan

### 1. Fix Lovable transactional email domain
- Disable the current `certifyiq.com` Lovable email domain (it cannot be used since you do not own `.com`).
- Set up a new Lovable email domain for `certifyiq.app` (delegated as `notify.certifyiq.app`).
- Add the required DNS records:
  - If `certifyiq.app` was bought through Lovable: add them in **Project Settings → Domains → certifyiq.app → Configure → Manage DNS records**.
  - If `certifyiq.app` is external: add the records at your registrar/DNS host and return here once done.
- Verify the domain so app/password-reset/billing emails continue to send.

### 2. Microsoft 365 subscription (you do this)
- Choose **Microsoft 365 Business Basic** (or Business Standard if you need desktop Outlook apps).
- Licenses needed: at least **2** for Sales@ and RWatkins@. Support@ can be a free shared mailbox (no extra license) or a 3rd user mailbox if you prefer.
- During signup, choose **"Use a domain you already own"** and enter `certifyiq.app`.
- Microsoft will give you a **TXT verification record** to prove domain ownership. Copy that value and paste it here; we will add it to your DNS.
- Once Microsoft verifies the domain, provide the **MX, CNAME, and SPF** records it gives you so we can point mail flow to Outlook.

### 3. Create mailboxes (you do this, we can guide)
- In the Microsoft 365 admin center, create:
  - `Sales@certifyiq.app` (user)
  - `RWatkins@certifyiq.app` (user)
  - `Support@certifyiq.app` (shared mailbox or user, your choice)
- Set passwords or temporary passwords and share them securely.

### 4. In-app support ticket module (we complete this)
- The `support_cases` and `support_case_notes` tables, staff-only CRM Support Dashboard, and secure inbound email webhook (`/api/public/crm/support-email`) are already in place.
- Verify RLS and staff-only access for `support_cases` and related tables.
- Add a public-facing **Contact Support** form on the marketing site so visitors can submit requests that become tickets.
- Ensure the webhook maps inbound emails to existing accounts/contacts or creates them automatically.

### 5. Optional: Email-to-ticket integration
- Link the **Support@certifyiq.app** Outlook mailbox to the Microsoft Outlook connector in workspace settings.
- Poll the inbox for new unread messages and auto-create support cases from them.
- This lets the team respond in Outlook while tracking progress in the CRM.

### 6. Testing checklist
- Send an email from a personal Gmail/Outlook account to each of the three addresses and confirm it appears in the Outlook inbox.
- Send a reply from each Outlook mailbox to an external address and confirm it delivers.
- Send a test password-reset or billing notification from CertifyIQ and confirm app emails still send from `notify.certifyiq.app`.
- Create a support ticket from the CRM, assign it, and change its status.
- Submit the public contact form and confirm a ticket appears in the CRM.
- If email-to-ticket is enabled, send an email to Support@certifyiq.app and confirm a ticket appears in the CRM.

## Open questions before approval
1. Was `certifyiq.app` bought through Lovable, or is it connected from an external registrar/DNS host? This determines whether we manage the DNS records directly or give you records to paste elsewhere.
2. Do you want to start the Microsoft 365 purchase now and share the verification TXT record, or do you want us to first build the public contact-support form while you set up the tenant?
3. Should `Support@certifyiq.app` be a free shared mailbox (no license, multiple staff can access it) or a third licensed user mailbox?
4. Do you want the optional email-to-ticket integration now, or only the mailboxes and manual ticket creation to start?
