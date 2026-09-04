# Security controls previously blocked by plan

## Supabase leaked-password protection

**Status: technical complete as of 2026-09-04.**

The CertivoIQ Supabase organization `caidmuehudoyhswymjjw` was upgraded to the Pro plan. The founder enabled leaked-password protection for production project `emnkzxkcpnyvglwxraxm`.

Post-change verification confirmed:

- the organization reports plan `pro`;
- the production project reports `ACTIVE_HEALTHY`;
- the Supabase security advisor returns no `auth_leaked_password_protection` finding;
- the advisor returns zero `WARN` findings;
- the 13 remaining findings are `INFO`-only RLS-without-policy notices for intentionally service-only tables.

Supabase Auth now checks password choices against known compromised-password data. Founder TOTP MFA, email confirmation, tenant-isolation tests, and privileged-RPC controls remain in force as defense in depth.
