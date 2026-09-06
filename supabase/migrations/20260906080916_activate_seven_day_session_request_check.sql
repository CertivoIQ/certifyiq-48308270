alter role authenticator set pgrst.db_pre_request = 'public.enforce_session_window';
notify pgrst, 'reload config';
