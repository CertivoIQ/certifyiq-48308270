# Native Income Calculator release

User-authorized merge and Cloudflare deployment. No workbook, external generator credits, domain cutover, signature impersonation, or nationwide rule activation.

## Completed integration repair
- Exact input parsing and section navigation satisfy noUncheckedIndexedAccess.
- Shared input validators satisfy noPropertyAccessFromIndexSignature.
- Optional menu callbacks explicitly permit undefined under exactOptionalPropertyTypes.
- Saved snapshots keep their original inputs, rules, calculations, and review when current configuration is fetched.
- Independent loading/error states prevent one successful request from hiding another pending/failed request.
- The calculator regression suite now has 86 isolated tests and compiles its engine with the application strictness flags.

## Release gate
The full existing application has pre-existing TypeScript diagnostics. Do not describe it as fully type-clean. The release independently typechecks pre-feature commit 3a662a690d7e02bf5cd6fda16149c964864c0cd4, retains all diagnostics, requires zero calculator and menu diagnostics, and rejects new diagnostic locations/codes/source spans elsewhere. The application build and focused existing certification regressions must also pass. This does not disable the repository's existing Compliance Intelligence CI.

After merge, the release workflow publishes to the existing certivoiq-launch-candidate-20260905-v11 worker only after verifying existing certivoiq.com/www domain mappings and runtime bindings. It preserves existing vars and secrets, checks the newly active deployment, and verifies the exact source-commit manifest and calculator JavaScript digest at both custom domains and the worker address. It also verifies anonymous backend calls are rejected.

## Operational boundary
The calculator backend is an authenticated Supabase Edge Function. Frontend strictness/limits-parser repairs do not change the annualization or program-routing engine outputs. Source-confirmed property/unit rule profiles and income limits must be approved in Property Rule Setup before program comparisons can be determined. None are fabricated or preapproved by the release.

Authenticated save/reload/final-review acceptance with an authorized customer's actual session must be distinguished from arithmetic tests and public deployment smoke checks. A typed signature must only be supplied by the responsible party. The release does not claim that customer-session acceptance was performed.
