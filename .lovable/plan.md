# Spanish (ES) support across the app and emails

Add full English/Spanish switching for every screen, plus Spanish versions of the marketing and app emails, chosen per property so multi-lingual sites get material in the right language.

## What you'll see

- A globe **EN / ES** control in the header next to the light/dark toggle. The choice sticks across visits and is picked up on the next page load, including the landing, pricing, trial, sign-in, dashboard, properties, findings, Academy, LaunchPad and CRM screens.
- Merlin greets and answers in the selected language.
- Each property gets a **Correspondence language** dropdown (English / Spanish) on its detail page and in the new-property form. Emails triggered for that property — including marketing and notice material — go out in that language.
- Account-level emails (invoices, payment receipts/failures, password reset, sign-up confirmation) follow the signed-in user's current language.
- The CRM template library and printable one-pager get a language toggle so agents can send or print the Spanish version.

## How it's built

**Translation layer**
- Add `src/lib/i18n/` with `en.ts` and `es.ts` dictionaries (nested keys per surface, e.g. `pricing.hero.title`), a `LanguageProvider` in `__root.tsx` that reads `localStorage` + `<html lang>`, and a `useT()` hook returning a lookup function with English fallback for any missing key.
- Extract the visible strings from routes and components into `en.ts` in passes, one surface at a time: public/marketing pages → auth → app dashboard/properties/findings → Academy/LaunchPad → CRM. Data-driven copy (`platform-data.ts`, `demo-data.ts`, `academy-track-a.ts`, course/module titles, rule blurbs, status labels) moves to keyed entries rather than being hardcoded per-locale.
- Spanish strings are AI-generated at build time and committed as `es.ts`, using housing-compliance terminology (LIHTC, HOTMA, Sección 8, certificación de ingresos) and keeping program names, form numbers and statute citations untranslated. You can edit any string in that file directly.
- Numbers, currency and dates go through `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale.

**Database**
- Migration adding `correspondence_language text not null default 'en'` (constrained to `en`/`es`) to the property records, and `preferred_language text not null default 'en'` on `profiles`.

**Emails**
- `src/lib/email-templates/shared.tsx` gains an email-side dictionary and a `locale` prop; every template (`intro-cold`, `invoice-created`, `payment-succeeded`, `payment-failed`, `support-request-received`, and the six auth templates) renders through it and defaults to `en`.
- `sendTemplateEmail` accepts a `locale` option, threads it into `templateData` and picks the localized subject line.
- Call sites resolve the locale: property-triggered sends read the property's `correspondence_language`; billing/support/auth sends read the recipient's `preferred_language`.
- The auth webhook maps the user's stored preference into each auth template.
- Template preview and the CRM template library render both languages so you can review before sending.

**SEO**
- Each route's `head()` gains `og:locale` for the active language and reciprocal `hreflang` alternates, with metadata titles/descriptions pulled from the dictionaries.

## Scope note

This touches roughly every route and component, so it lands in the ordered passes above; after each pass the app stays fully working with any not-yet-translated string falling back to English.
