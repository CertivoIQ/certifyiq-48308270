2FA / MFA for CertifyIQ Sign-In

Goal: Add TOTP-based multi-factor authentication to the CertifyIQ sign-in flow, letting users enroll an authenticator app from their account settings and requiring a 6-digit code after email/password sign-in.

What will be built

1. MFA enrollment page in the authenticated account area
   - Generate a TOTP secret through Supabase Auth MFA (`supabase.auth.mfa.enroll()`)
   - Show a QR code for scanning with an authenticator app (Google Authenticator, Authy, etc.)
   - Verify the first code to complete enrollment
   - Store recovery codes and allow the user to regenerate them

2. Updated sign-in flow on `/auth`
   - After valid email/password, detect `mfa.challenge` from Supabase Auth
   - Show a second screen prompting for the 6-digit TOTP code
   - Call `supabase.auth.mfa.verify()` to complete sign-in
   - Handle errors (wrong code, expired challenge) with retry/resend options

3. Security settings UI
   - List currently enrolled factors
   - Allow unenrolling a device after re-authentication
   - Show last-enrolled date and backup/recovery codes

4. Backend / database
   - Use Supabase Auth's built-in MFA primitives (no custom TOTP secrets)
   - Add a lightweight `profiles` extension or use the existing `profiles` table to track whether MFA is enabled for UI prompts (e.g., `mfa_enabled` boolean updated by an `onAuthStateChange` hook or a server-side check)
   - No RLS changes required; MFA state lives in Supabase Auth metadata

5. UX considerations
   - Do not require MFA for trial sign-ups by default
   - Prompt users to enable MFA after they subscribe or from LaunchPad
   - Keep CRM/staff dashboard protected by the existing `@certifyiq.com` role gate
   - Preserve existing email verification and password reset flows unchanged

Technical approach

- Supabase Auth exposes `mfa.enroll`, `mfa.challenge`, `mfa.verify`, `mfa.unenroll`, and `listFactors` via the GoTrue client. This implementation uses those APIs rather than building a custom TOTP engine.
- The sign-in component will become a two-step form: step 1 = email/password, step 2 = MFA code, driven by Supabase Auth's `signInWithPassword` response and the `aal2` challenge.
- The enrollment flow will be placed behind the existing `_authenticated` layout so only signed-in users can reach it.
- A new route file `src/routes/_authenticated/security.tsx` will host the enrollment/settings UI.
- The auth page will be updated to handle the MFA challenge step without losing the existing sign-in state.

Out of scope

- SMS-based 2FA
- Hardware security keys (WebAuthn/Passkeys)
- Forcing all users to enroll MFA (it will be opt-in at account level)

Acceptance criteria

- A user can open Security Settings, scan a QR code, verify one TOTP code, and complete MFA enrollment.
- After MFA is enabled, signing in requires the authenticator code in addition to email/password.
- A user can unenroll from Security Settings after re-entering their password.
- Existing sign-in, sign-up, email verification, and password reset flows continue to work.
- CRM Dashboard remains staff-only and unaffected.
