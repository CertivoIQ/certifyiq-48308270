# TIC-first packet selection

## User workflow
Upload and identify documents -> confirm each page as TIC, included supporting document, or omitted -> extract selected TIC pages -> review/correct fields -> save / start review.

TIC pages are preselected when a title or multiple form sections are detected. Non-TIC pages (including bank/pay statements, administrative notes, instructions, covers, unreadable and blank pages) await a user decision. Bulk actions are explicit user actions, not automatic compliance approval. A user can correct a missed TIC classification. Only one household/certification should be selected at a time.

The source viewer opens at the first selected TIC page, not the start of the packet. Changing page selections invalidates the form/digest and clears unsaved corrections; the TIC must be rebuilt. Omitted pages remain in the original source packet. They do not populate TIC cells or create included supporting-document records. Missing required evidence can still block a determination.

## Implementation
- Native PDF row geometry precedes OCR. Scanned-page OCR blocks are available on all pages, not just the first three. Exact native fields take precedence over OCR guesses.
- Checkbox selections and direct mapped values are preserved; contradictory candidates are left unresolved.
- Spatial mapping no longer scales a table to occupied data cells. A blank/redacted last column must not shift names or values to other cells. Aligned OCR cell fragments are combined into physical rows.
- A full page inventory includes blank/unreadable pages, using the validated source-bound sidecar count. New intake fails closed when that inventory is missing instead of guessing page boundaries from concatenated text.
- Server validation requires exactly one decision per physical source page, at least one TIC, no pending pages, and an omission reason. A source/selection digest prevents saving a stale preview after changes.
- Original-page identities, include/omit choices and reasons are saved in existing confirmation history. Only selected supports get source-page records. Confirmed TIC type is retained for review; Other requires an explicit review action.
- Selected-packet review rejects facts pointing outside its TIC pages and will not fall back to extracting the complete original packet when confirmed facts are missing. The selection is included in the evidence manifest.

## Verification and scope
Tests exercise classifiers, direct extraction, blank last-column layout, source page/selection validation and the actual intake handlers with mocked storage/database boundaries. Browser tests exercise the actual React organizer with a synthetic packet. These are not an authenticated production upload/save/reload test and do not prove all-template OCR accuracy.

No production customer data or database schema is changed by the tests. No income/rent limit rules, signature/position gate, state pack activation, billing, authentication or onboarding gates are weakened. This focused change is based on current main, not a merge of the broader unfinished PR #384 calculator work. Separately uploaded supporting-document intake remains unchanged. The selection applies to pages in the current uploaded packet; it does not yet group independent uploads into one packet. Multi-page row stitching and arbitrary handwritten/rotated form accuracy are not claimed.

The supplied screenshot establishes the failure symptom, but it is not the full source PDF. Acceptance on that exact original TIC still requires the PDF. Do not describe successful synthetic tests as proof that its fields now extract correctly.
