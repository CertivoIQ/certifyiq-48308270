
CREATE TABLE private.merlin_dispatch_tokens (
 token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL, consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.merlin_dispatch_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.merlin_dispatch_tokens FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,UPDATE ON private.merlin_dispatch_tokens TO service_role;
CREATE TABLE private.merlin_native_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES public.operations_jobs(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.merlin_native_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.merlin_native_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.merlin_native_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.merlin_consume_dispatch_token(_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE affected integer;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 IF length(_token)<>64 THEN RETURN false; END IF;
 UPDATE private.merlin_dispatch_tokens SET consumed_at=now()
 WHERE token_hash=encode(sha256(convert_to(_token,'UTF8')),'hex') AND consumed_at IS NULL AND expires_at>now();
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected=1;
END $$;
REVOKE ALL ON FUNCTION public.merlin_consume_dispatch_token(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_consume_dispatch_token(text) TO service_role;

CREATE OR REPLACE FUNCTION private.dispatch_merlin_preparation(_preflight boolean DEFAULT false)
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
 body:=jsonb_build_object('preflight',_preflight),timeout_milliseconds:=180000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION private.dispatch_merlin_preparation(boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.merlin_claim_native_preparation(_worker text)
RETURNS public.operations_jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE claimed public.operations_jobs; expired record;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 IF _worker NOT LIKE 'merlin-native:%' THEN RAISE EXCEPTION 'native lease identity required'; END IF;
 PERFORM pg_advisory_xact_lock(48308270,910);
 FOR expired IN SELECT * FROM public.operations_jobs WHERE job_type='merlin_state_procedure_crawl'
  AND status='running' AND lease_owner LIKE 'merlin-native:%' AND lease_expires_at<=now() FOR UPDATE
 LOOP
  PERFORM public.operations_fail_job(expired.id,expired.lease_owner,
    '{"code":"NATIVE_LEASE_EXPIRED","message":"Preparation worker timed out; bounded retry"}'::jsonb);
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.operations_jobs WHERE job_type='merlin_state_procedure_crawl' AND status='running')
  OR (SELECT count(*) FROM private.merlin_native_attempts WHERE created_at>=now()-interval '24 hours')>=24
 THEN RETURN NULL; END IF;
 SELECT j.* INTO claimed FROM public.operations_jobs j
 JOIN public.merlin_procedure_documents d ON j.payload->>'procedure_document_id'=d.id::text
 JOIN public.state_rule_source_candidates c ON c.id=d.source_candidate_id
 WHERE j.job_type='merlin_state_procedure_crawl' AND j.worker='certivoiq-merlin-procedure'
  AND j.risk_tier='tier_2_prepare' AND j.status IN ('queued','retry_wait')
  AND (j.scheduled_at<=now() OR j.scheduled_at='infinity'::timestamptz)
  AND j.attempts<least(j.max_attempts,3)
  AND d.status IN ('queued','failed') AND d.validated_at IS NULL
  AND d.program IN ('LIHTC','LIHTC_LAYERED_STATE_COMPLIANCE','HUD_MULTIFAMILY')
  AND d.content_type='application/pdf'
  AND c.agent_verification_status='verified' AND c.exact_bytes_captured
  AND c.source_sha256=d.source_sha256 AND c.source_url=d.source_url
  AND j.payload->>'source_sha256'=d.source_sha256
  AND j.payload->>'source_candidate_id'=c.id::text
  AND coalesce(c.verification_evidence->>'validation_evidence_eligible','true')<>'false'
  AND coalesce(c.verification_evidence->>'evidence_kind','')<>'discovery_page_only'
 ORDER BY CASE WHEN j.status='retry_wait' THEN 0 ELSE 1 END,j.created_at,j.id
 FOR UPDATE OF j SKIP LOCKED LIMIT 1;
 IF claimed.id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.operations_jobs SET status='running',lease_owner=_worker,lease_expires_at=now()+interval '5 minutes',
  heartbeat_at=now(),started_at=coalesce(started_at,now()),scheduled_at=now(),attempts=attempts+1,
  max_attempts=least(max_attempts,3),updated_at=now() WHERE id=claimed.id RETURNING * INTO claimed;
 INSERT INTO private.merlin_native_attempts(job_id) VALUES(claimed.id);
 INSERT INTO public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,detail)
 VALUES('worker','merlin.native.claimed','operations_job',claimed.id::text,claimed.correlation_id,
  jsonb_build_object('worker',_worker,'attempt',claimed.attempts,'daily_attempt_cap',24));
 RETURN claimed;
END $$;
REVOKE ALL ON FUNCTION public.merlin_claim_native_preparation(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_claim_native_preparation(text) TO service_role;
