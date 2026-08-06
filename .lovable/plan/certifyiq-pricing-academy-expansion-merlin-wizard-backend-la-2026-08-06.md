# CertifyIQ — Pricing, Academy Expansion, Merlin Wizard, Backend & Launch

## 1. Pricing corrections (self-serve, no sales calls)

- Enterprise: **$4,999/month**, purchased online with recurring billing until canceled. CTA becomes "Subscribe now" (no "Talk to sales").
- CertifyIQ Academy subscriptions: Individual unchanged, **Company $3,499/mo**, **Enterprise $6,499/mo**.
- Academy add-on: **$49 / user / month or $499 / company / month**; Enterprise Academy stays $6,499/month.
- Remove the "Professional onboarding & migration" add-on and replace it with **AI Onboarding & Migration Wizard** (included, no rep required).
- Add a Billing page: current plan, renewal date, invoices, and self-serve **Cancel subscription** (cancels at period end).

## 2. Real online payments

- Enable Lovable's built-in Stripe payments and create recurring products: Enterprise platform ($4,999/mo), Academy Individual / Company ($3,499) / Enterprise ($6,499), Academy add-on seat ($49) and company ($499), plus the existing Professional and Business plans.
- Checkout from the pricing page, success/cancel return pages, and a webhook that records subscription state so access follows the active subscription.

## 3. AI Onboarding & Migration Wizard (no account rep)

- Self-serve property onboarding wizard: property details, state, **affordable housing program(s) dropdown** (LIHTC, PBS8, HOME, HOTMA, RD, Bond), set-asides, unit mix, then rule packs auto-assigned at registration.
- Migration step: upload an existing rent roll / certification export, AI maps columns to CertifyIQ fields, shows a preview with confidence and lets the user confirm before import.
- Bulk onboarding for multiple properties, and a resumable checklist so users can leave and return.

## 4. Merlin the Compliance Wizard

- Illustrated wizard character — pointy star-covered hat, robe, wand, warm and playful — generated as app artwork with a few poses (greeting, pointing, celebrating, thinking).
- Appears as host of LaunchPad, the property onboarding/migration wizard, and Academy course intros, plus a floating helper button on every page with short, funny, plain-English compliance tips and encouragement.
- Celebration moments: confetti-style flourish when a wizard step, exam, or certificate is completed.

## 5. Academy: 21 new certification tracks

Each track gets full written modules (4–6 per course), a graded exam, and a printable **Certificate of Achievement** on passing.

Compliance & Asset Management: Affordable Housing Compliance Professional · Compliance Manager Certification · Affordable Housing Asset Management · Portfolio Compliance.

Specialized: HOTMA Specialist · TRACS · REAC/NSPIRE Inspection · HOME & LIHTC Combined Compliance · Bond Compliance (§142(d)) · Blended Occupancy (LIHTC + HOME + Section 8).

Aligned credentials: HCCP · SHCM · COS · AHM · HOTMA Compliance · HCV Specialist · HOME Compliance · Housing Trust Fund Compliance · USDA Rural Development Compliance · Fair Housing.

Academy home gets grouped catalog sections, search/filter by program and level, progress tracking, and a transcript listing all earned certificates.

## 6. Full backend

- Enable Lovable Cloud: accounts and sign-in, organizations, properties with assigned programs, residents, certifications, findings, review sign-offs, course enrollments, exam attempts, certificates, subscriptions.
- Secure file storage for uploaded certifications and migration files; row-level security so each organization only sees its own data.
- AI review pipeline: document extraction, rule evaluation against the assigned program rule pack, Pass/Fail score with cited rules and correction steps, human final sign-off.
- Real progress/certificate persistence replaces demo data; demo content seeded so screens are populated on first load.

## 7. Deploy

Publish the site once the above is working and verified.

## Technical notes

- Pricing/plan data lives in `src/lib/platform-data.ts`; pricing UI in `src/routes/pricing.tsx`.
- New routes: `properties.new.tsx` (onboarding + AI migration wizard), `billing.tsx`, checkout return routes, expanded `academy.*`.
- Course content moves out of `demo-data.ts` into a dedicated `src/lib/academy-courses.ts` (21 courses, modules, exams) to keep files manageable.
- Merlin poses generated as image assets and wrapped in a `<Merlin />` component plus a floating `WizardHelper`.
- Backend on Lovable Cloud with TanStack server functions; Stripe via Lovable's built-in payments, subscription state stored in the database and enforced server-side.
- Build order: pricing + payments → onboarding/migration wizard + Merlin → Academy tracks → backend wiring → publish.
