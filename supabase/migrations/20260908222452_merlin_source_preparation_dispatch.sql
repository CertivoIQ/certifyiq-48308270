CREATE OR REPLACE FUNCTION private.dispatch_merlin_source_preparation()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE token text; request_id bigint;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'postgres scheduler required'; END IF;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 DELETE FROM private.merlin_dispatch_tokens WHERE created_at<now()-interval '1 day';
 INSERT INTO private.merlin_dispatch_tokens(token_hash,expires_at)
 VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '2 minutes');
 SELECT net.http_post(
 url:='https://emnkzxkcpnyvglwxraxm.supabase.co/functions/v1/merlin-preparation-worker',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
 body:=jsonb_build_object('source_only',true),timeout_milliseconds:=180000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION private.dispatch_merlin_source_preparation() FROM PUBLIC,anon,authenticated,service_role;

