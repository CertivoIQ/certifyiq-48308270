# Plan-blocked security controls

## Supabase leaked-password protection

As of 2026-09-02, the CertivoIQ Supabase organization is on the Free plan. Supabase's HaveIBeenPwned leaked-password protection is available only on Pro and above, so this control cannot be enabled on the current plan.

Compensating controls currently in force:

- founder TOTP MFA is enrolled and verified in production;
- email confirmation remains part of the authentication flow;
- production authentication and tenant isolation tests remain mandatory in CI;
- privileged RPCs are separately role/tenant gated;
- the control must be re-evaluated immediately if the Supabase organization is upgraded to Pro or higher.

This classification is `plan_blocked`, not `complete`. It does not claim equivalent protection to Supabase's leaked-password screening.
