-- Remove structural privileges that API client roles do not need.
-- TRUNCATE is not subject to RLS, while REFERENCES and TRIGGER exceed the
-- PostgREST data-plane contract. SELECT/INSERT/UPDATE/DELETE remain unchanged
-- and continue to be constrained by each table's RLS policies.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke truncate, references, trigger on all tables in schema storage from anon, authenticated;

-- Prevent the migration owner from reintroducing those grants on future public
-- tables through its default privileges.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

notify pgrst, 'reload schema';
