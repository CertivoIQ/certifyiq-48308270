-- Storage policies run as the signed-in caller, including during certification uploads.
-- Restore the original policy-helper grant removed by broad function hardening.
-- The existing helper still checks submission ownership, agency membership or staff authority.
grant execute on function private.can_access_correction_evidence(text) to authenticated;
