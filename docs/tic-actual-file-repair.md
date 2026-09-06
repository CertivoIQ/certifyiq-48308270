# TIC packet selection and ruled-cell repair

## Change
Identify packet pages before mapping TIC fields. TIC pages are preselected; other pages await explicit inclusion/omission. Selection changes invalidate the preview and clear stale corrections. The server validates one choice per physical page, source/selection digest, omission reasons, and source ownership. Only selected TIC pages may supply TIC facts, and only included supporting pages create support records. Original bytes are retained.

The actual source test reproduced whole-page OCR errors in a ruled legacy TIC: missing household cells, a misread unit, redaction artifacts, and boilerplate incorrectly treated as values. The new browser extraction path detects supported table rulings from pixels, isolates cell images into one bounded sheet per recognized TIC page, and maps their OCR to the original cell coordinates. No personal data, actual document, cropped image or actual-file test fixture is committed here.

A neutral 'Value:' prefix is used only on the temporary sheet to retain one-character cells. The prefix is never source evidence and is excluded by coordinates. Missing single characters may use an explicit higher-confidence word from the same original cell; ambiguous glyphs are not repaired. Redactions stay unresolved. Strict cell mode disables generic label-following guesses on those pages. Confidence and original cell coordinates accompany proposals; extraction does not verify a fact or approve a certification.

## Verification scope
The packet-organizer base passed 48 regression tests, the application build, full strict TypeScript checking and the actual React organizer's Chromium test with synthetic input. Its runner could not update workflow files. This application-only revision intentionally leaves all workflow files unchanged and does not change runner permissions.

With the ruled-cell addition, 59 local regression tests passed. A private local test on the supplied TIC pages recovered 30 source fields and left obscured fields unresolved. The local OCR harness used Tesseract 7's scalar core because its automatically chosen SIMD core did not initialize in that container. The harness is therefore not proof of the production browser's OCR runtime behavior.

Run `node --test scripts/test-tic-*.mjs scripts/test-certification-pipeline-performance.mjs scripts/test-onboarding-certification-separation.mjs`, then the frozen-dependency application build and full `tsc --noEmit` check. The existing PR checks provide additional build/type evidence on the exact candidate revision.

## Still not established
- Authenticated production upload, source storage, confirmation save and reload with the actual file.
- OCR of every supporting page in the 46-page packet or accurate handling of every state/template.
- All checkbox groups, handwritten signatures, source row stitching across pages, or several TICs/households in one packet.
- Verified property-specific income/rent/utility-allowance resolution or program-dependent asset-income policy. Copied TIC limits are not independent authority.
- Automatic calculations for separately uploaded supporting documents. The broader unfinished calculator PR is not merged by this focused change.

The original document, names, financial account identifiers, source-cell images and real-file OCR caches remain outside the repository. No production data, schema, billing, state-pack validation, authentication or onboarding gate has been changed. No production deployment is performed by this change.
