# Onboarding handoff and calculator acceptance repair

## Behavior
Organization setup now has an explicit **Save profile & continue** action. It reads back the saved account profile, compare-and-sets only the active second checklist step, and returns to LaunchPad. Previously completed later steps are not reset by editing organization settings. Portfolio CSV setup also provides a direct return link. Failed requests preserve edits and release busy controls. LaunchPad validates a persisted organization profile and continues to require actual portfolio records and a completed certification upload for the later steps.

## Type safety
The complete strict application typecheck is mandatory in the release workflow, replacing the former no-new-errors comparison. Live-schema portfolio relationships and certification fields are synchronized in generated types; extracted values are validated at the serializable preview boundary; owned list endpoints return typed rows. Null, optional-field, and shared UI tone contracts are corrected without disabling strict compiler options. The legacy version-2 TIC upload component delegates to the current tenant-required implementation.

The existing Stripe runtime API version is intentionally preserved. Its one-line SDK version adapter is narrow and documented; it is not an assertion that all Stripe response fields or live billing are independently verified by this repair.

## Acceptance test safety
The browser acceptance workflow runs only against the checked release on certivoiq.com after a successful main-branch release, or by explicit main-branch dispatch. It uses new, visibly labeled synthetic accounts and a single fictional property/unit/household. No billing objects, real residents, customer policies, or real review signatures are created or changed. Signed test records remain isolated in a disabled test account because immutable audit records are not deleted or bypassed for cleanup. Test refresh sessions are revoked. The second test account is deleted after revocation.

The test covers normal sign-in, missing-profile blocking, an injected save outage and retry, step 2→3 reload persistence, CSV portfolio onboarding, the step-4 certification requirement, server recalculation, browser save and test-signature recording, full-page reload, edits invalidating review, cross-account denial, and owner/server-role mutation denial. Sanitized results and synthetic-only screenshots are retained as workflow evidence. A failed test does not certify successful acceptance.
