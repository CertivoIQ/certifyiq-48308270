# TIC cell recognition repair — candidate status

Branch: `fix/tic-cell-recognition-20260905`.
Inspected baseline: `3a662a690d7e02bf5cd6fda16149c964864c0cd4`.

## Verified so far

Candidate integration run `34005112091` passed all 29 synthetic unit/actual-module integration tests and the application build using the existing frozen Bun lockfile. The source changes were committed to this isolated branch. The npm lockfile is out of sync with package.json; it was not rewritten as part of this repair. A successful build is not a complete application type check or an authenticated end-to-end review test.

## Included

Preserve exact native mapped values instead of stripping certification choices and name text as labels; require an unambiguous selected certification type; reject conflicting direct candidates; map unique canonical native field names and separate first-name/middle-initial controls; retain native PDF line coordinates; identify TICs beyond the first three pages; preserve separate same-member income and asset rows within a page; classify packet pages before extracting TIC values; add a reviewer-controlled calculation worksheet to the TIC.

The worksheet compares current TIC values to proposed totals, requires explicit zeros in active rows, separates account principal from asset income, requires pay frequency/policy/source references for gross-pay projection, and requires a review acknowledgment and correction reason before applying a proposal. Applied values and a note use the existing confirmation interface. The note is limited to 500 characters, is editable, and is not a new immutable calculation ledger. Unapplied worksheet entries are not saved.

## Not included / not proved

- Automatic extraction of pay-stub and bank-statement fields into the worksheet. Amounts are currently entered by the reviewer.
- A newly implemented verified property-limit resolver or policy-dependent actual/imputed asset-income engine.
- Complete arbitrary-template mapping, multi-page row stitching, rotated/handwritten scans, multiple households or multiple TICs in one packet.
- Authenticated browser upload/save/reload testing, calculation revision persistence, authorization/RLS testing or final-review signature/position verification.
- Real-file accuracy: no failing customer TIC was supplied. Synthetic tests do not establish universal recognition accuracy.

## Release requirements

Validate a redacted failing TIC cell-by-cell, including initial/recertification/other and Other explanation. Test native, flattened and scanned forms, multiple household members/accounts/employers, and continuation pages. Establish source-document/hash/page/cell provenance, preserve uploaded/calculated/accepted values separately, verify pay-period coverage and duplicates, and link evidence to the correct household member.

Resolve property, unit, program, jurisdiction, household size, bedroom count, unit designation, effective dates and utility allowance against controlled authoritative limits. Uploaded limits must not verify themselves. Income projection and income/rent eligibility comparisons are separate steps. Program-specific recertification controls must not be replaced by initial-certification rules.

Corrections must invalidate affected findings and final confirmations. Retain `Pending final review` until the responsible party supplies the required signature and position. Preserve the separation between certification-document intake and portfolio/tenant onboarding.

No production deployment, Cloudflare/domain/route change, schema migration, rule-pack activation, billing change or onboarding change was performed.

## Commands

`node scripts/apply-tic-cell-repair.mjs` applies guarded baseline edits in a candidate checkout. `node scripts/finalize-tic-cell-repair.mjs` applies strict typing corrections and checks four selected repair roots; it is not a whole-application type check. `node --test scripts/test-tic-cell-repair.mjs scripts/test-tic-repair-integration.mjs` runs the 29 tests. Install the existing frozen Bun lockfile before integration tests/build. `npm run build` builds but does not deploy.
