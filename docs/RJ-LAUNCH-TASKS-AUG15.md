# RJ Required Launch Tasks — August 15, 2026

Everything in this file requires founder credentials, a production console, a legal/business decision, or a live payment action. GitHub-side engineering work is handled separately.

## MUST COMPLETE BEFORE ACCEPTING A PAID CUSTOMER

### 1. Publish the current GitHub `main` to production
- Confirm the production project is deploying the latest `main` commit after the launch-readiness PR is merged.
- Because Lovable credits are not authorized, ChatGPT will not trigger a Lovable action that might consume credits.
- Verify `https://certivoiq.com/` opens the public welcome page and not the authenticated dashboard.

### 2. Apply / verify production Supabase migrations
Confirm the production database contains the recent migrations for:
- finding-review manifest binding;
- immutable HFA delivery receipts;
- SupportIQ fields/policies on the existing CRM support queue.

Do not assume a migration is live merely because it is merged in GitHub.

### 3. Run one LIVE Stripe purchase end-to-end
Using a real low-risk transaction that you control:
- confirm the production site is in live Stripe mode, not test mode;
- complete checkout;
- confirm the Stripe webhook is received and signature verification succeeds;
- confirm the subscription/account entitlement is provisioned in CertivoIQ;
- open the billing portal;
- confirm the customer can see the correct plan/invoice;
- refund/cancel the test transaction manually in Stripe if appropriate.

The current server code requires production values for `STRIPE_LIVE_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET`, and `LOVABLE_API_KEY` because Stripe requests currently pass through the Lovable connector gateway.

### 4. Production smoke test with a real founder account
After deploy/migrations:
- sign up / sign in;
- confirm `/` redirects to `/welcome`;
- upload one non-sensitive test certification;
- run one certification review;
- confirm a finding/evidence trail can be viewed;
- verify human approval blocking still works;
- open `/supportiq` and submit one routine question;
- submit one test escalation and confirm it appears in the CRM support queue.

## SHOULD COMPLETE AT OR IMMEDIATELY AFTER LAUNCH

### 5. Choose support escalation destinations
Provide/activate the inboxes that should receive:
- P0 security/privacy;
- P1 production/UI;
- P1 billing;
- P2 compliance/legal review.

Recommended Google Workspace addresses:
- `support@certivoiq.com`
- `security@certivoiq.com`
- `billing@certivoiq.com`

Do not publish an address until the mailbox or group actually exists and is monitored.

### 6. Review launch legal notices with counsel
Before material enterprise contracts, have qualified counsel review:
- Privacy Notice;
- Terms of Service / SaaS agreement;
- Data Processing / security terms as needed;
- limitation-of-liability and indemnity language;
- affordable-housing compliance disclaimers;
- IP ownership/contractor assignment documents.

### 7. Wyoming formation
Complete the remaining founder-specific filing inputs:
- Wyoming registered agent and physical Wyoming address;
- principal office and mailing address;
- organizer identity/signature;
- file the Articles of Organization;
- obtain EIN;
- adopt operating agreement;
- open company banking/accounting.

## LAUNCH POSITIONING — USE THIS

Launch as **Early Access / Founding Customer Launch** until production integrations and jurisdiction-specific rule packs have been independently validated.

Safe current positioning:
> CertivoIQ provides a nationwide federal compliance baseline with traceable evidence and deterministic review controls. State-specific rules are activated only after validation.

Do not represent the following as production-complete unless separately verified:
- all 50 state-specific compliance rule packs;
- live RealPage/Yardi/ResMan/AppFolio/OneSite integrations;
- external HFA delivery beyond the in-platform authorization/receipt foundation;
- guaranteed prevention of tax-credit recapture, fines, findings, or audit outcomes.

## GO / NO-GO

**GO** for public Early Access when Tasks 1–4 above pass.

**NO-GO for paid production onboarding** if deployment, database migration state, live Stripe provisioning, or the production smoke test cannot be verified.
