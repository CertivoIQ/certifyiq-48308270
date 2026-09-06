# Native CertivoIQ Income Calculator

Authenticated route: `/income-calculator`. Shared menu label: **Income Calculator**.

## Scope
One existing property/unit/household record, up to 20 concurrent program layers (including four-layer properties), shared wage/evidence inputs, and separate method/income/limit/comparison for each layer. This is a controlled calculation worksheet, not a complete eligibility, rent, asset-qualification, over-income, or eviction engine.

No workbook is needed. Nothing creates duplicate properties, units, or tenants. Existing TIC records are not overwritten. Source references can point to uploaded household certification documents; extraction does not silently replace or approve calculator inputs.

## Configuration and methods
The owning account approves effective-dated property or unit profiles. Unit-specific profiles take precedence. Profiles include administering agency, policy/version/source, implementation, definition, evidence requirement, rounding policy, unit designation, geographic limit source and effective dates, and household-size limits. No nationwide limits or unvalidated state rules are preloaded.

Prospective, implemented HOTMA prior-12-month annual review, RD adjusted income, approved HOME/HTF AGI, accepted determination, and special/manual routes are distinct. HTF assistance must be resolved before choosing a route. Ambiguous `HUD`/`Section 8` codes remain unresolved program classifications rather than being silently treated as Multifamily. Implementation dates are property policies, not a hardcoded universal deadline.

Inputs preserve six-decimal rates and hours using rational arithmetic. Pay-period multipliers are 52/26/24/12/1. Current hourly, gross-per-period, and comparable-statement averages are alternative wage bases, never additive. Expected paid weeks and documented annual changes support changing schedules. Incomplete/overlapping periods and unexplained gross/hour differences block results. Historical rows cover the exact preceding 12 months; anticipated asset income is added separately. Layer adjustments never leak into another program.

## Review and storage
Incomplete evidence, unsourced limits, undefined implementations, and missing review checks return **Not Determined**. Comparisons use **Above limit** / **At or below limit**, not an unqualified household eligibility decision. New snapshots remain **Pending Final Review** until a separate exact-version review is recorded.

The authenticated `income-calculator` Edge Function checks caller ownership, loads approved profiles, recalculates on the server, and saves immutable records. Final review requires name, position, signature, explicit consent, a server timestamp, and a matching SHA-256 snapshot. Current rules, engine, and referenced source hashes are checked again before signing. Editing creates a new unsigned working version and cannot mutate a signed snapshot. A previously signed report always displays the stored calculation rather than current live recomputation.

The three new tables use row-level security and authenticated SELECT-only access. All writes go through the server after ownership checks. UPDATE/DELETE are denied and guarded by triggers. Secret keys remain server-side. There is no browser local/session storage for household data.

This follows the existing per-account portfolio ownership model; it does not grant additional access to another account's portfolio or silently create organization-wide collaboration rights.

## Tests
Run `node --test scripts/test-native-income-calculator.mjs` after dependencies are installed. The suite contains 75 isolated synthetic tests covering routing, arithmetic, rounding, layering, historical periods, review blockers, duplicate pay, and signature-display safeguards. Fixture values never populate live household inputs or profiles.

Before operational use, configure signed property/unit policy profiles and sourced income limits, verify actual evidence treatment, and exercise the authenticated save/reload/sign workflow with the customer's authorized account. A passing code test is not nationwide legal validation.
