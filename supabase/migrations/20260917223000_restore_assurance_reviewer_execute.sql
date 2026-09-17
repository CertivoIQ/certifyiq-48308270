-- Restore the authenticated execution grant required by assurance RLS policies.
-- The original control-plane migration grants this helper to authenticated users;
-- production drift removed that grant and caused audit_readiness_score() to fail closed.

grant execute on function private.certivoiq_assurance_reviewer(uuid)
to authenticated, service_role;
