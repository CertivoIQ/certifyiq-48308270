# CertivoIQ

**Affordable housing compliance intelligence — AI-powered evidence review with human-approved decisions.**

CertivoIQ helps owners, operators, compliance teams, and housing organizations review certification evidence, apply versioned program rules, surface traceable findings, and keep a defensible human approval workflow.

## Product

CertivoIQ is designed around a simple principle:

> **AI does the reading. Your team owns the decision.**

The platform is not positioned as an autonomous legal or compliance decision-maker. AI assists with document reading, extraction, organization, explanation, and workflow; deterministic rule logic evaluates applicable requirements; a qualified human retains final approval authority.

### Core customer journey

1. A prospect arrives through the public site or a direct campaign.
2. The prospect starts **3 FREE certification reviews** with no card required.
3. Company and decision-maker information is captured before the free review so the opportunity can be tracked as a qualified CRM lead.
4. The user uploads one certification at a time during the free-review experience.
5. CertivoIQ extracts evidence, evaluates the assigned rule pack, and returns traceable findings.
6. The reviewer investigates, resolves, and approves findings.
7. After the free-review capacity is used, the user chooses a paid platform plan.
8. Stripe Checkout provisions the paid subscription and the account entitlement layer unlocks paid capabilities.
9. Paid customers can use portfolio workflows, including mass certification processing subject to plan entitlements.

## Product architecture

```text
Public marketing site
        |
        v
3 FREE certification reviews
        |
        +--> company/contact capture --> CRM lead
        |
        v
Certification upload
        |
        v
Document intelligence / evidence extraction
        |
        v
Versioned deterministic rule packs
        |
        v
Traceable findings + remediation
        |
        v
Human review and approval
        |
        v
Portfolio compliance operations
        |
        v
Stripe subscription + entitlement enforcement
```

The application is a TypeScript/TanStack Start web application with Tailwind/shadcn UI and Supabase-backed data, authentication, storage, and server functions. Stripe provides recurring subscription billing and paid-product checkout.

## Supported programs

The platform's current program registry includes:

- LIHTC / IRC Section 42
- Project-Based Section 8
- HOME Investment Partnerships
- HOTMA overlays and income/asset provisions
- USDA Rural Development 515/521
- Tax-exempt bond set-aside programs

State support is represented through maintained rule-pack architecture and a 50-state registry. Availability and rule coverage should always be verified against the applicable current rule pack before a production compliance decision.

## Compliance philosophy

CertivoIQ is built for defensibility rather than opaque automation.

- **Evidence first:** findings remain connected to source evidence where supported by the workflow.
- **Version-aware rules:** evaluations can be tied to the rule pack/version used.
- **Human approval:** AI findings are not presented as final legal or compliance determinations.
- **Traceability:** reviewers should be able to understand why a finding was raised and what evidence supports it.
- **Conservative automation:** exceptions and potential high-risk findings are surfaced for human investigation.

## Human approval model

The review pipeline is intentionally split into four stages:

1. **AI extracts** — read and structure certification evidence.
2. **Rules evaluate** — apply the assigned deterministic rule set.
3. **Evidence connects** — connect findings to source evidence and rule context.
4. **Human approves** — a qualified reviewer resolves and approves the outcome.

## Free-review model

CertivoIQ's acquisition wedge is **3 FREE certification reviews**, not a seven-day card-based trial.

- No payment card is required to start.
- Company/contact information is required before the first free upload.
- Free users submit one certification at a time.
- Mass certification review (2+ files in one job) requires an active paid platform subscription.
- The mass-upload restriction is enforced at the database/storage policy layer, not only in the browser.

## Paid subscription architecture

Current self-serve platform plans:

| Plan | Price | Core entitlement |
|---|---:|---|
| Professional | $999/month | Up to 500 units, 1 state, unlimited properties |
| Business | $4,999/month | Up to 10,000 units, multi-property portfolio, state rule packs |
| Enterprise | $9,999/month | Unlimited units, multi-state, API/SSO/white-label and enterprise capabilities |
| Enterprise Plus | $14,999/month | Enterprise plus custom rule development, higher API throughput, custom reporting |

Add-ons include CertivoIQ Academy, additional state rule packs, API access, and AI document processing beyond the included plan allowance.

The application maintains a plan/entitlement catalog that maps Stripe lookup keys to product limits. The canonical Professional entitlement is **500 units / 1 state / unlimited properties**.

## Stripe architecture

Stripe is the source of truth for customer billing. The application uses Stripe recurring Prices for platform plans and a one-time Price for AI document-processing overage.

Canonical lookup keys include:

- `professional_monthly`
- `business_monthly`
- `enterprise_monthly`
- `enterprise_plus_monthly`
- `academy_seat_monthly`
- `academy_property_monthly`
- `ai_document_overage_each`

The current AI document overage price is **$3 per certification beyond the plan allowance**.

Do not hard-code new Stripe price IDs into customer-facing copy. Use the plan catalog and Stripe lookup-key architecture so marketing, checkout, and entitlements remain synchronized.

## Security and data handling

The application uses Supabase authentication, PostgreSQL row-level security, storage policies, server-side entitlement checks, and audit-oriented data structures.

Important production controls include:

- authenticated access to customer data
- organization/user scoping
- storage policies for uploaded certification files
- paid-subscription enforcement for mass certification uploads
- server-side entitlement checks
- audit logging and traceability workflows
- controlled environment variables for service credentials

Do not commit secrets, API keys, service-role credentials, or customer data to this repository.

## Development setup

### Requirements

- Node.js LTS
- npm
- Git
- Supabase project/configuration for backend features
- Stripe account and API credentials for billing features

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

Use the repository's existing package scripts as the authoritative command set; do not assume a script exists unless it is present in `package.json`.

## Environment variables

The exact environment variable names are defined by the application source and deployment configuration. At minimum, production environments require the configured Supabase and Stripe connection values used by the application.

Typical categories include:

- Supabase project URL
- Supabase publishable/anonymous key
- Stripe publishable key
- Stripe secret key (server-side only)
- Stripe webhook/signing secret where applicable
- application URL / redirect URL
- any AI/OCR provider credentials used by enabled server functions

Never expose server-side secrets through client bundles. When adding a new integration, document its variable names in the deployment configuration and keep secrets in the hosting provider's secret manager.

## Testing and launch validation

Before production launch, validate at minimum:

1. Public homepage loads and all primary CTAs resolve.
2. Free-review gate captures company/contact information before upload.
3. A free user can review exactly three certifications, one at a time.
4. A fourth free review is blocked with a clear upgrade path.
5. A free user cannot mass upload certifications.
6. A paid user can mass upload according to entitlement.
7. Professional enforces 500 units / 1 state / unlimited properties.
8. Stripe checkout opens for each paid platform plan.
9. Successful Stripe subscription updates account entitlements.
10. AI document overage charges use the $3 `ai_document_overage_each` Price.
11. Customer files remain inaccessible across organizations.
12. Findings retain source/rule context and human approval remains explicit.
13. Pricing, email copy, Stripe products, and application entitlements show the same plan definitions.
14. Production build completes without TypeScript/build errors.

## Deployment

The project is connected to Lovable for application development and preview/deployment workflows and to GitHub for source control.

Recommended launch sequence:

1. Work on a dedicated branch.
2. Run build/type checks and targeted workflow tests.
3. Review the production preview.
4. Verify Stripe live-mode prices and checkout behavior.
5. Merge the launch-ready branch to the production branch.
6. Publish the production application.
7. Run a smoke test from a clean browser session.
8. Confirm the CRM lead capture and paid entitlement path with test data before driving real traffic.

## Repository structure

Key areas include:

- `src/routes/` — public, trial, pricing, and authenticated application routes
- `src/components/` — shared UI and workflow components
- `src/lib/` — platform data, plan catalog, CRM, trial/free-review data, email templates, and business logic
- `src/utils/` — server/client utility functions including entitlement workflows
- `supabase/migrations/` — database schema, policies, and security enforcement
- `docs/` — operational and historical documentation

## Source-of-truth rules

To keep CertivoIQ consistent across media:

- **Product limits:** `src/lib/plan-catalog.ts`
- **Marketing plan presentation:** `src/lib/platform-data.ts` and public pricing routes
- **Billing:** Stripe product/Price objects and lookup keys
- **Free-review policy:** free-review gate + entitlement/database policies
- **Compliance positioning:** public marketing copy and this README
- **Historical build specification:** `docs/legacy-build-prompt.md`

When a plan, product, or workflow changes, update the source of truth first and then update dependent surfaces. Do not create a second competing definition.

## Historical build prompt

The original repository README contained the AI build prompt and early product-development specification. It has been moved out of the production README so this file can serve as operational documentation. A historical archive is retained at `docs/legacy-build-prompt.md`; Git history also preserves the original README commit.

## License and ownership

This repository contains proprietary CertivoIQ application code and business logic. Do not assume an open-source license unless one is explicitly added to the repository.
