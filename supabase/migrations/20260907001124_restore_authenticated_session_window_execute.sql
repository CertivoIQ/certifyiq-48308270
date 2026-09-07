-- The PostgREST pre-request hook runs as the caller and invokes
-- private.session_window(). Authenticated users therefore require EXECUTE on
-- this narrowly scoped, self-bound function or every authenticated REST/RPC
-- request fails before the application dashboard can load.
grant execute on function private.session_window() to authenticated;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
