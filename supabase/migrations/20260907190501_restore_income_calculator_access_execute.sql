-- Restore the authenticated grant specified by the original calculator-access migration.
-- The helper still enforces auth.uid(), session lifetime, and subscription/trial limits.
grant execute on function private.income_calculator_access() to authenticated;
notify pgrst, 'reload schema';
