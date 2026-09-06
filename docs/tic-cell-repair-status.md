# TIC cell recognition and source-bound calculation repair

Branch: `fix/tic-cell-recognition-20260905`. Pull request: #384.
Original inspected main: `3a662a690d7e02bf5cd6fda16149c964864c0cd4`.
Existing strict-type corrections from candidate `c6a8161182250c5e6f6652686ea34a5a79aa6274` are preserved.

## Implemented

Exact mapped values no longer pass through text-label stripping that discarded Initial Certification and Recertification. Checked choices are unambiguous; conflicts stay unresolved. Native PDF values and unique canonical keys map to TIC cells, including separate first-name/middle-initial controls. Native PDF row geometry is retained. TIC classification is content-based rather than restricted to the first three pages. Supporting pages are excluded from TIC field extraction. Same-member asset/income rows remain separate within a page. Complete household header geometry is preferred and the PHFA eleven-cell fallback has twelve column edges.

The upload preview now recognizes supported clearly labelled pay-stub and bank-statement fields as source-bound proposals. Sources include original filename, SHA-256, page and extracted snippet. Current gross pay is separate from net pay and YTD totals; bank principal, period interest and account last-four digits are separate. Missing/ambiguous labels remain editable rather than guessed.

The supporting worksheet prepopulates those extracted values. Reviewers select distinct periods from one employee/employer or one bank account, confirm period frequency, choose destination TIC row and household member, and record calculation policy and correction reason. Existing and proposed values and formula are visible before applying. The server recomputes submitted calculations and rejects fabricated source references. Reviewed inputs and original extracted fields are retained in existing confirmation history, and a saved formula/source-page summary is displayed during review. These are calculation proposals, not eligibility or final approval.

The saved source certification type supplies the review queue type. Other remains Other on the source TIC and requires an explicit initial/annual/interim review action before starting review. Program codes and jurisdiction are taken from the selected tenant profile and linked property, not invented during document intake. No portfolio records are created by certification upload.

## Verification

Candidate integration run 34006194444 passed the expanded regression tests, targeted strict TypeScript checks and application build. Source integration was committed at `faa0854509d81e074c6a6ca246a448687d2ab06e`. The expanded set comprises 81 tests, including existing intake/performance contracts. The permanent read-only workflow reruns those tests, checks six selected repair roots, builds, and preserves source/test evidence. Check the latest Actions result for the exact tested revision.

These results do not constitute a whole-application type check, authenticated browser test or real-file recognition benchmark. A read-only schema probe confirmed that existing certification JSON/history columns and tenant/property context columns exist and that relevant tables retain RLS. No database or customer-record writes were performed by the development tools.

## Release gates still open

1. Test the actual failing redacted TIC cell-by-cell through browser upload, save, reload and review. Native, flattened and scanned PDFs, checkbox marks, household columns and continuation pages require acceptance evidence. Synthetic tests do not prove universal recognition accuracy.
2. Resolve property/unit/program/household size/bedroom count/designation/effective dates and utility allowance against controlled authoritative limits. This change does not add a verified property-limit resolver or policy-dependent actual/imputed asset-income engine. Income projection and limit comparison are distinct steps; uploaded limits must never verify themselves.
3. Validate arbitrary template variants, rotated/handwritten scans, multiple TICs/households in one packet, multi-page row stitching, and supporting documents uploaded separately from the original packet. These are not claimed complete.
4. Test authenticated authorization, correction/save/reload persistence, affected-finding invalidation and final-confirmation invalidation. Preserve Pending final review until the responsible party supplies the required signature and position. Existing confirmation history is not represented as a newly implemented immutable ledger.

No production deployment, domain/route change, schema migration, rule-pack activation, billing change or onboarding change is included. The stale npm lockfile is not rewritten; verification uses the current frozen Bun lockfile. Temporary source-mutating integration scripts have been removed from the final candidate.

## Reproduce

Install Bun 1.3.3 and Node 22, run `bun install --frozen-lockfile --ignore-scripts`, then `node scripts/check-tic-supporting-types.mjs`, `node --test scripts/test-tic-*.mjs scripts/test-certification-pipeline-performance.mjs scripts/test-onboarding-certification-separation.mjs` and `npm run build`. The repair-source artifact is a changed-file bundle for this repository, not a standalone complete application or an installer.
